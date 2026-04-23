import 'server-only'
import type { LLMAdapter } from '../types'
import { GeminiAdapter } from './gemini'
import { AnthropicAdapter } from './anthropic'

export { zodToJsonSchema } from './zod-to-json-schema'

let cached: LLMAdapter | null = null

export function getLLM(): LLMAdapter {
  if (cached) return cached

  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY no configurado')
    cached = new GeminiAdapter(key)
    return cached
  }

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY no configurado')
    cached = new AnthropicAdapter(key)
    return cached
  }

  throw new Error(`LLM_PROVIDER inválido: ${provider} (esperado: gemini|anthropic)`)
}
