'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { TagBadge } from '@/components/ui/tag-badge'
import { api, apiErrorMessage } from '@/lib/api'

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  phone: z
    .string()
    .min(8, 'Telefone inválido')
    .regex(/^[\d+\s()\-]+$/, 'Use apenas dígitos, +, -, espaço, ()'),
  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' ? undefined : v)),
  notes: z.string().max(2000).optional(),
  tagIds: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

interface ContactFormProps {
  contactId?: string
  initial?: Partial<FormValues>
}

interface TagOption {
  id: string
  name: string
  color: string
}

export function ContactForm({ contactId, initial }: ContactFormProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = Boolean(contactId)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      notes: initial?.notes ?? '',
      tagIds: initial?.tagIds ?? [],
    },
  })

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<TagOption[]>('/tags')).data,
  })

  const selectedTagIds = form.watch('tagIds') ?? []

  const save = useMutation({
    mutationFn: async (data: FormValues) => {
      if (isEdit && contactId) {
        const res = await api.put(`/contacts/${contactId}`, {
          name: data.name,
          phone: data.phone,
          email: data.email,
          notes: data.notes,
        })
        return res.data
      }
      const res = await api.post('/contacts', data)
      return res.data
    },
    onSuccess: (data: { id: string }) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contact', data.id] })
      toast.success(isEdit ? 'Contato atualizado' : 'Contato criado')
      router.push(`/contacts/${data.id}`)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  function toggleTag(id: string) {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((x) => x !== id)
      : [...selectedTagIds, id]
    form.setValue('tagIds', next, { shouldDirty: true })
  }

  return (
    <form
      onSubmit={form.handleSubmit((d) => save.mutate(d))}
      className="space-y-6"
    >
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">Dados pessoais</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-name">
              Nome completo *
            </label>
            <input id="contact-name" className="input" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="contact-phone">
              Telefone (WhatsApp) *
            </label>
            <input
              id="contact-phone"
              className="input"
              placeholder="+55 11 99999-8888"
              {...form.register('phone')}
            />
            {form.formState.errors.phone && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.phone.message}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="contact-email">
              E-mail
            </label>
            <input
              id="contact-email"
              type="email"
              className="input"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="contact-notes">
            Observações
          </label>
          <textarea
            id="contact-notes"
            className="input min-h-[100px] resize-y"
            {...form.register('notes')}
          />
        </div>
      </div>

      {!isEdit && (
        <div className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">Tags</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Selecione as tags que se aplicam a este contato.
          </p>
          {tagsQuery.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(tagsQuery.data ?? []).map((t) => {
                const selected = selectedTagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className="transition hover:scale-105"
                    style={{ opacity: selected ? 1 : 0.45 }}
                    aria-pressed={selected}
                  >
                    <TagBadge name={t.name} color={t.color} />
                  </button>
                )
              })}
              {(tagsQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tag cadastrada. Crie em Configurações → Tags.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => router.back()}
        >
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Salvar alterações' : 'Criar contato'}
        </button>
      </div>
    </form>
  )
}
