import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface PermissionEntry {
  module: string
  action: string
  granted: boolean
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
  permissions?: PermissionEntry[]
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setSession: (payload: { token: string; user: AuthUser }) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  hasPermission: (module: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      hasPermission: (module, action) => {
        const user = get().user
        if (!user) return false
        if (user.role === 'ADMIN') return true
        return (
          user.permissions?.some(
            (p) => p.module === module && p.action === action && p.granted,
          ) ?? false
        )
      },
    }),
    {
      name: 'kotodama.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
