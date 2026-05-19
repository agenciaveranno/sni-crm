import { cn } from '@/lib/utils'

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'

const STYLES: Record<CampaignStatus, string> = {
  DRAFT: 'bg-bg text-muted-foreground',
  SCHEDULED: 'bg-info/10 text-info',
  RUNNING: 'bg-primary/10 text-primary',
  PAUSED: 'bg-warning/10 text-warning',
  COMPLETED: 'bg-success/10 text-success',
  CANCELLED: 'bg-bg text-muted-foreground',
  FAILED: 'bg-danger/10 text-danger',
}

const LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  RUNNING: 'Em execução',
  PAUSED: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  FAILED: 'Falhou',
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <span className={cn('badge', STYLES[status])}>{LABELS[status]}</span>
}
