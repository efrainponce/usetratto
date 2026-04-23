import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { AgentContext } from '../types'

// Resuelve board por system_key, slug, o nombre (case-insensitive). Scoped al workspace del user.
export async function resolveBoard(
  ctx: AgentContext,
  key: string,
): Promise<{ id: string; sid: number; name: string; type: 'pipeline' | 'table'; system_key: string | null } | null> {
  const service = createServiceClient()
  const k = key.trim()

  // Intenta system_key primero
  const { data: bySystem } = await service
    .from('boards')
    .select('id, sid, name, type, system_key')
    .eq('workspace_id', ctx.workspaceId)
    .eq('system_key', k.toLowerCase())
    .maybeSingle()
  if (bySystem) return bySystem as any

  // Slug
  const { data: bySlug } = await service
    .from('boards')
    .select('id, sid, name, type, system_key')
    .eq('workspace_id', ctx.workspaceId)
    .eq('slug', k.toLowerCase())
    .maybeSingle()
  if (bySlug) return bySlug as any

  // Nombre (ilike)
  const { data: byName } = await service
    .from('boards')
    .select('id, sid, name, type, system_key')
    .eq('workspace_id', ctx.workspaceId)
    .ilike('name', k)
    .maybeSingle()
  if (byName) return byName as any

  return null
}

export async function resolveItemBySid(
  ctx: AgentContext,
  sid: number,
): Promise<{ id: string; sid: number; name: string; board_id: string; stage_id: string | null; owner_id: string | null } | null> {
  const service = createServiceClient()
  const { data } = await service
    .from('items')
    .select('id, sid, name, board_id, stage_id, owner_id, workspace_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('sid', sid)
    .maybeSingle()
  return (data as any) ?? null
}

// Lee flag restrict_to_own del board para este user
export async function getBoardMembership(
  ctx: AgentContext,
  boardId: string,
): Promise<{ access: string; restrict_to_own: boolean } | null> {
  const service = createServiceClient()

  // Admin workspace bypass
  if (ctx.role === 'admin' || ctx.role === 'superadmin') {
    return { access: 'admin', restrict_to_own: false }
  }

  // Direct member
  const { data: direct } = await service
    .from('board_members')
    .select('access, restrict_to_own')
    .eq('board_id', boardId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (direct) return direct as any

  // Team member
  const { data: teamMember } = await service
    .from('board_members')
    .select('access, restrict_to_own, team_id')
    .eq('board_id', boardId)
    .not('team_id', 'is', null)
  if (teamMember && teamMember.length) {
    const { data: userTeams } = await service
      .from('user_teams')
      .select('team_id')
      .eq('user_id', ctx.userId)
    const teamIds = new Set((userTeams ?? []).map((r: any) => r.team_id))
    const match = teamMember.find((m: any) => teamIds.has(m.team_id))
    if (match) return { access: match.access, restrict_to_own: match.restrict_to_own } as any
  }

  // Sin board_members = público del workspace
  const { count } = await service
    .from('board_members')
    .select('id', { count: 'exact', head: true })
    .eq('board_id', boardId)
  if ((count ?? 0) === 0) return { access: 'edit', restrict_to_own: false }

  return null
}

// Formatea value crudo de item_values a algo legible para el agente
export function formatValueFromRow(row: {
  value_text:   string | null
  value_number: number | null
  value_date:   string | null
  value_json:   unknown
}, kind: string): unknown {
  if (kind === 'number' || kind === 'currency' || kind === 'formula' || kind === 'rollup') return row.value_number
  if (kind === 'date') return row.value_date
  if (kind === 'boolean' || kind === 'multiselect' || kind === 'file' || kind === 'image' || kind === 'people') return row.value_json
  return row.value_text
}

// Mapa de kind → columna de item_values donde se guarda
export function valueColumnForKind(kind: string): 'value_text' | 'value_number' | 'value_date' | 'value_json' {
  if (kind === 'number' || kind === 'currency') return 'value_number'
  if (kind === 'date') return 'value_date'
  if (kind === 'boolean' || kind === 'multiselect' || kind === 'file' || kind === 'image' || kind === 'people') return 'value_json'
  return 'value_text'
}
