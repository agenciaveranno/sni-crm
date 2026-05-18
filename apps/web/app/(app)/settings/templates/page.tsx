'use client'

import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { TemplateStatusBadge } from '@/components/ui/template-status-badge'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface NumberOpt {
  id: string
  displayName: string
  phoneNumber: string
}

interface TemplateRow {
  id: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
  variables: string[]
  rejectionReason: string | null
  whatsAppNumber: { id: string; displayName: string; phoneNumber: string }
}

const CATEGORY_LABEL = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilitário',
  AUTHENTICATION: 'Autenticação',
} as const

export default function TemplatesPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const [numberId, setNumberId] = useState<string>('')

  const numbersQuery = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: async () =>
      (await api.get<NumberOpt[]>('/whatsapp-numbers')).data,
  })

  const templatesQuery = useQuery({
    queryKey: ['templates', numberId],
    queryFn: async () => {
      const res = await api.get<TemplateRow[]>('/templates', {
        params: numberId ? { numberId } : undefined,
      })
      return res.data
    },
  })

  const templates = templatesQuery.data ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Templates"
        description="Modelos de mensagem aprovados pela Meta para envio em campanhas."
        actions={
          can('SETTINGS_TEMPLATES', 'CREATE') ? (
            <Link href="/settings/templates/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Novo template
            </Link>
          ) : null
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-ink">Número:</label>
          <select
            className="input sm:max-w-xs"
            value={numberId}
            onChange={(e) => setNumberId(e.target.value)}
          >
            <option value="">Todos os números</option>
            {(numbersQuery.data ?? []).map((n) => (
              <option key={n.id} value={n.id}>
                {n.displayName} ({n.phoneNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {templatesQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Nenhum template cadastrado"
          description="Cadastre o primeiro template e envie para aprovação na Meta."
          action={
            can('SETTINGS_TEMPLATES', 'CREATE') ? (
              <Link href="/settings/templates/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Novo template
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
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Variáveis</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-bg/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/settings/templates/${t.id}`}
                      className="font-mono text-xs font-medium text-ink hover:text-primary"
                    >
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {t.language}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CATEGORY_LABEL[t.category]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.whatsAppNumber.displayName}
                  </td>
                  <td className="px-4 py-3">
                    {t.variables?.length ? (
                      <code className="rounded bg-bg px-1.5 py-0.5 text-xs">
                        {t.variables.length}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TemplateStatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
