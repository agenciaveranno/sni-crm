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

  async sendTemplate(args: {
    phoneNumberId: string
    accessToken: string
    /** E.164 sem o "+" */
    to: string
    templateName: string
    language: string
    /** Valores na ordem das variáveis {{1}}, {{2}}, ... */
    headerParams?: string[]
    bodyParams?: string[]
    /**
     * Botões dinâmicos (URL com {{1}}). Cada item informa o índice do
     * botão na lista e o valor da variável de URL.
     */
    buttonParams?: Array<{ index: number; value: string }>
  }): Promise<{ waMessageId: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${args.phoneNumberId}/messages`
    const components: Array<Record<string, unknown>> = []
    if (args.headerParams?.length) {
      components.push({
        type: 'header',
        parameters: args.headerParams.map((v) => ({ type: 'text', text: v })),
      })
    }
    if (args.bodyParams?.length) {
      components.push({
        type: 'body',
        parameters: args.bodyParams.map((v) => ({ type: 'text', text: v })),
      })
    }
    if (args.buttonParams?.length) {
      for (const bp of args.buttonParams) {
        components.push({
          type: 'button',
          sub_type: 'url',
          index: String(bp.index),
          parameters: [{ type: 'text', text: bp.value }],
        })
      }
    }

    try {
      const res = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: args.to,
          type: 'template',
          template: {
            name: args.templateName,
            language: { code: args.language },
            components,
          },
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
          `sendTemplate resposta inesperada: ${JSON.stringify(res.data)}`,
        )
        throw new BadRequestException('Resposta inesperada da Meta')
      }
      return { waMessageId: id }
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const metaError = (err.response.data as { error?: { message?: string; code?: number; error_user_msg?: string } })?.error
        const message =
          metaError?.error_user_msg ?? metaError?.message ?? err.message
        const code = metaError?.code ?? err.response.status
        this.logger.warn(
          `Meta sendTemplate falhou: code=${code} message="${message}"`,
        )
        throw new BadRequestException(`Meta: ${message}`)
      }
      throw err
    }
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

  /**
   * Cria um template na Meta e o submete para aprovação. Retorna o id
   * externo (id da Meta) e o status retornado (normalmente PENDING).
   */
  async createTemplate(args: {
    wabaId: string
    accessToken: string
    name: string
    language: string
    category: string
    components: Array<Record<string, unknown>>
  }): Promise<{ id: string; status: string; category?: string }> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${args.wabaId}/message_templates`
    try {
      const res = await axios.post(
        url,
        {
          name: args.name,
          language: args.language,
          category: args.category,
          components: args.components,
        },
        {
          headers: {
            Authorization: `Bearer ${args.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      )
      const id = res.data?.id
      if (!id) {
        this.logger.error(`createTemplate sem id: ${JSON.stringify(res.data)}`)
        throw new BadRequestException('Resposta inesperada da Meta')
      }
      return {
        id,
        status: res.data?.status ?? 'PENDING',
        category: res.data?.category,
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const metaError = (err.response.data as {
          error?: { message?: string; code?: number; error_user_msg?: string; error_user_title?: string }
        })?.error
        const message =
          metaError?.error_user_msg ?? metaError?.message ?? err.message
        const code = metaError?.code ?? err.response.status
        this.logger.warn(
          `Meta createTemplate falhou: code=${code} message="${message}"`,
        )
        throw new BadRequestException(`Meta: ${message}`)
      }
      throw err
    }
  }
}
