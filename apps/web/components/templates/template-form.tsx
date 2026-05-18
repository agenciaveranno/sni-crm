'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, apiErrorMessage } from '@/lib/api'

const schema = z.object({
  whatsAppNumberId: z.string().min(1, 'Selecione o número'),
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .regex(/^[a-z0-9_]+$/, 'Apenas a-z, 0-9 e _'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  language: z.string().default('pt_BR'),
  headerText: z.string().optional(),
  bodyText: z.string().min(1, 'Corpo obrigatório'),
  footerText: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface NumberOpt {
  id: string
  displayName: string
  phoneNumber: string
}

interface TemplateFormProps {
  templateId?: string
  initial?: Partial<FormValues>
}

export function TemplateForm({ templateId, initial }: TemplateFormProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = Boolean(templateId)

  const numbersQuery = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: async () =>
      (await api.get<NumberOpt[]>('/whatsapp-numbers')).data,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      whatsAppNumberId: initial?.whatsAppNumberId ?? '',
      name: initial?.name ?? '',
      category: initial?.category ?? 'UTILITY',
      language: initial?.language ?? 'pt_BR',
      headerText: initial?.headerText ?? '',
      bodyText: initial?.bodyText ?? '',
      footerText: initial?.footerText ?? '',
    },
  })

  const bodyText = form.watch('bodyText')
  const headerText = form.watch('headerText')
  const footerText = form.watch('footerText')

  const variables = useMemo(() => {
    const set = new Set<string>()
    const re = /\{\{\s*(\d+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(bodyText ?? '')) !== null) set.add(m[1])
    return Array.from(set).sort((a, b) => Number(a) - Number(b))
  }, [bodyText])

  const save = useMutation({
    mutationFn: async (data: FormValues) => {
      const components: Array<Record<string, unknown>> = []
      if (data.headerText?.trim()) {
        components.push({ type: 'HEADER', format: 'TEXT', text: data.headerText })
      }
      components.push({ type: 'BODY', text: data.bodyText })
      if (data.footerText?.trim()) {
        components.push({ type: 'FOOTER', text: data.footerText })
      }

      if (isEdit && templateId) {
        const res = await api.put(`/templates/${templateId}`, {
          category: data.category,
          components,
        })
        return res.data
      }
      const res = await api.post('/templates', {
        whatsAppNumberId: data.whatsAppNumberId,
        name: data.name,
        category: data.category,
        language: data.language,
        components,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success(
        isEdit
          ? 'Template atualizado'
          : 'Template cadastrado — será enviado à Meta para aprovação',
      )
      router.push('/settings/templates')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form
        onSubmit={form.handleSubmit((d) => save.mutate(d))}
        className="space-y-6 lg:col-span-2"
      >
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Identificação</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Número *</label>
              <select
                className="input"
                disabled={isEdit}
                {...form.register('whatsAppNumberId')}
              >
                <option value="">Selecione...</option>
                {(numbersQuery.data ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName}
                  </option>
                ))}
              </select>
              {form.formState.errors.whatsAppNumberId && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.whatsAppNumberId.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Nome (snake_case) *</label>
              <input
                className="input font-mono"
                placeholder="comunicado_eventos"
                disabled={isEdit}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Categoria *</label>
              <select className="input" {...form.register('category')}>
                <option value="UTILITY">Utilitário</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Autenticação</option>
              </select>
            </div>
            <div>
              <label className="label">Idioma</label>
              <select className="input" {...form.register('language')}>
                <option value="pt_BR">Português (Brasil)</option>
                <option value="en_US">Inglês (EUA)</option>
                <option value="es">Espanhol</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-1 text-base font-semibold text-ink">Conteúdo</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Use variáveis no corpo no formato <code>&#123;&#123;1&#125;&#125;</code>,
            <code> &#123;&#123;2&#125;&#125;</code> etc.
          </p>

          <div className="space-y-4">
            <div>
              <label className="label">Cabeçalho (opcional)</label>
              <input
                className="input"
                maxLength={60}
                placeholder="Ex.: Seicho-No-Ie do Brasil"
                {...form.register('headerText')}
              />
            </div>
            <div>
              <label className="label">Corpo *</label>
              <textarea
                className="input min-h-[160px] resize-y"
                placeholder="Olá {{1}}, o evento {{2}} acontece em {{3}}!"
                {...form.register('bodyText')}
              />
              {form.formState.errors.bodyText && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.bodyText.message}
                </p>
              )}
              {variables.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Variáveis detectadas:{' '}
                  {variables.map((v) => (
                    <code
                      key={v}
                      className="mr-1 rounded bg-bg px-1.5 py-0.5"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </p>
              )}
            </div>
            <div>
              <label className="label">Rodapé (opcional)</label>
              <input
                className="input"
                maxLength={60}
                placeholder="Ex.: Responda PARE para não receber mais"
                {...form.register('footerText')}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => router.back()}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Cadastrar template'}
          </button>
        </div>
      </form>

      <aside className="lg:col-span-1">
        <div className="card sticky top-6 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Preview WhatsApp
          </div>
          <div className="rounded-lg bg-[#E5DDD5] p-3">
            <div className="ml-auto max-w-[280px] rounded-lg bg-[#DCF8C6] p-3 shadow-sm">
              {headerText && (
                <div className="mb-1 text-sm font-bold text-ink">
                  {headerText}
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm text-ink">
                {bodyText || (
                  <span className="text-muted-foreground">
                    O corpo da mensagem aparecerá aqui…
                  </span>
                )}
              </div>
              {footerText && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {footerText}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
