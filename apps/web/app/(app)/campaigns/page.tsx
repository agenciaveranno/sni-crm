'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Send } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import {
  CampaignStatusBadge,
  type CampaignStatus,
} from '@/components/ui/campaign-status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface CampaignRow {
  id: string
  name: string
  status: CampaignStatus
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  template: { id: string; name: string }
  whatsAppNumber: { id: string; displayName: string }
  createdBy: { id: string; name: string }
}

interface ListResponse {
  items: CampaignRow[]
  total: number
  page: number
  pageSize: number
}

const STATUSES: CampaignStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]

export default function CampaignsPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const [status, setStatus] = useState<CampaignStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', status],
    queryFn: async () =>
      (
        await api.get<ListResponse>('/campaigns', {
          params: { ...(status ? { status } : {}) },
        })
      ).data,
  })

  const items = data?.items ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Campanhas"
        description="Disparo em massa de templates aprovados para audiências segmentadas por tag."
        actions={
          can('CAMPAIGNS', 'CREATE') ? (
            <Link href="/campaigns/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nova campanha
            </Link>
          ) : null
        }
      />

      <div className="card mb-4 flex gap-2 p-3">
        <button
          type="button"
          className={`btn-ghost text-sm ${status === '' ? 'bg-bg text-ink' : ''}`}
          onClick={() => setStatus('')}
        >
          Todas
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn-ghost text-sm ${status === s ? 'bg-bg text-ink' : ''}`}
            onClick={() => setStatus(s)}
          >
            <CampaignStatusBadge status={s} />
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Send className="h-10 w-10" />}
          title="Nenhuma campanha"
          description="Crie sua primeira campanha selecionando um template aprovado."
          action={
            can('CAMPAIGNS', 'CREATE') ? (
              <Link href="/campaigns/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Nova campanha
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Template</th>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Progresso</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const pct =
                  c.totalRecipients > 0
                    ? Math.round((c.sentCount / c.totalRecipients) * 100)
                    : 0
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-bg/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-ink hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        criada por {c.createdBy.name} ·{' '}
                        {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.template.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.whatsAppNumber.displayName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">
                        {c.sentCount} / {c.totalRecipients} ({pct}%)
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-bg">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CampaignStatusBadge status={c.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
