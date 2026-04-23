import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type {
  LLMAdapter,
  LLMCompleteInput,
  LLMStepResult,
  LLMToolCall,
  ChatMessage,
} from '../types'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

export class AnthropicAdapter implements LLMAdapter {
  readonly providerName = 'anthropic' as const
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async step(
    input: LLMCompleteInput,
    onTextDelta?: (delta: string) => void,
  ): Promise<LLMStepResult> {
    const messages = toAnthropicMessages(input.messages)
    const tools = input.tools.map(t => ({
      name:         t.name,
      description:  t.description,
      input_schema: t.inputSchema as any,
    }))

    const stream = this.client.messages.stream({
      model:      MODEL,
      max_tokens: 4096,
      system:     input.system,
      messages,
      ...(tools.length ? { tools } : {}),
    })

    if (onTextDelta) {
      stream.on('text', (delta) => onTextDelta(delta))
    }

    const response = await stream.finalMessage()

    let text = ''
    const toolCalls: LLMToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, input: block.input })
      }
    }

    const stopReason: LLMStepResult['stopReason'] =
      response.stop_reason === 'tool_use' ? 'tool_use' :
      response.stop_reason === 'end_turn' ? 'end_turn' :
      response.stop_reason === 'max_tokens' ? 'max_tokens' : 'other'

    return {
      text,
      toolCalls,
      stopReason,
      usage: {
        input_tokens:  response.usage?.input_tokens  ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
      model: MODEL,
    }
  }
}

// ── Translator ChatMessage[] → Anthropic MessageParam[] ─────────────────
function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (msg.content) blocks.push({ type: 'text', text: msg.content })
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          blocks.push({
            type:  'tool_use',
            id:    tc.id,
            name:  tc.name,
            input: (tc.input ?? {}) as Record<string, unknown>,
          })
        }
      }
      out.push({ role: 'assistant', content: blocks })
    } else if (msg.role === 'tool_result') {
      // Anthropic: tool_result siempre va en mensaje 'user'
      // Si el mensaje anterior ya era user con tool_results, agrupamos; si no, nuevo mensaje.
      const prev = out[out.length - 1]
      const block: Anthropic.ToolResultBlockParam = {
        type:          'tool_result',
        tool_use_id:   msg.tool_call_id ?? '',
        content:       msg.content,
      }
      if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
        prev.content.push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
    }
  }

  return out
}
