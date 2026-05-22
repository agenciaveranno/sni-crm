'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  CheckCheck,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { OptInBadge } from '@/components/ui/opt-in-badge'
import { api, apiErrorMessage } from '@/lib/api'
import { formatPhone, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

type Direction = 'INBOUND' | 'OUTBOUND'
type OptInStatus = 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'

interface Conversation {
  contact: {
    id: string
    name: string
    phone: string
    optInStatus: OptInStatus
  }
  lastMessage: {
    id: string
    direction: Direction
    messageType: string
    content: Record<string, unknown>
    receivedAt: string
    status: string
  } | null
  unreadCount: number
  lastMessageAt: string | null
}

interface Message {
  id: string
  direction: Direction
  messageType: string
  content: Record<string, unknown>
  status: string
  receivedAt: string
}

function preview(content: Record<string, unknown>, type: string): string {
  if (type === 'TEXT' && typeof content.text === 'string') return content.text
  if (type === 'IMAGE') return '🖼️ Imagem'
  if (type === 'DOCUMENT') return '📄 Documento'
  if (type === 'AUDIO') return '🎵 Áudio'
  if (type === 'VIDEO') return '🎬 Vídeo'
  if (type === 'STICKER') return '✨ Sticker'
  if (type === 'LOCATION') return '📍 Localização'
  if (type === 'TEMPLATE') return '📋 Template'
  return type
}

interface TemplateOption {
  id: string
  name: string
  language: string
  status: string
  whatsAppNumber: { id: string }
  components: MetaComponent[]
}

interface MetaComponent {
  type: string
  format?: string
  text?: string
  buttons?: Array<{ type: string; text?: string; url?: string }>
}

function countVars(text: string | undefined): number {
  if (!text) return 0
  return new Set((text.match(/\{\{\s*\d+\s*\}\}/g) ?? []).map((s) => s)).size
}

function templateInputs(template: TemplateOption) {
  let headerVarCount = 0
  let bodyVarCount = 0
  const buttonVars: Array<{ index: number; url: string }> = []
  for (const c of template.components ?? []) {
    const t = c.type?.toUpperCase()
    if (t === 'HEADER' && c.format?.toUpperCase() === 'TEXT') {
      headerVarCount = countVars(c.text)
    }
    if (t === 'BODY') {
      bodyVarCount = countVars(c.text)
    }
    if (t === 'BUTTONS') {
      ;(c.buttons ?? []).forEach((b, idx) => {
        if (b.type?.toUpperCase() === 'URL' && (b.url ?? '').includes('{{')) {
          buttonVars.push({ index: idx, url: b.url ?? '' })
        }
      })
    }
  }
  return { headerVarCount, bodyVarCount, buttonVars }
}

interface ContactLite {
  id: string
  name: string
  phone: string
  optInStatus: OptInStatus
}

export default function InboxPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [newConvOpen, setNewConvOpen] = useState(false)
  /** Contato escolhido via "Nova conversa" que ainda não tem conversation no inbox. */
  const [pinnedContact, setPinnedContact] = useState<ContactLite | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversations = useQuery({
    queryKey: ['inbox', 'conversations'],
    queryFn: async () =>
      (await api.get<Conversation[]>('/inbox/conversations')).data,
    refetchInterval: 15_000,
  })

  const messages = useQuery({
    queryKey: ['inbox', 'messages', selectedId],
    queryFn: async () =>
      (await api.get<Message[]>(`/contacts/${selectedId}/messages`)).data,
    enabled: !!selectedId,
    refetchInterval: 15_000,
  })

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedId) throw new Error('Selecione um contato')
      await api.post(`/contacts/${selectedId}/messages`, { body })
    },
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['inbox', 'messages', selectedId] })
      qc.invalidateQueries({ queryKey: ['inbox', 'conversations'] })
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const sendTemplate = useMutation({
    mutationFn: async (args: {
      templateId: string
      headerParams: string[]
      bodyParams: string[]
      buttonParams: Array<{ index: string; value: string }>
    }) => {
      if (!selectedId) throw new Error('Selecione um contato')
      await api.post(`/contacts/${selectedId}/messages`, args)
    },
    onSuccess: () => {
      setTemplateOpen(false)
      qc.invalidateQueries({ queryKey: ['inbox', 'messages', selectedId] })
      qc.invalidateQueries({ queryKey: ['inbox', 'conversations'] })
      toast.success('Template enviado')
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const selectedFromList = conversations.data?.find(
    (c) => c.contact.id === selectedId,
  )
  const selected: Conversation | undefined =
    selectedFromList ??
    (pinnedContact && pinnedContact.id === selectedId
      ? {
          contact: pinnedContact,
          lastMessage: null,
          unreadCount: 0,
          lastMessageAt: null,
        }
      : undefined)

  const pickContactForNewConv = (contact: ContactLite) => {
    setPinnedContact(contact)
    setSelectedId(contact.id)
    setNewConvOpen(false)
    // Fora da janela de 24h só dá pra falar via template — já abre o modal.
    setTemplateOpen(true)
  }

  // Auto-select first conversation when list loads
  useEffect(() => {
    if (!selectedId && conversations.data?.length) {
      setSelectedId(conversations.data[0].contact.id)
    }
  }, [conversations.data, selectedId])

  // Quando o contato pinado já aparece na lista de conversations
  // (depois de mandar o primeiro template), limpa o pin pra não duplicar.
  useEffect(() => {
    if (
      pinnedContact &&
      conversations.data?.some((c) => c.contact.id === pinnedContact.id)
    ) {
      setPinnedContact(null)
    }
  }, [conversations.data, pinnedContact])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.data])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    send.mutate(text)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title="Inbox"
        description="Conversas com seus contatos via WhatsApp."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setNewConvOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        }
      />

      {conversations.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !conversations.data?.length && !pinnedContact ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="Nenhuma conversa ainda"
          description="Clique em Nova conversa pra falar com um contato que já deu opt-in, ou aguarde mensagens recebidas."
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => setNewConvOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nova conversa
            </button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="card flex w-80 flex-col overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
              {(conversations.data?.length ?? 0) + (pinnedContact ? 1 : 0)} conversas
            </div>
            <div className="flex-1 overflow-y-auto">
              {pinnedContact && (
                <button
                  key={pinnedContact.id}
                  type="button"
                  onClick={() => setSelectedId(pinnedContact.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left hover:bg-surface/60',
                    selectedId === pinnedContact.id && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {pinnedContact.name}
                    </span>
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      novo
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Nova conversa · {formatPhone(pinnedContact.phone)}
                  </div>
                </button>
              )}
              {(conversations.data ?? []).map((c) => (
                <button
                  key={c.contact.id}
                  type="button"
                  onClick={() => setSelectedId(c.contact.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left hover:bg-surface/60',
                    selectedId === c.contact.id && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {c.contact.name}
                    </span>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {c.lastMessage
                        ? (c.lastMessage.direction === 'OUTBOUND' ? '↗ ' : '') +
                          preview(c.lastMessage.content, c.lastMessage.messageType)
                        : 'Sem mensagens'}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="card flex min-w-0 flex-1 flex-col overflow-hidden p-0">
            {selected ? (
              <>
                <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink">
                      {selected.contact.name}
                    </h2>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {formatPhone(selected.contact.phone)}
                    </p>
                  </div>
                  <OptInBadge status={selected.contact.optInStatus} />
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
                  {messages.isLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !messages.data?.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sem mensagens neste contato.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[...messages.data].reverse().map((m) => (
                        <MessageBubble key={m.id} message={m} />
                      ))}
                    </div>
                  )}
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="flex items-end gap-2 border-t border-border px-5 py-3"
                >
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setTemplateOpen(true)}
                    title="Enviar template aprovado pela Meta (necessário fora da janela 24h)"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit(e)
                      }
                    }}
                    placeholder="Digite sua mensagem… (Enter para enviar, Shift+Enter para nova linha)"
                    rows={2}
                    className="min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    disabled={send.isPending}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={send.isPending || !draft.trim()}
                  >
                    {send.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar
                  </button>
                </form>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <MessageSquare className="mr-2 h-5 w-5" /> Selecione uma conversa
              </div>
            )}
          </section>
        </div>
      )}

      {templateOpen && selectedId && (
        <TemplateSendDialog
          contactId={selectedId}
          onClose={() => setTemplateOpen(false)}
          onSend={(args) => sendTemplate.mutate(args)}
          isPending={sendTemplate.isPending}
        />
      )}

      {newConvOpen && (
        <NewConversationDialog
          onClose={() => setNewConvOpen(false)}
          onPick={pickContactForNewConv}
        />
      )}
    </div>
  )
}

