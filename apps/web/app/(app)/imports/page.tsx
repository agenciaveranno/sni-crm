'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Upload } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type ImportStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'

interface ImportRow {
  id: string
  fileName: string
  status: ImportStatus
  totalRows: number
  successRows: number
  errorRows: number
  newContacts: number
  updatedContacts: number
  createdAt: string
}

const STATUS_LABEL: Record<ImportStatus, string> = {
  UPLOADED: 'Recebido',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  COMPLETED_WITH_ERRORS: 'Concluído (com erros)',
  FAILED: 'Falhou',
}

const STATUS_STYLE: Record<ImportStatus, string> = {
  UPLOADED: 'bg-bg text-muted-foreground',
  PROCESSING: 'bg-info/10 text-info',
  COMPLETED: 'bg-success/10 text-success',
  COMPLETED_WITH_ERRORS: 'bg-warning/10 text-warning',
  FAILED: 'bg-danger/10 text-danger',
}

export default function ImportsPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const { data, isLoading } = useQuery({
    queryKey: ['imports'],
    queryFn: async () => (await api.get<ImportRow[]>('/imports')).data,
  })

  const items = data ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Importações"
        description="Histórico de importações de contatos via CSV ou Excel."
        actions={
          can('IMPORTS', 'CREATE') ? (
            <Link href="/imports/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Nova importação
            </Link>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Upload className="h-10 w-10" />}
          title="Nenhuma importação ainda"
          description="Faça upload de um CSV ou Excel para adicionar contatos em massa."
          action={
            can('IMPORTS', 'CREATE') ? (
              <Link href="/imports/new" className="btn-primary">
                <Plus className="h-4 w-4" />
                Nova importação
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Arquivo</th>
                <th className="px-4 py-3 text-left">Linhas</th>
                <th className="px-4 py-3 text-left">Novos</th>
                <th className="px-4 py-3 text-left">Atualizados</th>
                <th className="px-4 py-3 text-left">Erros</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border last:border-0 hover:bg-bg/40"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{i.fileName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(i.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-4 py-3">{i.totalRows.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-success">{i.newContacts}</td>
                  <td className="px-4 py-3 text-info">{i.updatedContacts}</td>
                  <td className="px-4 py-3 text-danger">{i.errorRows}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_STYLE[i.status]}`}>
                      {STATUS_LABEL[i.status]}
                    </span>
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
