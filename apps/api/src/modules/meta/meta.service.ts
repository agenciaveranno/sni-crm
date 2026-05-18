import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosError } from 'axios'

export interface MetaTemplate {
  id?: string
  name: string
  language: string
  status: string
  category: string
  components: Array<Record<string, unknown>>
  rejected_reason?: string
}

/**
 * Cliente HTTP para a Meta Cloud API (Graph). Por enquanto: envio de texto
 * + leitura de message templates do WABA. Mídia e outras features entram
 * em slices futuros.
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name)
  private readonly graphVersion: string

  constructor(config: ConfigService) {
    this.graphVersion = config.get<string>('META_GRAPH_VERSION', 'v22.0')
  }

  async sendText(args: {
    phoneNumberId: string
    accessToken: string
    /** E.164 sem o "+" (ex: 5511999998888) */
    to: string
    body: string
  }): Promise<{ waMessageId: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${args.phoneNumberId}/messages`
    try {
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: args.to,
          type: 'text',
          text: { body: args.body, preview_url: false },
        },
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )
      const id = res.data?.messages?.[0]?.id
      if (!id) {
        this.logger.error(
          `Resposta inesperada da Meta: ${JSON.stringify(res.data)}`,
        )
        throw new BadRequestException('Resposta inesperada da Meta')
      }
      return { waMessageId: id }
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const metaError = (err.response.data as { error?: { message?: string; code?: number; error_subcode?: number } })?.error
        const message = metaError?.message ?? err.message
        const code = metaError?.code ?? err.response.status
        this.logger.warn(
          `Meta sendText falhou: code=${code} status=${err.response.status} message="${message}"`,
        )
        throw new BadRequestException(`Meta: ${message}`)
      }
      throw err
    }
  }

  /**
   * Lista todos os message templates de uma WABA, seguindo paginação
   * cursor-based da Meta até o fim. Usa `fields` explícitos pra trazer
   * components+status sem precisar de uma segunda chamada por template.
   */
  async listTemplates(args: {
    wabaId: string
    accessToken: string
  }): Promise<MetaTemplate[]> {
    const fields =
      'id,name,language,status,category,components,rejected_reason'
    let url: string | null = `https://graph.facebook.com/${this.graphVersion}/${args.wabaId}/message_templates?fields=${fields}&limit=200`
    const out: MetaTemplate[] = []

    try {
      while (url) {
        const res: { data: { data?: MetaTemplate[]; paging?: { next?: string } } } =
          await axios.get(url, {
            headers: { Authorization: `Bearer ${args.accessToken}` },
            timeout: 20000,
          })
        const page = res.data?.data ?? []
        out.push(...page)
        url = res.data?.paging?.next ?? null
      }
      return out
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const metaError = (err.response.data as { error?: { message?: string; code?: number } })?.error
        const message = metaError?.message ?? err.message
        const code = metaError?.code ?? err.response.status
        this.logger.warn(
          `Meta listTemplates falhou: code=${code} message="${message}"`,
        )
        throw new BadRequestException(`Meta: ${message}`)
      }
      throw err
    }
  }
}
