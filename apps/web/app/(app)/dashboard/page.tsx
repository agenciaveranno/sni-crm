'use client'

import { PageHeader } from '@/components/layout/page-header'
import { useAuthStore } from '@/store/auth'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Visão geral do KotodamaCRM"
      />

      <div className="card p-8 text-center">
        <div className="mb-2 text-4xl">言霊</div>
        <h2 className="text-xl font-semibold text-ink">
          Bem-vindo, {user?.name}!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use o menu lateral para navegar entre contatos, campanhas e
          configurações. Os widgets de métricas serão habilitados após o
          cadastro do primeiro número de WhatsApp.
        </p>
      </div>
    </div>
  )
}
