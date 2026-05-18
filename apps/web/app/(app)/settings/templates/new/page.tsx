'use client'

import { PageHeader } from '@/components/layout/page-header'
import { TemplateForm } from '@/components/templates/template-form'

export default function NewTemplatePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Novo template"
        description="Após cadastrado, o template é enviado à Meta para aprovação (status PENDING)."
      />
      <TemplateForm />
    </div>
  )
}
