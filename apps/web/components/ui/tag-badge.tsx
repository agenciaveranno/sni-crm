import { cn } from '@/lib/utils'

interface TagBadgeProps {
  name: string
  color?: string
  className?: string
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.65
}

export function TagBadge({ name, color = '#1B4FA8', className }: TagBadgeProps) {
  const textColor = isLight(color) ? '#1A1A1A' : '#FFFFFF'
  return (
    <span
      className={cn('badge', className)}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  )
}
