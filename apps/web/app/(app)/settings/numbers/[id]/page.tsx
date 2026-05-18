'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { NumberForm } from '@/components/numbers/number-form'
import { api } from '@/lib/api'

interface NumberDetail {
  id: string
  displayName: string
  phoneNumber: string
  phoneNumberId: string
  wabaId: string
  isDefault: boolean
}

export default function EditNumberPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-numbers', id],
    queryFn: async () =>
      (await api.get<NumberDetail>(`/whatsapp-numbers/${id}`)).data,
  })

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar número WhatsApp"
        description={data.displayName}
      />
      <NumberForm numberId={id} initial={data} />
    </div>
  )
}
