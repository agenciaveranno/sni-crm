import IORedis, { type Redis as RedisClient } from 'ioredis'

let client: RedisClient | null = null
let attempted = false

export const Redis = {
  client(): RedisClient {
    if (!client) {
      const url = process.env.REDIS_URL
      if (!url) {
        throw new Error('REDIS_URL não definida')
      }
      client = new IORedis(url, { maxRetriesPerRequest: null })
    }
    return client
  },

  /**
   * Retorna o client se REDIS_URL estiver configurada; caso contrário, null.
   * Útil para features opcionais (ex: blacklist de JWT) que não devem
   * derrubar a API se o Redis não estiver disponível em dev.
   */
  maybeClient(): RedisClient | null {
    if (client) return client
    if (attempted) return null
    attempted = true
    const url = process.env.REDIS_URL
    if (!url) return null
    try {
      client = new IORedis(url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      })
      return client
    } catch {
      return null
    }
  },
}
