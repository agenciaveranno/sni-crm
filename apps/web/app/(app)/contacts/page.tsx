'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Filter,
  Loader2,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { OptInBadge } from '@/components/ui/opt-in-badge'
import { TagBadge } from '@/components/ui/tag-badge'
import { api } from '@/lib/api'
import { formatPhone } from '@/lib/format'
import { useAuthStore } from '@/store/auth'

interface ContactRow {
  id: string
  name: string
  phone: string
  email: string | null
  optInStatus: 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'
  tags: { id: string; name: string; color: string }[]
  createdAt: string
}

interface ContactsResponse {
  data: ContactRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export default function ContactsPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState<'' | 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'>('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', { search, status, page }],
    queryFn: async () => {
      const res = await api.get<ContactsResponse>('/contacts', {
        params: {
          search: search || undefined,
          optInStatus: status || undefined,
          page,
          limit: 25,
        },
      })
      return res.data
    },
  })

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Contatos"
        description={
          data
            ? `${data.pagination.total} ${data.pagination.total === 1 ? 'contato' : 'contatos'} cadastrados`
            : 'Gerencie sua base de contatos.'
        }
        actions={
          can('CONTACTS', 'CREATE') ? (
            <Link href="/contacts/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Novo contato
            </Link>
          ) : null
        }
      />

      <div className="card mb-4 p-4">
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Buscar por nome, telefone ou e-mail"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as typeof status)
                setPage(1)
              }}
            >
              <option value="">Todos os status</option>
              <option value="OPTED_IN">Aceitou</option>
              <option value="PENDING">Pendente</option>
              <option value="OPTED_OUT">Recusou</option>
            </select>
            <button type="submit" className="btn-primary">
              Buscar
            </button>
          </div>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Nenhum contato encontrado"
          description="Cadastre seu primeiro contato ou importe uma planilha XLSX."
          action={
            can('CONTACTS', 'CREATE') ? (
              <Link href="/contacts/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Novo contato
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
                <th className="px-4 py-3 text-left">Telefone</th>
                <th className="px-4 py-3 text-left">Opt-in</th>
                <th className="px-4 py-3 text-left">Tags</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-bg/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-medium text-ink hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    {c.email && (
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {formatPhone(c.phone)}
                  </td>
                  <td className="px-4 py-3">
                    <OptInBadge status={c.optInStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <TagBadge key={t.id} name={t.name} color={t.color} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Página {data.pagination.page} de {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
