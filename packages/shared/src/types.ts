export type UserRole = 'ADMIN' | 'OPERATOR'

export type OptInStatus = 'PENDING' | 'OPTED_IN' | 'OPTED_OUT'
export type OptInMethod = 'MANUAL' | 'IMPORT' | 'FORM' | 'QR_CODE'

export type NumberStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type TemplateStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'

export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'

export type RecipientStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'OPTED_OUT'
  | 'SKIPPED'

export type ImportStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'

export type MessageDirection = 'INBOUND' | 'OUTBOUND'
export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'AUDIO'
  | 'VIDEO'
  | 'STICKER'
  | 'LOCATION'
  | 'INTERACTIVE'
  | 'TEMPLATE'
  | 'UNKNOWN'

export type MessageStatus =
  | 'RECEIVED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export type TriggerType =
  | 'OPT_OUT_RECEIVED'
  | 'TAG_ADDED'
  | 'CONTACT_CREATED'
  | 'INBOUND_MESSAGE'

export type ActionType =
  | 'SEND_TEMPLATE_MESSAGE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'CALL_WEBHOOK'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: Permission[]
}

export interface Permission {
  module: PermissionModule
  action: PermissionAction
  granted: boolean
}

export type PermissionModule =
  | 'CONTACTS'
  | 'TAGS'
  | 'CAMPAIGNS'
  | 'IMPORTS'
  | 'INBOX'
  | 'ANALYTICS'
  | 'AUTOMATIONS'
  | 'SETTINGS_NUMBERS'
  | 'SETTINGS_TEMPLATES'
  | 'SETTINGS_OPT_IN_LINKS'
  | 'AUDIT_LOG'

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'EXPORT'
  | 'SEND'

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
