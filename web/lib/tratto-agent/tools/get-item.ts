import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveItemBySid, getBoardMembership, formatValueFromRow } from './_helpers'

const Input = z.object({
  item_sid: z.number().int().positive(),
})

type Out = {
  sid:       number
  name:      string
  board:     string
  stage:     string | null
  owner:     string | null
  values:    Record<string, unknown>
  sub_items_count: number
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const item = await resolveItemBySid(ctx, input.item_sid)
  if (!item) throw new Error(`Item ${input.item_sid} no encontrado`)

  // Permiso de acceso al board
  const member = await getBoardMembership(ctx, item.board_id)
  if (!member) throw new Error('Sin acceso al board de este item')
  if (member.restrict_to_own && item.owner_id !== ctx.userId) {
    throw new Error(`Item ${input.item_sid} no encontrado`)
  }

  // Fetch columns + values
  const [{ data: columns }, { data: values }, { data: board }, { data: stage }, { data: owner }, { count: subCount }] = await Promise.all([
    service.from('board_columns').select('id, col_key, kind').eq('board_id', item.board_id),
    service.from('item_values').select('column_id, value_text, value_number, value_date, value_json').eq('item_id', item.id),
    service.from('boards').select('name').eq('id', item.board_id).maybeSingle(),
    item.stage_id
      ? service.from('board_stages').select('name').eq('id', item.stage_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.owner_id
      ? service.from('users').select('name').eq('id', item.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    service.from('sub_items').select('id', { count: 'exact', head: true }).eq('item_id', item.id).eq('depth', 0),
  ])

  const colByIdEntries = (columns ?? []).map((c: any) => [c.id, c] as const)
  const colMap = new Map<string, { col_key: string; kind: string }>(colByIdEntries as any)
  const flat: Record<string, unknown> = {}
  for (const v of values ?? []) {
    const col = colMap.get((v as any).column_id)
    if (!col) continue
    flat[col.col_key] = formatValueFromRow(v as any, col.kind)
  }

  return {
    sid:             item.sid,
    name:            item.name,
    board:           (board as any)?.name ?? '',
    stage:           (stage as any)?.name ?? null,
    owner:           (owner as any)?.name ?? null,
    values:          flat,
    sub_items_count: subCount ?? 0,
  }
}

export const getItem: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'get_item',
  description: 'Obtiene el detalle completo de un item por sid: nombre, board, etapa, owner, todos los valores de columnas y conteo de sub-items.',
  inputSchema: Input,
  handler,
}
