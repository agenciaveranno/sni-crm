import { z } from 'zod'

const paramSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: z.string() }),
  z.object({
    kind: z.literal('field'),
    field: z.enum(['name', 'phone', 'email']),
  }),
])

const variablesSchema = z.object({
  headerParams: z.array(paramSpecSchema).optional(),
  bodyParams: z.array(paramSpecSchema).optional(),
  buttonParams: z
    .array(
      z.object({
        index: z.number().int().min(0).max(9),
        value: paramSpecSchema,
      }),
    )
    .optional(),
})

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  whatsAppNumberId: z.string().min(1),
  templateId: z.string().min(1),
  templateVariables: variablesSchema.default({}),
  tagIds: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime().optional().nullable(),
})
export type CreateCampaignDto = z.infer<typeof createCampaignSchema>

export const updateCampaignSchema = createCampaignSchema.partial()
export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>

export const listCampaignsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'DRAFT',
      'SCHEDULED',
      'RUNNING',
      'PAUSED',
      'COMPLETED',
      'CANCELLED',
      'FAILED',
    ])
    .optional(),
  search: z.string().optional(),
})
export type ListCampaignsDto = z.infer<typeof listCampaignsSchema>
