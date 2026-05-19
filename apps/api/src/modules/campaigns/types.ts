/** Como resolver uma variável posicional de template em runtime. */
export type ParamSpec =
  | { kind: 'literal'; value: string }
  | { kind: 'field'; field: 'name' | 'phone' | 'email' }

export interface ButtonParamSpec {
  index: number
  value: ParamSpec
}

/** Esquema das vars salvas em `Campaign.templateVariables`. */
export interface CampaignVariablesSpec {
  headerParams?: ParamSpec[]
  bodyParams?: ParamSpec[]
  buttonParams?: ButtonParamSpec[]
}

/** Esquema das vars já resolvidas por contato em `CampaignRecipient.resolvedVariables`. */
export interface ResolvedRecipientVariables {
  headerParams: string[]
  bodyParams: string[]
  buttonParams: Array<{ index: number; value: string }>
}

export interface CampaignDispatchJobData {
  campaignId: string
  recipientId: string
}
