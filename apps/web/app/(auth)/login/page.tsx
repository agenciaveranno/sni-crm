'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { api, apiErrorMessage } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/store/auth'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha muito curta'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const search = useSearchParams()
  const { setSession, token } = useAuthStore()

  useEffect(() => {
    if (token) router.replace(search.get('next') ?? '/dashboard')
  }, [token, router, search])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const login = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await api.post<{ token: string; user: AuthUser }>(
        '/auth/login',
        data,
      )
      return res.data
    },
    onSuccess: (data) => {
      setSession({ token: data.token, user: data.user })
      toast.success(`Olá, ${data.user.name.split(' ')[0]}!`)
      router.replace(search.get('next') ?? '/dashboard')
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Não foi possível entrar'))
    },
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-3 text-primary">
            <span className="text-5xl font-bold tracking-tight">言霊</span>
          </div>
          <h1 className="text-3xl font-bold text-ink">Kotodama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seicho-No-Ie do Brasil
          </p>
        </div>

        <div className="card p-8">
          <h2 className="mb-1 text-lg font-semibold text-ink">Entrar</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Acesse com seu e-mail corporativo
          </p>

          <form
            onSubmit={form.handleSubmit((d) => login.mutate(d))}
            className="space-y-4"
          >
            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="voce@seichonoie.org.br"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="mt-1 text-xs text-danger">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={login.isPending}
            >
              {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Esqueceu a senha? Fale com um administrador.
        </p>
      </div>
    </main>
  )
}
