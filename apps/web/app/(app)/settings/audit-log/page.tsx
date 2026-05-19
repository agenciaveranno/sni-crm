'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'

interface AuditEntry {
  id: string
  userId: string
  userEmail: string
  action: string
  entity: string
  entityId: string | null
  dataBefore: unknown
  dataAfter: unknown
  ip: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
}

interface ListResponse {
  items: AuditEntry[]
  total: number
  page: number
  pageSize: number
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, entity, action],
    queryFn: async () =>
      (
        await api.get<ListResponse>('/audit-log', {
          params: {
            page,
            pageSize: 50,
            ...(entity ? { entity } : {}),
            ...(action ? { action } : {}),
          },
        })
      ).data,
  })

  const items = data?.items ?? []
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Log de auditoria"
        description="Histórico de ações sensíveis dos usuários no sistema."
      />

      <div className="card mb-4 flex flex-wrap gap-2 p-3">
        <input
          className="input max-w-[200px] text-sm"
          placeholder="Entidade (ex: Campaign)"
          value={entity}
          onChange={(e) => {
            setPage(1)
            setEntity(e.target.value)
          }}
        />
        <input
          className="input max-w-[200px] text-sm"
          placeholder="Ação (ex: CREATE)"
          value={action}
          onChange={(e) => {
            setPage(1)
            setAction(e.target.value)
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-10 w-10" />}
          title="Sem registros"
          description="Ações registradas aparecem aqui assim que ocorrem."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Quando</th>
                <th className="px-4 py-2 text-left">Usuário</th>
                <th className="px-4 py-2 text-left">Ação</th>
                <th className="px-4 py-2 text-left">Entidade</th>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-bg/40"
                >
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div className="font-medium text-ink">{e.user.name}</div>
                    <div className="text-muted-foreground">{e.userEmail}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.entity}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                    {e.entityId ?? '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {e.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
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
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
