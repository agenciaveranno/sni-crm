'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Send,
  Inbox,
  Upload,
  BarChart3,
  Workflow,
  Settings,
  Phone,
  FileText,
  Tag,
  Link2,
  UserCog,
  ScrollText,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/contacts', label: 'Contatos', icon: Users },
      { href: '/campaigns', label: 'Campanhas', icon: Send },
      { href: '/inbox', label: 'Inbox', icon: Inbox },
      { href: '/imports', label: 'Importar', icon: Upload },
    ],
  },
  {
    label: 'Análise',
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/automations', label: 'Automações', icon: Workflow },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { href: '/settings/numbers', label: 'Números WA', icon: Phone },
      { href: '/settings/templates', label: 'Templates', icon: FileText },
      { href: '/settings/tags', label: 'Tags', icon: Tag },
      { href: '/settings/opt-in-links', label: 'Links Opt-in', icon: Link2 },
      { href: '/settings/users', label: 'Usuários', icon: UserCog, adminOnly: true },
      {
        href: '/settings/audit-log',
        label: 'Log de Auditoria',
        icon: ScrollText,
        adminOnly: true,
      },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-primary text-white md:flex">
      <div className="flex h-[60px] items-center gap-3 px-5 border-b border-white/10">
        <span className="text-2xl font-bold tracking-tight">言霊</span>
        <div className="leading-tight">
          <div className="text-base font-semibold">Kotodama</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60">
            SNI Brasil
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || isAdmin)
          if (items.length === 0) return null
          return (
            <div key={group.label} className="mb-6">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {group.label}
              </div>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + '/')
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-white/15 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