function NewConversationDialog({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (c: ContactLite) => void
}) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const results = useQuery({
    queryKey: ['contacts', 'opted-in', debounced],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        optInStatus: 'OPTED_IN',
        page: 1,
        limit: 30,
        sortBy: 'name',
        sortOrder: 'asc',
      }
      if (debounced.trim()) params.search = debounced.trim()
      const res = await api.get<{
        data: ContactLite[]
        pagination: { total: number }
      }>('/contacts', { params })
      return res.data
    },
  })

  const items = results.data?.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="card w-full max-w-md p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Nova conversa</h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              className="input pl-8"
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Só contatos com <strong>opt-in confirmado</strong>. Fora da janela
            de 24h o primeiro envio precisa ser via template aprovado.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {results.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {debounced
                ? 'Nenhum contato OPTED_IN bate com essa busca.'
                : 'Nenhum contato com opt-in. Cadastre na aba Contatos ou importe.'}
            </div>
          ) : (
            items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c)}
                className="flex w-full flex-col gap-0.5 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-surface/60"
              >
                <span className="truncate text-sm font-medium text-ink">
                  {c.name}
                </span>
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {formatPhone(c.phone)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateSendDialog({
  contactId,
  onClose,
  onSend,
  isPending,
}: {
  contactId: string
  onClose: () => void
  onSend: (args: {
    templateId: string
    headerParams: string[]
    bodyParams: string[]
    buttonParams: Array<{ index: string; value: string }>
  }) => void
  isPending: boolean
}) {
  void contactId // reservado pra filtrar por número do contato no futuro
  const [templateId, setTemplateId] = useState<string>('')
  const [headerParams, setHeaderParams] = useState<string[]>([])
  const [bodyParams, setBodyParams] = useState<string[]>([])
  const [buttonValues, setButtonValues] = useState<string[]>([])

  const templatesQuery = useQuery({
    queryKey: ['templates', 'approved'],
    queryFn: async () =>
      (await api.get<TemplateOption[]>('/templates')).data.filter(
        (t) => t.status === 'APPROVED',
      ),
  })

  const selected = templatesQuery.data?.find((t) => t.id === templateId)
  const inputs = useMemo(
    () => (selected ? templateInputs(selected) : null),
    [selected],
  )

  useEffect(() => {
    if (!inputs) return
    setHeaderParams(Array(inputs.headerVarCount).fill(''))
    setBodyParams(Array(inputs.bodyVarCount).fill(''))
    setButtonValues(Array(inputs.buttonVars.length).fill(''))
  }, [inputs])

  const handleSend = () => {
    if (!templateId || !inputs) return
    onSend({
      templateId,
      headerParams,
      bodyParams,
      buttonParams: inputs.buttonVars.map((bv, i) => ({
        index: String(bv.index),
        value: buttonValues[i] ?? '',
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">
            Enviar template
          </h3>
          <button type="button" onClick={onClose} className="btn-ghost p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="label">Template aprovado</label>
        <select
          className="input mb-4"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Selecione…</option>
          {(templatesQuery.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>

        {selected && inputs && (
          <div className="space-y-3">
            {inputs.headerVarCount > 0 &&
              Array.from({ length: inputs.headerVarCount }).map((_, i) => (
                <div key={`h-${i}`}>
                  <label className="label">
                    Header <code>&#123;&#123;{i + 1}&#125;&#125;</code>
                  </label>
                  <input
                    className="input"
                    value={headerParams[i] ?? ''}
                    onChange={(e) =>
                      setHeaderParams((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                  />
                </div>
              ))}
            {inputs.bodyVarCount > 0 &&
              Array.from({ length: inputs.bodyVarCount }).map((_, i) => (
                <div key={`b-${i}`}>
                  <label className="label">
                    Body <code>&#123;&#123;{i + 1}&#125;&#125;</code>
                  </label>
                  <input
                    className="input"
                    value={bodyParams[i] ?? ''}
                    onChange={(e) =>
                      setBodyParams((prev) => {
                        const next = [...prev]
                        next[i] = e.target.value
                        return next
                      })
                    }
                  />
                </div>
              ))}
            {inputs.buttonVars.map((bv, i) => (
              <div key={`btn-${i}`}>
                <label className="label">
                  Botão {bv.index + 1} — variável da URL
                </label>
                <input
                  className="input font-mono text-xs"
                  placeholder="valor que substitui o {{1}} da URL"
                  value={buttonValues[i] ?? ''}
                  onChange={(e) =>
                    setButtonValues((prev) => {
                      const next = [...prev]
                      next[i] = e.target.value
                      return next
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSend}
            disabled={!templateId || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === 'OUTBOUND'
  const body = preview(message.content, message.messageType)
  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 text-sm',
          outbound
            ? 'bg-primary text-white'
            : 'bg-surface text-ink border border-border',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px]',
            outbound ? 'justify-end text-white/70' : 'text-muted-foreground',
          )}
        >
          <span>{formatRelative(message.receivedAt)}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'SENT':
      return <Check className="h-3 w-3" aria-label="Enviada" />
    case 'DELIVERED':
      return <CheckCheck className="h-3 w-3" aria-label="Entregue" />
    case 'READ':
      return (
        <CheckCheck className="h-3 w-3 text-sky-300" aria-label="Lida" />
      )
    case 'FAILED':
      return (
        <AlertCircle className="h-3 w-3 text-red-300" aria-label="Falhou" />
      )
    default:
      return null
  }
}
