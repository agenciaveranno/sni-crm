import { cn } from '@/lib/utils'

interface QualityBadgeProps {
  rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
}

const STYLES = {
  GREEN: 'bg-success/10 text-success',
  YELLOW: 'bg-warning/10 text-warning',
  RED: 'bg-danger/10 text-danger',
  UNKNOWN: 'bg-bg text-muted-foreground',
} as const

const LABELS = {
  GREEN: 'Alta',
  YELLOW: 'Média',
  RED: 'Baixa',
  UNKNOWN: 'Desconhecida',
} as const

export function QualityBadge({ rating }: QualityBadgeProps) {
  return (
    <span className={cn('badge', STYLES[rating])}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          rating === 'GREEN'
            ? 'bg-success'
            : rating === 'YELLOW'
              ? 'bg-warning'
              : rating === 'RED'
                ? 'bg-danger'
                : 'bg-muted-foreground/50',
        )}
      />
      {LABELS[rating]}
    </span>
  )
}
