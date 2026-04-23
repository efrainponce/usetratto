// Tipos compartidos del Tratto AI Agent (engine + tools + transports)

import type { z } from 'zod'
import type { AuthUser } from '@/lib/auth/api'

// ── Contexto que viaja con cada tool call ────────────────────────────────
// Inyectado por el servidor desde el JWT. NUNCA viene del mensaje del usuario.
export type AgentContext = {
  userId:      string
  userSid:     number
  workspaceId: string
  role:        AuthUser['role']
  userName:    string | null
  boardId?:    string   // board activo (si el transport lo expone)
}

// ── Mensajes de conversación ─────────────────────────────────────────────
export type ChatRole = 'user' | 'assistant' | 'tool_result'

export type ToolCallRecord = {
  id:        string             // id interno del tool_use block
  name:      string
  input:     unknown
  output?:   unknown
  error?:    string
  executed_at: string            // ISO
}

export type ChatMessage = {
  id?:           string
  role:          ChatRole
  content:       string
  tool_calls?:   ToolCallRecord[]   // role='assistant': tools que pidió ejecutar
  tool_call_id?: string              // role='tool_result': id del tool_use al que responde
  created_at?:   string
}

// ── Tool definition ──────────────────────────────────────────────────────
// Cada tool declara schema Zod + handler. Se convierte a formato Anthropic/Gemini
// en la capa de adapter.
export type TrattoTool<TInput = unknown, TOutput = unknown> = {
  name:        string
  description: string
  inputSchema: z.ZodType<TInput>
  handler:     (input: TInput, ctx: AgentContext) => Promise<TOutput>
}

// ── Input/Output del agente ──────────────────────────────────────────────
export type AgentInput = {
  ctx:       AgentContext
  message:   string               // mensaje nuevo del usuario
  history:   ChatMessage[]        // últimos N mensajes (ya cargados)
}

export type AgentOutput = {
  text:       string
  toolCalls:  ToolCallRecord[]
}

// ── Eventos de streaming (SSE) ───────────────────────────────────────────
export type StreamEvent =
  | { type: 'text_delta';  delta: string }
  | { type: 'tool_start';  name: string; input: unknown; callId: string }
  | { type: 'tool_end';    callId: string; output?: unknown; error?: string }
  | { type: 'done';        text: string; toolCalls: ToolCallRecord[] }
  | { type: 'error';       message: string }

// ── LLM adapter interface (provider-agnostic) ────────────────────────────
// Cada provider (gemini, anthropic) implementa este shape.
export type LLMToolSpec = {
  name:        string
  description: string
  inputSchema: Record<string, unknown>   // JSON Schema (derivado de Zod)
}

export type LLMCompleteInput = {
  system:   string
  messages: ChatMessage[]
  tools:    LLMToolSpec[]
}

export type LLMToolCall = {
  id:    string
  name:  string
  input: unknown
}

export type LLMUsage = {
  input_tokens:  number
  output_tokens: number
}

export type LLMStepResult = {
  text:       string                   // texto acumulado del turn
  toolCalls:  LLMToolCall[]            // tools que el modelo pidió ejecutar
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'other'
  usage:      LLMUsage
  model:      string                   // modelo exacto que respondió (para billing)
}

export interface LLMAdapter {
  readonly providerName: 'gemini' | 'anthropic'

  // Un "step" del loop: le mandas historial + pending tool_results, te regresa
  // texto + tool calls pendientes. El agent loop decide si seguir iterando.
  step(
    input: LLMCompleteInput,
    onTextDelta?: (delta: string) => void,
  ): Promise<LLMStepResult>
}

// ── Session DB shape ─────────────────────────────────────────────────────
export type ChatSession = {
  id:               string
  workspace_id:     string
  user_id:          string
  transport:        'sidebar' | 'whatsapp' | 'mobile'
  created_at:       string
  last_message_at:  string
}
