'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { initials } from '@/lib/utils'

export function Topbar() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logoutStore = useAuthStore((s) => s.logout)

  const logout = useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout')
      } catch {
        // mesmo se der erro, faz logout local
      }
    },
    onSettled: () => {
      logoutStore()
      router.replace('/login')
    },
  })

  if (!user) return null

  return (
    <header className="flex h-[60px] items-center justify-between border-b border-border bg-surface px-6 shadow-topbar">
      <div className="text-sm text-muted-foreground">
        Bem-vindo de volta, <span className="font-medium text-ink">{user.name}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-ink">{user.name}</div>
            <div className="text-xs text-muted-foreground">
              {user.role === 'ADMIN' ? 'Administrador' : 'Operador'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          className="btn-ghost"
          disabled={logout.isPending}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  )
}
