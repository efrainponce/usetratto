import 'server-only'
import type {
  AgentInput,
  AgentOutput,
  ChatMessage,
  StreamEvent,
  ToolCallRecord,
} from './types'
import { getLLM } from './llm'
import { TOOL_BY_NAME, toolsAsLLMSpecs } from './tools'
import { buildSystemPrompt } from './context'
import { assertBudget, recordUsage } from './billing'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_ITERATIONS = 8

type RunOpts = {
  onEvent?:  (ev: StreamEvent) => void
  sessionId?: string
}

export async function runAgent(input: AgentInput, opts: RunOpts = {}): Promise<AgentOutput> {
  // Pre-flight: si el workspace ya gastó su cupo, corta antes de llamar al LLM
  await assertBudget(input.ctx.workspaceId)

  const llm = getLLM()
  const toolSpecs = toolsAsLLMSpecs()

  // Fetch workspace + active board (si aplica) para el system prompt
  const service = createServiceClient()
  const [{ data: ws }, boardRes] = await Promise.all([
    service.from('workspaces').select('id, name').eq('id', input.ctx.workspaceId).maybeSingle(),
    input.ctx.boardId
      ? service.from('boards').select('id, sid, name, type, system_key').eq('id', input.ctx.boardId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!ws) throw new Error('Workspace no encontrado')

  const system = buildSystemPrompt(input.ctx, ws as any, (boardRes as any).data ?? undefined)

  // Historia de trabajo del loop — copia mutable
  const working: ChatMessage[] = [
    ...input.history,
    { role: 'user', content: input.message },
  ]

  const toolCallsRun: ToolCallRecord[] = []
  let finalText = ''

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Re-check budget antes de cada step (cada iteración gasta tokens)
    if (iter > 0) await assertBudget(input.ctx.workspaceId)

    const step = await llm.step(
      { system, messages: working, tools: toolSpecs },
      (delta) => opts.onEvent?.({ type: 'text_delta', delta }),
    )

    // Registrar uso real de este step — fire-and-forget pero awaited antes de seguir
    if (step.usage.input_tokens || step.usage.output_tokens) {
      await recordUsage({
        workspaceId:   input.ctx.workspaceId,
        userId:        input.ctx.userId,
        sessionId:     opts.sessionId ?? null,
        provider:      llm.providerName,
        model:         step.model,
        inputTokens:   step.usage.input_tokens,
        outputTokens:  step.usage.output_tokens,
      })
    }

    finalText = step.text

    if (!step.toolCalls.length) {
      break
    }

    // Anotar assistant turn con tool_calls antes de ejecutar
    const assistantToolCalls: ToolCallRecord[] = step.toolCalls.map(tc => ({
      id:          tc.id,
      name:        tc.name,
      input:       tc.input,
      executed_at: new Date().toISOString(),
    }))
    working.push({
      role:       'assistant',
      content:    step.text,
      tool_calls: assistantToolCalls,
    })

    // Ejecutar cada tool y agregar tool_result al working history
    for (const tc of step.toolCalls) {
      opts.onEvent?.({ type: 'tool_start', name: tc.name, input: tc.input, callId: tc.id })
      const tool = TOOL_BY_NAME.get(tc.name)
      let output: unknown
      let error: string | undefined

      if (!tool) {
        error = `Tool desconocido: ${tc.name}`
      } else {
        try {
          const parsed = tool.inputSchema.parse(tc.input ?? {})
          output = await tool.handler(parsed, input.ctx)
        } catch (e: any) {
          error = e?.message ?? String(e)
        }
      }

      const record: ToolCallRecord = {
        id:          tc.id,
        name:        tc.name,
        input:       tc.input,
        output,
        error,
        executed_at: new Date().toISOString(),
      }
      toolCallsRun.push(record)

      // Actualizar el assistantToolCalls con output/error para la persistencia final
      const pending = assistantToolCalls.find(x => x.id === tc.id)
      if (pending) {
        pending.output = output
        pending.error = error
      }

      opts.onEvent?.({ type: 'tool_end', callId: tc.id, output, error })

      // Push tool_result message
      const resultContent = error
        ? JSON.stringify({ error })
        : JSON.stringify(output ?? null)
      working.push({
        role:         'tool_result',
        content:      resultContent,
        tool_call_id: tc.id,
      })
    }
  }

  opts.onEvent?.({ type: 'done', text: finalText, toolCalls: toolCallsRun })

  return { text: finalText, toolCalls: toolCallsRun }
}
