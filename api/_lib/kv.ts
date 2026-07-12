import { Redis } from '@upstash/redis'

// Works with either Upstash's native env vars or Vercel's KV integration names.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '',
})

export const docKey = (code: string) => `berdua:couple:${code}`
export const COUPLES_SET = 'berdua:couples'
