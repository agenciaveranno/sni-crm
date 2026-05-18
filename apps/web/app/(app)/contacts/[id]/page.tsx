'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Phone,
  Plus,
  ShieldOff,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OptInBadge } from '@/components/ui/opt-in-badge'
import { TagBadge } from '@/components/ui/tag-badge'
import { api, apiErrorMessage } from '@/lib/api'
import { formatDate, formatPhone } from '@/lib/format'
import { initials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface ContactDetail {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  optInStatus: 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'
  optInMethod: string | null
  optInAt: string | null
  createdAt: string
  updatedAt: string
  tags: { id: string; name: string; color: string }[]
}

interface TagOption {
  id: string
  name: string
  color: string
}

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const qc = useQueryClient()
  const can = useAuthStore((s) => s.hasPermission)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [toDelete, setToDelete] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => (await api.get<ContactDetail>(`/contacts/${id}`)).data,
  })

  const allTagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<TagOption[]>('/tags')).data,
    enabled: tagPickerOpen,
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['contact', id] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  const optIn = useMutation({
    mutationFn: async () => (await api.put(`/contacts/${id}/opt-in`)).data,
    onSuccess: () => {
      invalidate()
      toast.success('Opt-in registrado')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const optOut = useMutation({
    mutationFn: async () => (await api.put(`/contacts/${id}/opt-out`)).data,
    onSuccess: () => {
      invalidate()
      toast.success('Opt-out registrado')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      await api.delete(`/contacts/${id}/tags/${tagId}`)
    },
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const addTag = useMutation({
    mutationFn: async (tagId: string) => {
      await api.post(`/contacts/${id}/tags`, { tagIds: [tagId] })
    },
    onSuccess: () => {
      invalidate()
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/contacts/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contato excluído')
      router.push('/contacts')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-center text-muted-foreground">
        Contato não encontrado.{' '}
        <Link href="/contacts" className="text-primary underline">
          Voltar
        </Link>
      </div>
    )
  }

  const availableTags =
    allTagsQuery.data?.filter((t) => !data.tags.some((dt) => dt.id === t.id)) ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Contatos
      </Link>

      <PageHeader
        title={data.name}
        description={`Cadastrado em ${formatDate(data.createdAt)}`}
        actions={
          <>
            {can('CONTACTS', 'EDIT') && (
              <Link href={`/contacts/${id}/edit`} className="btn-secondary">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            )}
            {can('CONTACTS', 'DELETE') && (
              <button
                type="button"
                onClick={() => setToDelete(true)}
                className="btn-ghost text-danger hover:bg-danger/5"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
                {initials(data.name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{formatPhone(data.phone)}</span>
                </div>
                {data.email && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {data.email}
                  </div>
                )}
              </div>
            </div>

            {data.notes && (
              <div className="mt-6">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Observações
                </h3>
                <p className="whitespace-pre-wrap text-sm text-ink">{data.notes}</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">Tags</h3>
              {can('CONTACTS', 'EDIT') && (
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() => setTagPickerOpen((o) => !o)}
                >
                  <Plus className="h-4 w-4" />
                  {tagPickerOpen ? 'Fechar' : 'Adicionar'}
                </button>
              )}
            </div>

            {data.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma tag atribuída.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1">
                    <TagBadge name={t.name} color={t.color} />
                    {can('CONTACTS', 'EDIT') && (
                      <button
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-bg hover:text-danger"
                        onClick={() => removeTag.mutate(t.id)}
                        aria-label={`Remover tag ${t.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {tagPickerOpen && (
              <div className="mt-4 border-t border-border pt-4">
                {allTagsQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todas as tags já foram aplicadas.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="transition hover:scale-105"
                        onClick={() => addTag.mutate(t.id)}
                      >
                        <TagBadge name={t.name} color={t.color} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Consentimento (LGPD)
            </h3>
            <div className="mb-4 flex items-center justify-between">
              <OptInBadge status={data.optInStatus} />
              {data.optInAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(data.optInAt)}
                </span>
              )}
            </div>
            {data.optInMethod && (
              <p className="mb-4 text-xs text-muted-foreground">
                Método: {data.optInMethod}
              </p>
            )}

            {can('CONTACTS', 'EDIT') && (
              <div className="flex flex-col gap-2">
                {data.optInStatus !== 'OPTED_IN' && (
                  <button
                    type="button"
                    className="btn-secondary justify-start"
                    onClick={() => optIn.mutate()}
                    disabled={optIn.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar opt-in manual
                  </button>
                )}
                {data.optInStatus !== 'OPTED_OUT' && (
                  <button
                    type="button"
                    className="btn-ghost justify-start text-danger hover:bg-danger/5"
                    onClick={() => optOut.mutate()}
                    disabled={optOut.isPending}
                  >
                    <ShieldOff className="h-4 w-4" />
                    Registrar opt-out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={toDelete}
        onOpenChange={setToDelete}
        title={`Excluir contato "${data.name}"?`}
        description="Esta ação remove o contato e todo o histórico vinculado. Não pode ser desfeita."
        confirmText="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
