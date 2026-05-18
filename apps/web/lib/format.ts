import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelative(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

export function formatPhone(raw: string) {
  // +5511999998888 -> +55 (11) 99999-8888
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  return raw
}
