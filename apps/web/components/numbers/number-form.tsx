'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, apiErrorMessage } from '@/lib/api'

const createSchema = z.object({
  displayName: z.string().min(2),
  phoneNumber: z.string().min(8),
  phoneNumberId: z.string().min(5),
  wabaId: z.string().min(5),
  accessToken: z.string().min(20),
  webhookVerifyToken: z.string().min(8),
  isDefault: z.boolean().optional(),
})

const editSchema = z.object({
  displayName: z.string().min(2),
  accessToken: z.string().optional().or(z.literal('')),
  webhookVerifyToken: z.string().optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
})

interface NumberFormProps {
  numberId?: string
  initial?: {
    displayName: string
    phoneNumber?: string
    phoneNumberId?: string
    wabaId?: string
    isDefault?: boolean
  }
}

export function NumberForm({ numberId, initial }: NumberFormProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = Boolean(numberId)
  const [showToken, setShowToken] = useState(false)

  const form = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      displayName: initial?.displayName ?? '',
      phoneNumber: initial?.phoneNumber ?? '',
      phoneNumberId: initial?.phoneNumberId ?? '',
      wabaId: initial?.wabaId ?? '',
      accessToken: '',
      webhookVerifyToken: '',
      isDefault: initial?.isDefault ?? false,
    },
  })

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (isEdit && numberId) {
        const payload: Record<string, unknown> = {
          displayName: data.displayName,
          isDefault: data.isDefault,
        }
        if (data.accessToken) payload.accessToken = data.accessToken
        if (data.webhookVerifyToken)
          payload.webhookVerifyToken = data.webhookVerifyToken
        const res = await api.put(`/whatsapp-numbers/${numberId}`, payload)
        return res.data
      }
      const res = await api.post('/whatsapp-numbers', data)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      toast.success(isEdit ? 'Número atualizado' : 'Número cadastrado')
      router.push('/settings/numbers')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  return (
    <form
      onSubmit={form.handleSubmit((d) => save.mutate(d as Record<string, unknown>))}
      className="space-y-6"
    >
      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">Identificação</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Nome de exibição *</label>
            <input
              className="input"
              placeholder="SNI Brasil — Comunicados"
              {...form.register('displayName')}
            />
          </div>
          {!isEdit && (
            <div>
              <label className="label">Telefone *</label>
              <input
                className="input"
                placeholder="+55 11 99999-8888"
                {...form.register('phoneNumber')}
              />
            </div>
          )}
        </div>
      </div>

      {!isEdit && (
        <div className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">
            IDs da Meta (Cloud API)
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Obtenha esses IDs no Meta Business Manager → WhatsApp Manager → seu número.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Phone Number ID *</label>
              <input className="input font-mono" {...form.register('phoneNumberId')} />
            </div>
            <div>
              <label className="label">WhatsApp Business Account ID *</label>
              <input className="input font-mono" {...form.register('wabaId')} />
            </div>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-ink">Credenciais</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          O Access Token é armazenado cifrado com AES-256. Deixe em branco ao
          editar para manter o token atual.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label">
              System User Access Token {isEdit ? '(opcional)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                className="input pr-10 font-mono"
                placeholder={
                  isEdit ? 'Deixe em branco para manter' : 'EAA...'
                }
                {...form.register('accessToken')}
              />
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-bg"
                aria-label={showToken ? 'Ocultar' : 'Mostrar'}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="label">
              Webhook Verify Token {isEdit ? '(opcional)' : '*'}
            </label>
            <input
              className="input font-mono"
              placeholder={
                isEdit ? 'Deixe em branco para manter' : 'token-aleatorio-seguro'
              }
              {...form.register('webhookVerifyToken')}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use este mesmo valor ao configurar o webhook na Meta.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            {...form.register('isDefault')}
          />
          <div>
            <span className="text-sm font-medium text-ink">
              Definir como número padrão
            </span>
            <p className="text-xs text-muted-foreground">
              Será pré-selecionado na criação de campanhas.
            </p>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Salvar alterações' : 'Cadastrar número'}
        </button>
      </div>
    </form>
  )
}
