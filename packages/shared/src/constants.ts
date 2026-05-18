import type { PermissionAction, PermissionModule } from './types'

export const PERMISSION_MODULES: PermissionModule[] = [
  'CONTACTS',
  'TAGS',
  'CAMPAIGNS',
  'IMPORTS',
  'INBOX',
  'ANALYTICS',
  'AUTOMATIONS',
  'SETTINGS_NUMBERS',
  'SETTINGS_TEMPLATES',
  'SETTINGS_OPT_IN_LINKS',
  'AUDIT_LOG',
]

export const PERMISSION_ACTIONS: PermissionAction[] = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'SEND',
]

export const MODULE_LABELS: Record<PermissionModule, string> = {
  CONTACTS: 'Contatos',
  TAGS: 'Tags',
  CAMPAIGNS: 'Campanhas',
  IMPORTS: 'Importações',
  INBOX: 'Inbox',
  ANALYTICS: 'Analytics',
  AUTOMATIONS: 'Automações',
  SETTINGS_NUMBERS: 'Números WhatsApp',
  SETTINGS_TEMPLATES: 'Templates',
  SETTINGS_OPT_IN_LINKS: 'Links de Opt-in',
  AUDIT_LOG: 'Log de Auditoria',
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  VIEW: 'Visualizar',
  CREATE: 'Criar',
  EDIT: 'Editar',
  DELETE: 'Excluir',
  EXPORT: 'Exportar',
  SEND: 'Enviar',
}

export const OPT_OUT_KEYWORDS = [
  'stop',
  'pare',
  'parar',
  'cancelar',
  'sair',
  'descadastrar',
  'remover',
  'excluir',
  'desinscrever',
  'nao quero',
  'nao receber',
  'desativar',
  'bloquear',
  'chega',
  'basta',
]

export function isOptOutMessage(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return OPT_OUT_KEYWORDS.some(
    (kw) => normalized === kw || normalized.startsWith(kw + ' '),
  )
}

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('0')) return null
  if (!digits.startsWith('+')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = '+55' + digits
    } else if (digits.length === 12 || digits.length === 13) {
      digits = '+' + digits
    }
  }
  if (digits.length < 8 || digits.length > 16) return null
  return digits
}

export const APP_NAME = 'Kotodama'
export const APP_SUBTITLE = 'Seicho-No-Ie do Brasil'
export const APP_KANJI = '言霊'

export const COLORS = {
  primary: '#1B4FA8',
  primaryLight: '#4F8EF7',
  primaryDark: '#0F3272',
  black: '#1A1A1A',
  white: '#FFFFFF',
  bg: '#F5F6FA',
  border: '#E2E8F0',
  textMuted: '#64748B',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0284C7',
} as const
