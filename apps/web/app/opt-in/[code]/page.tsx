'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface LinkInfo {
  code: string
  description: string
  redirectUrl: string | null
}

export default function PublicOptInPage() {
  const params = useParams<{ code: string }>()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const info = useQuery({
    queryKey: ['opt-in-info', params.code],
    queryFn: async () =>
      (
        await api.get<LinkInfo>(`/opt-in-links/public/${params.code}`)
      ).data,
    retry: false,
  })

  const submit = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ ok: boolean; redirectUrl: string | null }>(
        `/opt-in-links/public/${params.code}/submit`,
        { name, phone, email: email || undefined },
      )
      return res.data
    },
    onSuccess: (data) => {
      setDone(true)
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl as string
        }, 1200)
      }
    },
  })

  useEffect(() => {
    document.title = 'Inscrição — Kotodama'
  }, [])

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (info.isError || !info.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de inscrição não está mais ativo.
          </p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="card max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-3 text-xl font-semibold text-ink">
            Inscrição confirmada!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você receberá nossas mensagens no WhatsApp. Obrigado.
          </p>
          {info.data.redirectUrl && (
            <p className="mt-3 text-xs text-muted-foreground">
              Redirecionando...
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <form
        className="card w-full max-w-md space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault()
          submit.mutate()
        }}
      >
        <header>
          <div className="text-sm text-muted-foreground">Inscrição</div>
          <h1 className="mt-1 text-xl font-semibold text-ink">
            {info.data.description}
          </h1>
        </header>

        <div>
          <label className="label">Nome completo</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label">WhatsApp (com DDD)</label>
          <input
            className="input"
            placeholder="(11) 99999-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div>
          <label className="label">E-mail (opcional)</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Ao enviar, você concorda em receber mensagens da Seicho-No-Ie do Brasil
          via WhatsApp. Você pode pedir para sair a qualquer momento respondendo
          “PARE”.
        </p>

        {submit.isError && (
          <div className="rounded border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
            Falha ao enviar. Confira o telefone e tente novamente.
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={submit.isPending}
        >
          {submit.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Confirmar inscrição
        </button>
      </form>
    </div>
  )
}
