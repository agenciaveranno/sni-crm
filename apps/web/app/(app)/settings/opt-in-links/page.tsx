'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface TagOpt {
  id: string
  name: string
}

interface LinkRow {
  id: string
  code: string
  description: string
  redirectUrl: string | null
  tagsToApply: string[]
  active: boolean
  usageCount: number
  createdAt: string
}

export default function OptInLinksPage() {
  const can = useAuthStore((s) => s.hasPermission)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<LinkRow | null>(null)

  const linksQuery = useQuery({
    queryKey: ['opt-in-links'],
    queryFn: async () => (await api.get<LinkRow[]>('/opt-in-links')).data,
  })
  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: async () => (await api.get<TagOpt[]>('/tags')).data,
  })

  const toggleActive = useMutation({
    mutationFn: async (link: LinkRow) =>
      (await api.patch(`/opt-in-links/${link.id}`, { active: !link.active }))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opt-in-links'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/opt-in-links/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opt-in-links'] })
      toast.success('Link excluído')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const items = linksQuery.data ?? []
  const tagName = (id: string) =>
    tagsQuery.data?.find((t) => t.id === id)?.name ?? id

  const baseUrl =
    typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Links de opt-in"
        description="Links públicos para captura de consentimento de novos contatos."
        actions={
          can('SETTINGS_OPT_IN_LINKS', 'CREATE') ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Novo link
            </button>
          ) : null
        }
      />

      {linksQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 && !creating ? (
        <EmptyState
          icon={<Link2 className="h-10 w-10" />}
          title="Nenhum link"
          description="Crie um link público para capturar opt-in de novos contatos via formulário."
          action={
            can('SETTINGS_OPT_IN_LINKS', 'CREATE') ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-4 w-4" />
                Novo link
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {creating && (
            <NewLinkForm
              tags={tagsQuery.data ?? []}
              onCancel={() => setCreating(false)}
              onCreated={() => {
                setCreating(false)
                qc.invalidateQueries({ queryKey: ['opt-in-links'] })
              }}
            />
          )}
          {items.map((l) => {
            const url = `${baseUrl}/opt-in/${l.code}`
            return (
              <div key={l.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{l.description}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <code className="rounded bg-bg px-1.5 py-0.5 font-mono">
                        {url}
                      </code>
                      <button
                        type="button"
                        className="btn-ghost h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(url)
                          toast.success('URL copiada')
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copiar
                      </button>
                      <span>· {l.usageCount} uso(s)</span>
                    </div>
                    {l.tagsToApply.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {l.tagsToApply.map((t) => (
                          <span
                            key={t}
                            className="badge bg-primary/10 text-primary"
                          >
                            {tagName(t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {can('SETTINGS_OPT_IN_LINKS', 'EDIT') && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={l.active}
                          onChange={() => toggleActive.mutate(l)}
                        />
                        Ativo
                      </label>
                    )}
                    {can('SETTINGS_OPT_IN_LINKS', 'DELETE') && (
                      <button
                        type="button"
                        className="btn-ghost text-xs text-danger"
                        onClick={() => setToDelete(l)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Excluir link?"
        description="O link deixará de funcionar imediatamente."
        confirmText="Excluir"
        destructive
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id)
          setToDelete(null)
        }}
      />
    </div>
  )
}

function NewLinkForm({
  tags,
  onCreated,
  onCancel,
}: {
  tags: TagOpt[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const [tagsToApply, setTagsToApply] = useState<string[]>([])

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post('/opt-in-links', {
          code: code.trim(),
          description: description.trim(),
          redirectUrl: redirectUrl.trim() || null,
          tagsToApply,
          active: true,
        })
      ).data,
    onSuccess: () => {
      toast.success('Link criado')
      onCreated()
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  return (
    <form
      className="card space-y-3 border-2 border-primary/30 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!code.trim() || !description.trim()) {
          toast.error('Código e descrição obrigatórios')
          return
        }
        create.mutate()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Código (sem espaços)</label>
          <input
            className="input font-mono text-sm"
            placeholder="ex: site-rodape"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))
            }
            required
          />
        </div>
        <div>
          <label className="label">Descrição</label>
          <input
            className="input text-sm"
            placeholder="ex: Rodapé do site"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="label">URL de redirect (opcional)</label>
        <input
          className="input text-sm"
          placeholder="https://seusite.com/obrigado"
          value={redirectUrl}
          onChange={(e) => setRedirectUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Tags aplicadas a quem se cadastrar</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => {
            const checked = tagsToApply.includes(t.id)
            return (
              <button
                type="button"
                key={t.id}
                className={`badge cursor-pointer ${
                  checked ? 'ring-2 ring-primary' : 'bg-bg text-muted-foreground'
                }`}
                onClick={() =>
                  setTagsToApply((c) =>
                    c.includes(t.id)
                      ? c.filter((x) => x !== t.id)
                      : [...c, t.id],
                  )
                }
              >
                {t.name}
              </button>
            )
          })}
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Cadastre tags antes
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Criar
        </button>
      </div>
    </form>
  )
}
