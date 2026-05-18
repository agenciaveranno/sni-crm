'use client'

import { PageHeader } from '@/components/layout/page-header'
import { NumberForm } from '@/components/numbers/number-form'

export default function NewNumberPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Cadastrar número WhatsApp"
        description="Conecte um número da WhatsApp Business Cloud API (Meta)."
      />
      <NumberForm />
    </div>
  )
}
