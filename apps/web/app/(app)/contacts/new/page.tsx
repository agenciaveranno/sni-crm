'use client'

import { PageHeader } from '@/components/layout/page-header'
import { ContactForm } from '@/components/contacts/contact-form'

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Novo contato"
        description="Cadastre um contato individualmente. Para grandes volumes, use a importação XLSX."
      />
      <ContactForm />
    </div>
  )
}
