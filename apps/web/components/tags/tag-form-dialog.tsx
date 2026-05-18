'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, apiErrorMessage } from '@/lib/api'

const schema = z.object({
  name: z.string().min(1, 'Obrigatório').max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Use formato hex #RRGGBB')
    .default('#1B4FA8'),
  description: z.string().max(255).optional(),
})

type FormValues = z.infer<typeof schema>

export interface TagFormValues {
  id?: string
  name: string
  color: string
  description?: string | null
}

interface TagFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: TagFormValues
}

const COLOR_PRESETS = [
  '#1B4FA8',
  '#4F8EF7',
  '#0F3272',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#0284C7',
  '#7C3AED',
  '#DB2777',
  '#64748B',
]

export function TagFormDialog({ open, onOpenChange, initial }: TagFormDialogProps) {
  const qc = useQueryClient()
  const isEdit = Boolean(initial?.id)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      color: initial?.color ?? '#1B4FA8',
      description: initial?.description ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name ?? '',
        color: initial?.color ?? '#1B4FA8',
        description: initial?.description ?? '',
      })
    }
  }, [open, initial, form])

  const save = useMutation({
    mutationFn: async (data: FormValues) => {
      if (isEdit && initial?.id) {
        const res = await api.put(`/tags/${initial.id}`, data)
        return res.data
      }
      const res = await api.post('/tags', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success(isEdit ? 'Tag atualizada' : 'Tag criada')
      onOpenChange(false)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const color = form.watch('color')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tag' : 'Nova tag'}</DialogTitle>
          <DialogDescription>
            Tags são usadas para segmentar contatos e definir audiências de campanhas.
          </DialogDescription>
        </DialogHeader>

        <form
          id="tag-form"
          onSubmit={form.handleSubmit((d) => save.mutate(d))}
          className="space-y-4"
        >
          <div>
            <label className="label" htmlFor="tag-name">
              Nome
            </label>
            <input
              id="tag-name"
              className="input"
              placeholder="ex: Grupo SNI São Paulo"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="label">Cor</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-10 w-12 cursor-pointer rounded border border-border"
                {...form.register('color')}
              />
              <input className="input flex-1 uppercase" {...form.register('color')} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-full border border-border ring-offset-1 transition hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? '2px solid #1B4FA8' : 'none',
                  }}
                  onClick={() => form.setValue('color', c, { shouldDirty: true })}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
            </div>
            {form.formState.errors.color && (
              <p className="mt-1 text-xs text-danger">
                {form.formState.errors.color.message}
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="tag-description">
              Descrição (opcional)
            </label>
            <input
              id="tag-description"
              className="input"
              placeholder="Para que serve esta tag"
              {...form.register('description')}
            />
          </div>
        </form>

        <DialogFooter>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="tag-form"
            className="btn-primary"
            disabled={save.isPending}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar' : 'Criar tag'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
