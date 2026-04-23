import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { userCanEditColumn } from '@/lib/permissions'
import type { TrattoTool, AgentContext } from '../types'
import { resolveItemBySid, getBoardMembership, valueColumnForKind } from './_helpers'

const Input = z.object({
  item_sid: z.number().int().positive(),
  values:   z.record(z.string(), z.unknown()),
})

type Out = {
  sid:      number
  updated:  string[]
  skipped:  Array<{ col_key: string; reason: string }>
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const item = await resolveItemBySid(ctx, input.item_sid)
  if (!item) throw new Error(`Item ${input.item_sid} no encontrado`)

  const member = await getBoardMembership(ctx, item.board_id)
  if (!member || member.access === 'view') throw new Error('Sin permiso de edición')
  if (member.restrict_to_own && item.owner_id !== ctx.userId) {
    throw new Error(`Item ${input.item_sid} no encontrado`)
  }

  const { data: cols } = await service
    .from('board_columns')
    .select('id, col_key, kind, is_system')
    .eq('board_id', item.board_id)
  const colByKey = new Map((cols ?? []).map((c: any) => [c.col_key, c]))

  const updated: string[] = []
  const skipped: Array<{ col_key: string; reason: string }> = []

  for (const [key, value] of Object.entries(input.values)) {
    const col = colByKey.get(key) as any
    if (!col) { skipped.push({ col_key: key, reason: 'columna no existe' }); continue }
    if (col.is_system && (key === 'stage' || key === 'folio' || key === 'created_by' || key === 'created_at' || key === 'updated_at')) {
      skipped.push({ col_key: key, reason: 'columna de sistema de solo lectura' })
      continue
    }

    const canEdit = await userCanEditColumn(
      { type: 'board', id: col.id },
      ctx.userId,
      ctx.workspaceId,
      ctx.role,
    )
    if (!canEdit) { skipped.push({ col_key: key, reason: 'sin permiso de edición' }); continue }

    const field = valueColumnForKind(col.kind)
    const payload: any = {
      item_id:   item.id,
      column_id: col.id,
      value_text: null, value_number: null, value_date: null, value_json: null,
    }
    payload[field] = value

    const { error } = await service
      .from('item_values')
      .upsert(payload, { onConflict: 'item_id,column_id' })
    if (error) { skipped.push({ col_key: key, reason: error.message }); continue }
    updated.push(key)
  }

  return { sid: item.sid, updated, skipped }
}

export const updateItem: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'update_item',
  description: 'Actualiza columnas de un item existente. Recibe item_sid y un mapa values (col_key→valor). Devuelve las columnas actualizadas y las omitidas con motivo.',
  inputSchema: Input,
  handler,
}
