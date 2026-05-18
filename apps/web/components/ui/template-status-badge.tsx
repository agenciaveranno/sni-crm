import { cn } from '@/lib/utils'

interface Props {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED'
}

const STYLES = {
  PENDING: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-danger/10 text-danger',
  PAUSED: 'bg-bg text-muted-foreground',
  DISABLED: 'bg-bg text-muted-foreground',
} as const

const LABELS = {
  PENDING: 'Aguardando',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
} as const

export function TemplateStatusBadge({ status }: Props) {
  return <span className={cn('badge', STYLES[status])}>{LABELS[status]}</span>
}
