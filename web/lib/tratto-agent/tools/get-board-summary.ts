import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveBoard, getBoardMembership } from './_helpers'

const Input = z.object({
  board_key: z.string().max(100),
  group_by:  z.enum(['stage']).optional(),
  sum_col:   z.string().max(100).optional(),
})

type Out = {
  board:  string
  total:  { count: number; sum?: number }
  groups: Array<{ key: string; count: number; sum?: number }>
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const board = await resolveBoard(ctx, input.board_key)
  if (!board) throw new Error(`Board '${input.board_key}' no encontrado`)

  const member = await getBoardMembership(ctx, board.id)
  if (!member) throw new Error('Sin acceso al board')

  // Fetch items + stage
  let q = service
    .from('items')
    .select('id, stage_id, owner_id, board_stages(name)')
    .eq('workspace_id', ctx.workspaceId)
    .eq('board_id', board.id)
  if (member.restrict_to_own) q = q.eq('owner_id', ctx.userId)

  const { data: items } = await q
  const rows = items ?? []

  // Columna de suma opcional
  let sumColumnId: string | null = null
  if (input.sum_col) {
    const { data: col } = await service
      .from('board_columns')
      .select('id, kind')
      .eq('board_id', board.id)
      .eq('col_key', input.sum_col)
      .maybeSingle()
    if (col && ((col as any).kind === 'number' || (col as any).kind === 'currency' || (col as any).kind === 'formula' || (col as any).kind === 'rollup')) {
      sumColumnId = (col as any).id
    }
  }

  let valueMap = new Map<string, number>()
  if (sumColumnId && rows.length) {
    const itemIds = rows.map((r: any) => r.id)
    const { data: vals } = await service
      .from('item_values')
      .select('item_id, value_number')
      .eq('column_id', sumColumnId)
      .in('item_id', itemIds)
    valueMap = new Map((vals ?? []).map((v: any) => [v.item_id, Number(v.value_number ?? 0)]))
  }

  let totalCount = 0
  let totalSum = 0
  const groups = new Map<string, { count: number; sum: number }>()

  for (const r of rows) {
    totalCount++
    const val = valueMap.get((r as any).id) ?? 0
    totalSum += val

    if (input.group_by === 'stage') {
      const key = (r as any).board_stages?.name ?? 'Sin etapa'
      const g = groups.get(key) ?? { count: 0, sum: 0 }
      g.count++
      g.sum += val
      groups.set(key, g)
    }
  }

  return {
    board: board.name,
    total: sumColumnId ? { count: totalCount, sum: totalSum } : { count: totalCount },
    groups: [...groups.entries()].map(([key, g]) => ({
      key,
      count: g.count,
      ...(sumColumnId ? { sum: g.sum } : {}),
    })),
  }
}

export const getBoardSummary: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'get_board_summary',
  description: 'Resumen de un board: conteo total de items y opcionalmente agrupado por etapa + suma de una columna numérica (ej col_key=monto o valor). Aplica restrict_to_own automáticamente.',
  inputSchema: Input,
  handler,
}
