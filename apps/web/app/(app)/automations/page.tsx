'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2, Workflow } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type TriggerType =
  | 'OPT_OUT_RECEIVED'
  | 'TAG_ADDED'
  | 'CONTACT_CREATED'
  | 'INBOUND_MESSAGE'
type ActionType =
  | 'SEND_TEMPLATE_MESSAGE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'CALL_WEBHOOK'

const TRIGGER_LABEL: Record<TriggerType, string> = {
  OPT_OUT_RECEIVED: 'Contato pediu opt-out',
  TAG_ADDED: 'Tag adicionada ao contato',
  CONTACT_CREATED: 'Novo contato criado',
  INBOUND_MESSAGE: 'Mensagem recebida',
}
const ACTION_LABEL: Record<ActionType, string> = {
  SEND_TEMPLATE_MESSAGE: 'Enviar template',
  ADD_TAG: 'Adicionar tag',
  REMOVE_TAG: 'Remover tag',
  CALL_WEBHOOK: 'Chamar webhook',
}

interface Rule {
  id: string
  name: string
  description: string | null
  triggerType: TriggerType
  actionType: ActionType
  actionConfig: Record<string, unknown>
  active: boolean
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
}

export default function AutomationsPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Rule | null>(null)

  const rulesQuery = useQuery({
    queryKey: ['automations'],
    queryFn: async () => (await api.get<Rule[]>('/automations')).data,
  })

  const toggle = useMutation({
    mutationFn: async (r: Rule) =>
      (await api.patch(`/automations/${r.id}`, { active: !r.active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  })
  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/automations/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Regra excluída')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const items = rulesQuery.data ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Automações"
        description="Regras que disparam ações automáticas baseadas em eventos do CRM."
        actions={
          can('AUTOMATIONS', 'CREATE') ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Nova regra
            </button>
          ) : null
        }
      />

      {rulesQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 && !creating ? (
        <EmptyState
          icon={<Workflow className="h-10 w-10" />}
          title="Sem automações"
          description="Crie regras pra reagir a eventos: opt-out, novo contato, mensagens recebidas."
          action={
            can('AUTOMATIONS', 'CREATE') ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-4 w-4" />
                Nova regra
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {creating && (
            <NewRuleForm
              onCancel={() => setCreating(false)}
              onCreated={() => {
                setCreating(false)
                qc.invalidateQueries({ queryKey: ['automations'] })
              }}
            />
          )}
          {items.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-ink">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground">
                      {r.description}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge bg-info/10 text-info">
                      {TRIGGER_LABEL[r.triggerType]}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="badge bg-primary/10 text-primary">
                      {ACTION_LABEL[r.actionType]}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {r.executionCount} execução(ões)
                    {r.lastExecutedAt
                      ? ` · última em ${new Date(
                          r.lastExecutedAt,
                        ).toLocaleString('pt-BR')}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {can('AUTOMATIONS', 'EDIT') && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={() => toggle.mutate(r)}
                      />
                      Ativa
                    </label>
                  )}
                  {can('AUTOMATIONS', 'DELETE') && (
                    <button
                      type="button"
                      className="btn-ghost text-xs text-danger"
                      onClick={() => setToDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir regra?"
        description="A regra deixará de ser executada imediatamente."
        confirmText="Excluir"
        destructive
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}

function NewRuleForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] =
    useState<TriggerType>('OPT_OUT_RECEIVED')
  const [actionType, setActionType] = useState<ActionType>('ADD_TAG')
  const [actionConfigRaw, setActionConfigRaw] = useState('{}')

  const create = useMutation({
    mutationFn: async () => {
      let actionConfig: object = {}
      try {
        actionConfig = JSON.parse(actionConfigRaw || '{}')
      } catch {
        throw new Error('actionConfig deve ser JSON válido')
      }
      return (
        await api.post('/automations', {
          name: name.trim(),
          description: description.trim() || undefined,
          triggerType,
          actionType,
          actionConfig,
          active: true,
        })
      ).data
    },
    onSuccess: () => {
      toast.success('Regra criada')
      onCreated()
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const placeholder = (() => {
    switch (actionType) {
      case 'SEND_TEMPLATE_MESSAGE':
        return '{"whatsAppNumberId":"...","templateName":"opt_out_confirm","variables":{"body":["{{name}}"]}}'
      case 'ADD_TAG':
      case 'REMOVE_TAG':
        return '{"tagId":"clxxxx..."}'
      case 'CALL_WEBHOOK':
        return '{"url":"https://exemplo.com/hook"}'
    }
  })()

  return (
    <form
      className="card space-y-3 border-2 border-primary/30 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return toast.error('Nome obrigatório')
        create.mutate()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Descrição</label>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Quando</label>
          <select
            className="input"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value as TriggerType)}
          >
            {(Object.keys(TRIGGER_LABEL) as TriggerType[]).map((k) => (
              <option key={k} value={k}>
                {TRIGGER_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Faça</label>
          <select
            className="input"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
          >
            {(Object.keys(ACTION_LABEL) as ActionType[]).map((k) => (
              <option key={k} value={k}>
                {ACTION_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Configuração da ação (JSON)</label>
        <textarea
          className="input font-mono text-xs"
          rows={4}
          placeholder={placeholder}
          value={actionConfigRaw}
          onChange={(e) => setActionConfigRaw(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Exemplo: <code className="rounded bg-bg px-1 py-0.5">{placeholder}</code>
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Criar
        </button>
      </div>
    </form>
  )
}
