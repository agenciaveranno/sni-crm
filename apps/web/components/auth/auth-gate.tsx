'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/store/auth'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, setUser, logout } = useAuthStore()

  useEffect(() => {
    if (!token) {
      const next = encodeURIComponent(pathname ?? '/dashboard')
      router.replace(`/login?next=${next}`)
    }
  }, [token, router, pathname])

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get<AuthUser>('/auth/me')
      return res.data
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (meQuery.data) setUser(meQuery.data)
  }, [meQuery.data, setUser])

  useEffect(() => {
    if (meQuery.isError) {
      logout()
      router.replace('/login')
    }
  }, [meQuery.isError, logout, router])

  if (!token || meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
