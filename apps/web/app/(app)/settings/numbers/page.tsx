'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { QualityBadge } from '@/components/ui/quality-badge'
import { api, apiErrorMessage } from '@/lib/api'
import { formatDate, formatPhone } from '@/lib/format'

interface WhatsAppNumberRow {
  id: string
  displayName: string
  phoneNumber: string
  phoneNumberId: string
  wabaId: string
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
  messagingLimit: number
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  isDefault: boolean
  lastSyncAt: string | null
}

export default function NumbersPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: async () =>
      (await api.get<WhatsAppNumberRow[]>('/whatsapp-numbers')).data,
  })

  const sync = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/whatsapp-numbers/${id}/sync`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      toast.success('Sincronização disparada')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/whatsapp-numbers/${id}/set-default`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      toast.success('Número padrão atualizado')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const numbers = data ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Números WhatsApp"
        description="Cadastre os números (WABAs) usados para enviar mensagens via Meta Cloud API."
        actions={
          <Link href="/settings/numbers/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Cadastrar número
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : numbers.length === 0 ? (
        <EmptyState
          icon={<Phone className="h-10 w-10" />}
          title="Nenhum número cadastrado"
          description="Cadastre o primeiro número de WhatsApp Business para começar a disparar campanhas."
          action={
            <Link href="/settings/numbers/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              Cadastrar número
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {numbers.map((n) => (
            <div key={n.id} className="card p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">
                      {n.displayName}
                    </h3>
                    {n.isDefault && (
                      <span className="badge bg-primary/10 text-primary">
                        <Star className="h-3 w-3" /> Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                    {formatPhone(n.phoneNumber)}
                  </p>
                </div>
                <QualityBadge rating={n.qualityRating} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Phone Number ID</dt>
                  <dd className="font-mono">{n.phoneNumberId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">WABA ID</dt>
                  <dd className="font-mono">{n.wabaId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Limite diário</dt>
                  <dd>{n.messagingLimit.toLocaleString('pt-BR')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Último sync</dt>
                  <dd>{n.lastSyncAt ? formatDate(n.lastSyncAt) : 'Nunca'}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <Link
                  href={`/settings/numbers/${n.id}`}
                  className="btn-ghost text-sm"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => sync.mutate(n.id)}
                  disabled={sync.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sincronizar
                </button>
                {!n.isDefault && (
                  <button
                    type="button"
                    className="btn-ghost text-sm"
                    onClick={() => setDefault.mutate(n.id)}
                    disabled={setDefault.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Tornar padrão
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
