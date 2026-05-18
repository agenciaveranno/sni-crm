'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { TemplateForm } from '@/components/templates/template-form'
import { TemplateStatusBadge } from '@/components/ui/template-status-badge'
import { api } from '@/lib/api'

interface TemplateDetail {
  id: string
  whatsAppNumberId: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
  rejectionReason: string | null
  components: Array<{ type: string; text?: string; format?: string }>
}

function extractComponent(
  components: Array<{ type: string; text?: string }>,
  type: string,
) {
  const c = components.find((c) => c.type?.toUpperCase() === type)
  return c?.text ?? ''
}

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: async () => (await api.get<TemplateDetail>(`/templates/${id}`)).data,
  })

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const canEdit = data.status === 'PENDING' || data.status === 'REJECTED'

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={data.name}
        description={`Status atual: ${data.status}`}
        actions={<TemplateStatusBadge status={data.status} />}
      />

      {data.rejectionReason && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <strong>Motivo da rejeição:</strong> {data.rejectionReason}
        </div>
      )}

      {!canEdit && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          Templates {data.status === 'APPROVED' ? 'aprovados' : 'pausados/desativados'}
          {' '}não podem ser editados. Crie uma nova versão se precisar.
        </div>
      )}

      {canEdit && (
        <TemplateForm
          templateId={id}
          initial={{
            whatsAppNumberId: data.whatsAppNumberId,
            name: data.name,
            category: data.category,
            language: data.language,
            headerText: extractComponent(data.components, 'HEADER'),
            bodyText: extractComponent(data.components, 'BODY'),
            footerText: extractComponent(data.components, 'FOOTER'),
          }}
        />
      )}
    </div>
  )
}
