'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import {
  TagFormDialog,
  type TagFormValues,
} from '@/components/tags/tag-form-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { TagBadge } from '@/components/ui/tag-badge'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface TagRow {
  id: string
  name: string
  color: string
  description: string | null
  contactsCount: number
  createdAt: string
}

export default function TagsPage() {
  const qc = useQueryClient()
  const can = useAuthStore((s) => s.hasPermission)
  const [editing, setEditing] = useState<TagFormValues | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<TagRow | null>(null)

  const query = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await api.get<TagRow[]>('/tags')
      return res.data
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tags/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag excluída')
      setToDelete(null)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const tags = query.data ?? []

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tags"
        description="Crie e gerencie as tags usadas para segmentar contatos."
        actions={
          can('TAGS', 'CREATE') ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditing(undefined)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nova tag
            </button>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-10 w-10" />}
          title="Nenhuma tag cadastrada"
          description="Crie sua primeira tag para começar a segmentar contatos."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Tag</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Contatos</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <TagBadge name={t.name} color={t.color} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{t.contactsCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {can('TAGS', 'EDIT') && (
                        <button
                          type="button"
                          className="btn-ghost p-2"
                          onClick={() => {
                            setEditing(t)
                            setFormOpen(true)
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {can('TAGS', 'DELETE') && (
                        <button
                          type="button"
                          className="btn-ghost p-2 text-danger hover:bg-danger/5"
                          onClick={() => setToDelete(t)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TagFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Excluir tag "${toDelete?.name}"?`}
        description="A tag será removida de todos os contatos vinculados. Esta ação não pode ser desfeita."
        confirmText="Excluir"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  )
}
