import { cn } from '@/lib/utils'

interface OptInBadgeProps {
  status: 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'
  className?: string
}

const LABELS = {
  PENDING: 'Pendente',
  OPTED_IN: 'Aceitou',
  OPTED_OUT: 'Recusou',
} as const

const STYLES = {
  PENDING: 'bg-warning/10 text-warning',
  OPTED_IN: 'bg-success/10 text-success',
  OPTED_OUT: 'bg-danger/10 text-danger',
} as const

export function OptInBadge({ status, className }: OptInBadgeProps) {
  return (
    <span className={cn('badge', STYLES[status], className)}>
      {LABELS[status]}
    </span>
  )
}
