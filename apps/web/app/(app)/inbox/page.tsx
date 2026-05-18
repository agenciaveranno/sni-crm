'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Check,
  CheckCheck,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

export default function InboxPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
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

  const selected = conversations.data?.find(
    (c) => c.contact.id === selectedId,
  )

  // Auto-select first conversation when list loads
  useEffect(() => {
    if (!selectedId && conversations.data?.length) {
      setSelectedId(conversations.data[0].contact.id)
    }
  }, [conversations.data, selectedId])

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
      />

      {conversations.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !conversations.data?.length ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="Nenhuma conversa ainda"
          description="Quando seus contatos enviarem mensagens, elas aparecem aqui."
        />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4">
          <aside className="card flex w-80 flex-col overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-medium uppercase text-muted-foreground">
              {conversations.data.length} conversas
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.data.map((c) => (
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
