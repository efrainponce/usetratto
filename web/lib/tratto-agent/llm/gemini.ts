import 'server-only'
import { GoogleGenAI, type Content, type Part } from '@google/genai'
import type {
  LLMAdapter,
  LLMCompleteInput,
  LLMStepResult,
  LLMToolCall,
  ChatMessage,
} from '../types'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export class GeminiAdapter implements LLMAdapter {
  readonly providerName = 'gemini' as const
  private client: GoogleGenAI

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey })
  }

  async step(
    input: LLMCompleteInput,
    onTextDelta?: (delta: string) => void,
  ): Promise<LLMStepResult> {
    const contents = toGeminiContents(input.messages)
    const tools = input.tools.length
      ? [{
          functionDeclarations: input.tools.map(t => ({
            name:        t.name,
            description: t.description,
            parameters:  t.inputSchema as any,
          })),
        }]
      : undefined

    const stream = await this.client.models.generateContentStream({
      model:    MODEL,
      contents,
      config: {
        systemInstruction: input.system,
        ...(tools ? { tools } : {}),
      },
    })

    let text = ''
    const toolCalls: LLMToolCall[] = []
    let stopReason: LLMStepResult['stopReason'] = 'end_turn'
    let inputTokens = 0
    let outputTokens = 0

    for await (const chunk of stream) {
      const chunkText = chunk.text ?? ''
      if (chunkText) {
        text += chunkText
        onTextDelta?.(chunkText)
      }
      const fcs = chunk.functionCalls
      if (fcs && fcs.length) {
        for (const fc of fcs) {
          toolCalls.push({
            id:    fc.id ?? `${fc.name}_${toolCalls.length}`,
            name:  fc.name ?? '',
            input: fc.args ?? {},
          })
        }
      }
      const fr = chunk.candidates?.[0]?.finishReason
      if (fr === 'STOP') stopReason = toolCalls.length ? 'tool_use' : 'end_turn'
      else if (fr === 'MAX_TOKENS') stopReason = 'max_tokens'
      // usageMetadata llega acumulada en el último chunk
      const um = (chunk as any).usageMetadata
      if (um) {
        inputTokens  = um.promptTokenCount ?? inputTokens
        outputTokens = um.candidatesTokenCount ?? outputTokens
      }
    }

    if (toolCalls.length) stopReason = 'tool_use'

    return {
      text,
      toolCalls,
      stopReason,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      model: MODEL,
    }
  }
}

// ── Translator ChatMessage[] → Gemini Content[] ─────────────────────────
function toGeminiContents(messages: ChatMessage[]): Content[] {
  const out: Content[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', parts: [{ text: msg.content }] })
    } else if (msg.role === 'assistant') {
      const parts: Part[] = []
      if (msg.content) parts.push({ text: msg.content })
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              id:   tc.id,
              name: tc.name,
              args: (tc.input ?? {}) as Record<string, unknown>,
            },
          })
        }
      }
      if (parts.length) out.push({ role: 'model', parts })
    } else if (msg.role === 'tool_result') {
      // Gemini requiere functionResponse con name matching la call
      const name = extractToolNameFromPrior(messages, msg.tool_call_id)
      out.push({
        role: 'user',
        parts: [{
          functionResponse: {
            id:       msg.tool_call_id,
            name:     name || 'unknown_tool',
            response: safeParseResponse(msg.content),
          },
        }],
      })
    }
  }

  return out
}

function extractToolNameFromPrior(messages: ChatMessage[], toolCallId?: string): string | undefined {
  if (!toolCallId) return undefined
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.tool_calls) continue
    const found = msg.tool_calls.find(tc => tc.id === toolCallId)
    if (found) return found.name
  }
  return undefined
}

function safeParseResponse(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return { result: parsed }
  } catch {
    return { result: content }
  }
}
