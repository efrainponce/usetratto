import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveBoard, getBoardMembership } from './_helpers'

const Input = z.object({
  query:     z.string().max(200).optional(),
  board_key: z.string().max(100).optional(),
  stage:     z.string().max(100).optional(),
  owner_me:  z.boolean().optional(),
  overdue:   z.boolean().optional(),
  limit:     z.number().int().min(1).max(20).default(10),
})

type Out = {
  count: number
  items: Array<{
    sid:      number
    name:     string
    board:    string
    stage:    string | null
    owner:    string | null
    deadline: string | null
  }>
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  let query = service
    .from('items')
    .select('sid, name, deadline, owner_id, stage_id, board_id, boards!inner(name), board_stages(name)')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(input.limit)

  if (input.board_key) {
    const board = await resolveBoard(ctx, input.board_key)
    if (!board) return { count: 0, items: [] }
    query = query.eq('board_id', board.id)

    const member = await getBoardMembership(ctx, board.id)
    if (!member) return { count: 0, items: [] }
    if (member.restrict_to_own) query = query.eq('owner_id', ctx.userId)
  } else {
    // Sin board_key: solo items donde user es owner (safe default)
    query = query.eq('owner_id', ctx.userId)
  }

  if (input.query) query = query.ilike('name', `%${input.query}%`)
  if (input.owner_me) query = query.eq('owner_id', ctx.userId)
  if (input.overdue) {
    const today = new Date().toISOString().slice(0, 10)
    query = query.lt('deadline', today).not('deadline', 'is', null)
  }
  if (input.stage) {
    const { data: stageRows } = await service
      .from('board_stages')
      .select('id')
      .ilike('name', input.stage)
    const stageIds = (stageRows ?? []).map((s: any) => s.id)
    if (stageIds.length) query = query.in('stage_id', stageIds)
    else return { count: 0, items: [] }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Resolver nombres de owner
  const ownerIds = [...new Set((data ?? []).map((r: any) => r.owner_id).filter(Boolean))]
  const ownerMap = new Map<string, string>()
  if (ownerIds.length) {
    const { data: users } = await service.from('users').select('id, name').in('id', ownerIds)
    for (const u of users ?? []) ownerMap.set(u.id, u.name ?? '')
  }

  return {
    count: data?.length ?? 0,
    items: (data ?? []).map((r: any) => ({
      sid:      r.sid,
      name:     r.name,
      board:    r.boards?.name ?? '',
      stage:    r.board_stages?.name ?? null,
      owner:    r.owner_id ? (ownerMap.get(r.owner_id) ?? null) : null,
      deadline: r.deadline,
    })),
  }
}

export const searchItems: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'search_items',
  description: 'Busca items (oportunidades, contactos, etc.) por texto, board, etapa, owner o vencimiento. Devuelve hasta 20 resultados con sid, nombre, board, etapa, owner y deadline.',
  inputSchema: Input,
  handler,
}
