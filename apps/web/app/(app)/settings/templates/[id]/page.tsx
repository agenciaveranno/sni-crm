'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import {
  TemplateForm,
  type TemplateFormValues,
} from '@/components/templates/template-form'
import { TemplateStatusBadge } from '@/components/ui/template-status-badge'
import { api } from '@/lib/api'

interface MetaComponent {
  type: string
  format?: string
  text?: string
  example?: {
    header_text?: string[]
    header_handle?: string[]
    body_text?: string[][]
  }
  buttons?: Array<{
    type: string
    text?: string
    url?: string
    phone_number?: string
    example?: string[] | string
  }>
}

interface TemplateDetail {
  id: string
  whatsAppNumberId: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
  rejectionReason: string | null
  components: MetaComponent[]
}

function parseComponents(components: MetaComponent[]): Partial<TemplateFormValues> {
  const out: Partial<TemplateFormValues> = {
    headerType: 'NONE',
    bodyExamples: [],
    buttons: [],
  }
  for (const c of components) {
    const type = c.type?.toUpperCase()
    if (type === 'HEADER') {
      const fmt = c.format?.toUpperCase()
      if (fmt === 'TEXT') {
        out.headerType = 'TEXT'
        out.headerText = c.text ?? ''
        out.headerExample = c.example?.header_text?.[0] ?? ''
      } else if (fmt === 'IMAGE' || fmt === 'VIDEO' || fmt === 'DOCUMENT') {
        out.headerType = fmt
        out.headerMediaHandle = c.example?.header_handle?.[0] ?? ''
      }
    } else if (type === 'BODY') {
      out.bodyText = c.text ?? ''
      out.bodyExamples = c.example?.body_text?.[0] ?? []
    } else if (type === 'FOOTER') {
      out.footerText = c.text ?? ''
    } else if (type === 'BUTTONS') {
      out.buttons = (c.buttons ?? []).map((b) => {
        const bt = b.type?.toUpperCase()
        if (bt === 'URL') {
          const ex = Array.isArray(b.example) ? b.example[0] : b.example
          return {
            type: 'URL' as const,
            text: b.text ?? '',
            url: b.url ?? '',
            example: ex ?? '',
          }
        }
        if (bt === 'PHONE_NUMBER') {
          return {
            type: 'PHONE_NUMBER' as const,
            text: b.text ?? '',
            phone: b.phone_number ?? '',
          }
        }
        if (bt === 'COPY_CODE') {
          const ex = Array.isArray(b.example) ? b.example[0] : b.example
          return { type: 'COPY_CODE' as const, example: ex ?? '' }
        }
        return { type: 'QUICK_REPLY' as const, text: b.text ?? '' }
      })
    }
  }
  return out
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
  const parsed = parseComponents(data.components ?? [])

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
            ...parsed,
          }}
        />
      )}
    </div>
  )
}
