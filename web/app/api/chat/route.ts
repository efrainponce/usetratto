import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError } from '@/lib/api-helpers'
import { runAgent } from '@/lib/tratto-agent/agent'
import { loadOrCreateSession, loadHistory, appendMessage } from '@/lib/tratto-agent/session'
import { BudgetExceededError, assertBudget } from '@/lib/tratto-agent/billing'
import type { StreamEvent, AgentContext } from '@/lib/tratto-agent/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_MESSAGE = 500

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  let body: { message?: string; sessionId?: string; boardSid?: number }
  try {
    body = await req.json()
  } catch {
    return jsonError('JSON inválido', 400)
  }

  const message = (body.message ?? '').trim()
  if (!message) return jsonError('Mensaje vacío', 400)
  if (message.length > MAX_MESSAGE) return jsonError(`Máximo ${MAX_MESSAGE} caracteres`, 400)

  // Resolver board activo (opcional) por sid
  let boardId: string | undefined
  if (body.boardSid) {
    const service = createServiceClient()
    const { data: b } = await service
      .from('boards')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('sid', body.boardSid)
      .maybeSingle()
    boardId = (b as any)?.id
  }

  // Budget check ANTES de crear sesión/gastar nada — si está reventado, corta inmediato
  try {
    await assertBudget(auth.workspaceId)
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      return new Response(
        JSON.stringify({ error: err.message, details: err.details }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw err
  }

  const session = await loadOrCreateSession(auth.userId, auth.workspaceId, 'sidebar', body.sessionId)
  const history = await loadHistory(session.id, 20)

  // Guarda el mensaje del user inmediatamente
  await appendMessage(session.id, { role: 'user', content: message })

  const ctx: AgentContext = {
    userId:      auth.userId,
    userSid:     auth.userSid,
    workspaceId: auth.workspaceId,
    role:        auth.role,
    userName:    auth.name,
    boardId,
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
      }

      // Send sessionId como primer evento para que el cliente lo persista
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId: session.id })}\n\n`),
      )

      try {
        const out = await runAgent(
          { ctx, message, history },
          { onEvent: send, sessionId: session.id },
        )

        // Persistir assistant message + tool_results
        await appendMessage(session.id, {
          role:       'assistant',
          content:    out.text,
          tool_calls: out.toolCalls,
        })
        for (const tc of out.toolCalls) {
          await appendMessage(session.id, {
            role:         'tool_result',
            content:      tc.error ? JSON.stringify({ error: tc.error }) : JSON.stringify(tc.output ?? null),
            tool_call_id: tc.id,
          })
        }
      } catch (err: any) {
        if (err instanceof BudgetExceededError) {
          send({ type: 'error', message: err.message })
        } else {
          send({ type: 'error', message: err?.message ?? 'Error del asistente' })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':   'text/event-stream; charset=utf-8',
      'Cache-Control':  'no-cache, no-transform',
      'Connection':     'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
