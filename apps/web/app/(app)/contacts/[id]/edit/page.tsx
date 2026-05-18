'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ContactForm } from '@/components/contacts/contact-form'
import { api } from '@/lib/api'

interface ContactDetail {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
}

export default function EditContactPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => (await api.get<ContactDetail>(`/contacts/${id}`)).data,
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
      <PageHeader title="Editar contato" description={data.name} />
      <ContactForm
        contactId={id}
        initial={{
          name: data.name,
          phone: data.phone,
          email: data.email ?? '',
          notes: data.notes ?? '',
        }}
      />
    </div>
  )
}
