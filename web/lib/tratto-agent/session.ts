import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { ChatMessage, ChatSession, ToolCallRecord } from './types'

type Transport = 'sidebar' | 'whatsapp' | 'mobile'

export async function loadOrCreateSession(
  userId: string,
  workspaceId: string,
  transport: Transport,
  sessionId?: string,
): Promise<ChatSession> {
  const service = createServiceClient()

  if (sessionId) {
    const { data } = await service
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data) return data as ChatSession
  }

  // WhatsApp: 1 sesión activa por user (reutiliza la más reciente)
  if (transport === 'whatsapp') {
    const { data } = await service
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('transport', 'whatsapp')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) return data as ChatSession
  }

  const { data, error } = await service
    .from('chat_sessions')
    .insert({ user_id: userId, workspace_id: workspaceId, transport })
    .select('*')
    .single()

  if (error) throw new Error(`No se pudo crear sesión: ${error.message}`)
  return data as ChatSession
}

export async function loadHistory(
  sessionId: string,
  limit = 20,
): Promise<ChatMessage[]> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('chat_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`No se pudo cargar historial: ${error.message}`)

  // Regresamos en orden cronológico ascendente
  const rows = (data ?? []).reverse()

  return rows.map((row: any): ChatMessage => {
    const raw = row.tool_calls as any
    if (row.role === 'tool_result') {
      return {
        id:            row.id,
        role:          'tool_result',
        content:       row.content,
        tool_call_id:  raw?.tool_call_id,
        created_at:    row.created_at,
      }
    }
    return {
      id:          row.id,
      role:        row.role,
      content:     row.content,
      tool_calls:  Array.isArray(raw) ? (raw as ToolCallRecord[]) : undefined,
      created_at:  row.created_at,
    }
  })
}

export async function appendMessage(
  sessionId: string,
  msg: ChatMessage,
): Promise<void> {
  const service = createServiceClient()

  const toolCallsJson =
    msg.role === 'tool_result'
      ? (msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : null)
      : (msg.tool_calls ?? null)

  const { error } = await service
    .from('chat_messages')
    .insert({
      session_id:  sessionId,
      role:        msg.role,
      content:     msg.content,
      tool_calls:  toolCallsJson,
    })

  if (error) throw new Error(`No se pudo guardar mensaje: ${error.message}`)
}
