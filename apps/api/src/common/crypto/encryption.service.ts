import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

/**
 * AES-256-CBC para campos sensíveis no banco (ex.: access tokens da Meta).
 * Formato armazenado: <iv_hex>:<ciphertext_hex>
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name)
  private readonly key: Buffer

  constructor(config: ConfigService) {
    const hex = config.get<string>('ENCRYPTION_KEY')
    if (!hex || hex.length !== 64) {
      this.logger.warn(
        'ENCRYPTION_KEY ausente/inválida (esperado 64 chars hex = 32 bytes). Gerando chave efêmera só para esta execução; tokens cifrados não serão decifráveis após restart.',
      )
      this.key = randomBytes(32)
    } else {
      this.key = Buffer.from(hex, 'hex')
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-cbc', this.key, iv)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${ct.toString('hex')}`
  }

  decrypt(payload: string): string {
    const [ivHex, ctHex] = payload.split(':')
    if (!ivHex || !ctHex) throw new Error('Payload cifrado inválido')
    const iv = Buffer.from(ivHex, 'hex')
    const ct = Buffer.from(ctHex, 'hex')
    const decipher = createDecipheriv('aes-256-cbc', this.key, iv)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  }

  /** Mascarar para exibição na UI / audit logs. */
  mask(payload: string): string {
    if (!payload) return ''
    // Se for um par iv:ct, retorna ****; se for um token cru, mostra só prefixo.
    if (payload.includes(':')) return '••••••••'
    const visible = Math.min(6, Math.max(2, Math.floor(payload.length / 6)))
    return `${payload.slice(0, visible)}…${'•'.repeat(8)}`
  }
}
