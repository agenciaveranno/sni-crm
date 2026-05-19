'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Square,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import {
  CampaignStatusBadge,
  type CampaignStatus,
} from '@/components/ui/campaign-status-badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface CampaignDetail {
  id: string
  name: string
  status: CampaignStatus
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  optOutCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  template: { id: string; name: string; language: string }
  whatsAppNumber: { id: string; displayName: string; phoneNumber: string }
  createdBy: { id: string; name: string; email: string }
  tagIds: string[]
}

interface RecipientRow {
  id: string
  phone: string
  status:
    | 'PENDING'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED'
    | 'OPTED_OUT'
    | 'SKIPPED'
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  errorMessage: string | null
  contact: { id: string; name: string; phone: string }
}

interface RecipientsPage {
  items: RecipientRow[]
  total: number
  page: number
  pageSize: number
}

const RECIPIENT_LABEL: Record<RecipientRow['status'], string> = {
  PENDING: 'Pendente',
  SENT: 'Enviada',
  DELIVERED: 'Entregue',
  READ: 'Lida',
  FAILED: 'Falhou',
  OPTED_OUT: 'Opt-out',
  SKIPPED: 'Pulado',
}

const RECIPIENT_STYLE: Record<RecipientRow['status'], string> = {
  PENDING: 'bg-bg text-muted-foreground',
  SENT: 'bg-info/10 text-info',
  DELIVERED: 'bg-primary/10 text-primary',
  READ: 'bg-success/10 text-success',
  FAILED: 'bg-danger/10 text-danger',
  OPTED_OUT: 'bg-warning/10 text-warning',
  SKIPPED: 'bg-bg text-muted-foreground',
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const can = useAuthStore((s) => s.hasPermission)
  const [confirmAction, setConfirmAction] = useState<null | {
    action: 'cancel' | 'delete'
    title: string
  }>(null)
  const [page, setPage] = useState(1)

  const campaign = useQuery({
    queryKey: ['campaign', params.id],
    queryFn: async () =>
      (await api.get<CampaignDetail>(`/campaigns/${params.id}`)).data,
    refetchInterval: (q) => {
      const status = q.state.data?.status
      return status === 'RUNNING' || status === 'SCHEDULED' ? 4000 : false
    },
  })

  const recipients = useQuery({
    queryKey: ['campaign', params.id, 'recipients', page],
    queryFn: async () =>
      (
        await api.get<RecipientsPage>(`/campaigns/${params.id}/recipients`, {
          params: { page, pageSize: 50 },
        })
      ).data,
  })

  const action = (path: string, successMsg: string) => ({
    mutationFn: async () =>
      (await api.post(`/campaigns/${params.id}/${path}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign', params.id] })
      toast.success(successMsg)
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err)),
  })
  const start = useMutation(action('start', 'Campanha iniciada'))
  const pause = useMutation(action('pause', 'Campanha pausada'))
  const resume = useMutation(action('resume', 'Campanha retomada'))
  const cancel = useMutation(action('cancel', 'Campanha cancelada'))

  const remove = useMutation({
    mutationFn: async () =>
      (await api.delete(`/campaigns/${params.id}`)).data,
    onSuccess: () => {
      toast.success('Campanha excluída')
      router.push('/campaigns')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  if (campaign.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!campaign.data) return null
  const c = campaign.data

  const canSend = can('CAMPAIGNS', 'SEND')
  const canDelete = can('CAMPAIGNS', 'DELETE')

  const pct =
    c.totalRecipients > 0
      ? Math.round((c.sentCount / c.totalRecipients) * 100)
      : 0

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={c.name}
        description={`Template ${c.template.name} (${c.template.language}) · ${c.whatsAppNumber.displayName}`}
        actions={
          <Link href="/campaigns" className="btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <CampaignStatusBadge status={c.status} />
        <span className="text-xs text-muted-foreground">
          criada por {c.createdBy.name} em{' '}
          {new Date(c.createdAt).toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        {(c.status === 'DRAFT' ||
          c.status === 'SCHEDULED' ||
          c.status === 'PAUSED') &&
          canSend && (
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() =>
                c.status === 'PAUSED' ? resume.mutate() : start.mutate()
              }
              disabled={start.isPending || resume.isPending}
            >
              <Play className="h-3.5 w-3.5" />
              {c.status === 'PAUSED' ? 'Retomar' : 'Iniciar'}
            </button>
          )}
        {c.status === 'RUNNING' && canSend && (
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => pause.mutate()}
            disabled={pause.isPending}
          >
            <Pause className="h-3.5 w-3.5" />
            Pausar
          </button>
        )}
        {(c.status === 'RUNNING' ||
          c.status === 'PAUSED' ||
          c.status === 'SCHEDULED') &&
          canSend && (
            <button
              type="button"
              className="btn-ghost text-sm text-danger"
              onClick={() =>
                setConfirmAction({
                  action: 'cancel',
                  title: 'Cancelar campanha?',
                })
              }
            >
              <Square className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
        {(c.status === 'DRAFT' ||
          c.status === 'COMPLETED' ||
          c.status === 'CANCELLED' ||
          c.status === 'FAILED') &&
          canDelete && (
            <button
              type="button"
              className="btn-ghost text-sm text-danger sm:ml-auto"
              onClick={() =>
                setConfirmAction({
                  action: 'delete',
                  title: 'Excluir campanha?',
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={c.totalRecipients} />
        <Stat label="Enviadas" value={c.sentCount} />
        <Stat label="Entregues" value={c.deliveredCount} />
        <Stat label="Lidas" value={c.readCount} />
        <Stat label="Falhas" value={c.failedCount} highlight="danger" />
      </div>

      <div className="card mt-4 p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span>
            {c.sentCount} / {c.totalRecipients} ({pct}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-bg">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold text-ink">
        Destinatários
      </h2>
      {recipients.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !recipients.data || recipients.data.items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted-foreground">
          Nenhum destinatário ainda — inicie a campanha para materializar a
          audiência.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Contato</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Enviada em</th>
                <th className="px-4 py-2 text-left">Erro</th>
              </tr>
            </thead>
            <tbody>
              {recipients.data.items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/contacts/${r.contact.id}`}
                      className="text-ink hover:text-primary"
                    >
                      {r.contact.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.contact.phone}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`badge ${RECIPIENT_STYLE[r.status]}`}
                    >
                      {r.status === 'READ' && (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      {RECIPIENT_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.sentAt
                      ? new Date(r.sentAt).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-danger">
                    {r.errorMessage ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recipients.data.total > recipients.data.pageSize && (
            <div className="flex items-center justify-between border-t border-border bg-bg/30 px-4 py-2 text-xs">
              <button
                type="button"
                className="btn-ghost"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Anterior
              </button>
              <span className="text-muted-foreground">
                Página {recipients.data.page} de{' '}
                {Math.ceil(recipients.data.total / recipients.data.pageSize)}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={
                  page >=
                  Math.ceil(recipients.data.total / recipients.data.pageSize)
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        description={
          confirmAction?.action === 'delete'
            ? 'A campanha e seus destinatários serão excluídos permanentemente.'
            : 'Os destinatários ainda não enviados serão marcados como pulados.'
        }
        confirmText={
          confirmAction?.action === 'delete' ? 'Excluir' : 'Cancelar campanha'
        }
        destructive
        onConfirm={() => {
          if (confirmAction?.action === 'cancel') cancel.mutate()
          if (confirmAction?.action === 'delete') remove.mutate()
          setConfirmAction(null)
        }}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: 'danger'
}) {
  return (
    <div className="card p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-semibold ${
          highlight === 'danger' && value > 0 ? 'text-danger' : 'text-ink'
        }`}
      >
        {value.toLocaleString('pt-BR')}
      </div>
    </div>
  )
}
