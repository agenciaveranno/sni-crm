'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { api, apiErrorMessage } from '@/lib/api'

interface NumberOpt {
  id: string
  displayName: string
  phoneNumber: string
}
interface TemplateOpt {
  id: string
  name: string
  language: string
  status: string
  whatsAppNumberId: string
  variables: string[]
  components: Array<{ type: string; text?: string }>
}
interface TagOpt {
  id: string
  name: string
  color: string
}

type ParamSpec =
  | { kind: 'literal'; value: string }
  | { kind: 'field'; field: 'name' | 'phone' | 'email' }

const FIELD_LABEL = {
  name: 'Nome do contato',
  phone: 'Telefone',
  email: 'E-mail',
} as const

function extractBodyText(components: TemplateOpt['components']): string {
  return components.find((c) => c.type?.toUpperCase() === 'BODY')?.text ?? ''
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [numberId, setNumberId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [bodyParams, setBodyParams] = useState<ParamSpec[]>([])

  const numbersQuery = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: async () => (await api.get<NumberOpt[]>('/whatsapp-numbers')).data,
  })

  const templatesQuery = useQuery({
    queryKey: ['templates', numberId],
    enabled: !!numberId,
    queryFn: async () =>
      (
        await api.get<TemplateOpt[]>('/templates', {
          params: { numberId },
        })
      ).data,
  })

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<TagOpt[]>('/tags')).data,
  })

  const audienceQuery = useQuery({
    queryKey: ['audience-count', tagIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('optInStatus', 'OPTED_IN')
      params.set('pageSize', '1')
      tagIds.forEach((t) => params.append('tagIds', t))
      const res = await api.get<{ total: number }>(
        `/contacts?${params.toString()}`,
      )
      return res.data.total
    },
  })

  const template = useMemo(
    () => (templatesQuery.data ?? []).find((t) => t.id === templateId),
    [templatesQuery.data, templateId],
  )
  const bodyText = template ? extractBodyText(template.components) : ''
  const numBodyVars = template?.variables.length ?? 0

  if (bodyParams.length !== numBodyVars) {
    setBodyParams(
      Array.from(
        { length: numBodyVars },
        (_, i) => bodyParams[i] ?? ({ kind: 'literal', value: '' } as ParamSpec),
      ),
    )
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await api.post('/campaigns', {
        name,
        whatsAppNumberId: numberId,
        templateId,
        tagIds,
        templateVariables: { bodyParams },
        scheduledAt: scheduledAt
          ? new Date(scheduledAt).toISOString()
          : undefined,
      })
      return res.data
    },
    onSuccess: (data: { id: string }) => {
      toast.success('Campanha criada')
      router.push(`/campaigns/${data.id}`)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const approvedTemplates = (templatesQuery.data ?? []).filter(
    (t) => t.status === 'APPROVED',
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova campanha"
        description="Crie um disparo em massa de template aprovado."
        actions={
          <Link href="/campaigns" className="btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return toast.error('Informe o nome da campanha')
          if (!numberId) return toast.error('Selecione um número WhatsApp')
          if (!templateId) return toast.error('Selecione um template aprovado')
          create.mutate()
        }}
        className="space-y-6"
      >
        <div className="card space-y-4 p-4">
          <div>
            <label className="label">Nome interno</label>
            <input
              className="input"
              placeholder="Ex.: Newsletter Maio 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Número WhatsApp</label>
            <select
              className="input"
              value={numberId}
              onChange={(e) => {
                setNumberId(e.target.value)
                setTemplateId('')
              }}
              required
            >
              <option value="">— selecione —</option>
              {(numbersQuery.data ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.displayName} ({n.phoneNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Template (somente APPROVED)</label>
            <select
              className="input"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              disabled={!numberId}
            >
              <option value="">— selecione —</option>
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
            {numberId && approvedTemplates.length === 0 && (
              <p className="mt-1 text-xs text-warning">
                Nenhum template APPROVED nesse número.
              </p>
            )}
          </div>

          {bodyText && (
            <div className="rounded border border-dashed border-border bg-bg/40 p-3 text-xs">
              <div className="mb-1 font-semibold text-muted-foreground">
                Body do template:
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px]">
                {bodyText}
              </pre>
            </div>
          )}

          {numBodyVars > 0 && (
            <div className="space-y-2">
              <label className="label">
                Variáveis do body ({numBodyVars})
              </label>
              {Array.from({ length: numBodyVars }, (_, i) => {
                const param = bodyParams[i] ?? {
                  kind: 'literal' as const,
                  value: '',
                }
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 rounded border border-border p-2"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {`{{${i + 1}}}`}
                    </span>
                    <select
                      className="input max-w-[180px] text-xs"
                      value={param.kind}
                      onChange={(e) => {
                        const kind = e.target.value as 'literal' | 'field'
                        const next = [...bodyParams]
                        next[i] =
                          kind === 'literal'
                            ? { kind: 'literal', value: '' }
                            : { kind: 'field', field: 'name' }
                        setBodyParams(next)
                      }}
                    >
                      <option value="literal">Texto fixo</option>
                      <option value="field">Campo do contato</option>
                    </select>
                    {param.kind === 'literal' ? (
                      <input
                        className="input flex-1 text-xs"
                        placeholder="valor que vai pra todos"
                        value={param.value}
                        onChange={(e) => {
                          const next = [...bodyParams]
                          next[i] = { kind: 'literal', value: e.target.value }
                          setBodyParams(next)
                        }}
                      />
                    ) : (
                      <select
                        className="input flex-1 text-xs"
                        value={param.field}
                        onChange={(e) => {
                          const next = [...bodyParams]
                          next[i] = {
                            kind: 'field',
                            field: e.target.value as 'name' | 'phone' | 'email',
                          }
                          setBodyParams(next)
                        }}
                      >
                        {(Object.keys(FIELD_LABEL) as Array<keyof typeof FIELD_LABEL>).map(
                          (k) => (
                            <option key={k} value={k}>
                              {FIELD_LABEL[k]}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card space-y-3 p-4">
          <label className="label">Audiência (tags)</label>
          <p className="text-xs text-muted-foreground">
            Selecione uma ou mais tags. Se nenhuma for marcada, a campanha vai
            para <strong>todos</strong> os contatos com opt-in.
          </p>
          <div className="flex flex-wrap gap-2">
            {(tagsQuery.data ?? []).map((t) => {
              const checked = tagIds.includes(t.id)
              return (
                <button
                  type="button"
                  key={t.id}
                  className={`badge cursor-pointer ${
                    checked
                      ? 'ring-2 ring-primary'
                      : 'bg-bg text-muted-foreground hover:bg-bg/60'
                  }`}
                  style={
                    checked
                      ? { backgroundColor: t.color + '20', color: t.color }
                      : undefined
                  }
                  onClick={() =>
                    setTagIds((curr) =>
                      curr.includes(t.id)
                        ? curr.filter((x) => x !== t.id)
                        : [...curr, t.id],
                    )
                  }
                >
                  {t.name}
                </button>
              )
            })}
            {(tagsQuery.data ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">
                Nenhuma tag cadastrada
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Audiência estimada:{' '}
            <strong className="text-ink">
              {audienceQuery.isLoading
                ? '...'
                : (audienceQuery.data ?? 0).toLocaleString('pt-BR')}
            </strong>{' '}
            contato(s) com opt-in
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <label className="label">Agendamento (opcional)</label>
          <input
            type="datetime-local"
            className="input max-w-[260px]"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Se em branco, a campanha fica em DRAFT e você inicia manualmente.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/campaigns" className="btn-ghost">
            Cancelar
          </Link>
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Criar campanha
          </button>
        </div>
      </form>
    </div>
  )
}
