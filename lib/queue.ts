import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { getEnv } from '@/lib/env'

export const EMAIL_SCAN_QUEUE = 'ghost-mail-scans'

let connection: IORedis | undefined
let queue: Queue | undefined

function swallowRedisErrors(client: IORedis) {
  client.on('error', () => {})
}

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(getEnv().REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 400,
      retryStrategy: () => null,
    })
    swallowRedisErrors(connection)
  }
  return connection
}

export async function isRedisReady(timeoutMs = 400) {
  const probe = new IORedis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: timeoutMs,
    retryStrategy: () => null,
  })
  swallowRedisErrors(probe)
  try {
    await Promise.race([
      probe.connect().then(() => probe.ping()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), timeoutMs)),
    ])
    await probe.quit().catch(() => probe.disconnect())
    return true
  } catch {
    probe.disconnect()
    return false
  }
}

export function getScanQueue() {
  if (!queue) queue = new Queue(EMAIL_SCAN_QUEUE, { connection: getRedisConnection() })
  return queue
}
