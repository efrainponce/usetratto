import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveItemBySid, getBoardMembership, formatValueFromRow } from './_helpers'

const Input = z.object({
  item_sid:   z.number().int().positive(),
  stage_name: z.string().min(1).max(100),
})

type Out = {
  sid:       number
  from:      string | null
  to:        string
  ok:        boolean
  blocked_by?: Array<{ col_key: string; reason: string }>
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

  // Target stage
  const { data: target } = await service
    .from('board_stages')
    .select('id, name')
    .eq('board_id', item.board_id)
    .ilike('name', input.stage_name)
    .maybeSingle()
  if (!target) throw new Error(`Etapa '${input.stage_name}' no existe en este board`)

  // From stage name
  let fromName: string | null = null
  if (item.stage_id) {
    const { data: current } = await service
      .from('board_stages')
      .select('name')
      .eq('id', item.stage_id)
      .maybeSingle()
    fromName = (current as any)?.name ?? null
  }

  // Stage gates: lee del primary_stage col (role='primary_stage') settings.stage_gates
  const { data: stageCols } = await service
    .from('board_columns')
    .select('settings')
    .eq('board_id', item.board_id)
    .eq('kind', 'select')
  const gates: Record<string, string[]> = {}
  for (const c of stageCols ?? []) {
    const s = (c as any).settings as any
    if (s?.role === 'primary_stage' && s?.stage_gates) {
      Object.assign(gates, s.stage_gates)
    }
  }
  const requiredKeys: string[] = gates[(target as any).id] ?? []

  if (requiredKeys.length) {
    const { data: cols } = await service
      .from('board_columns')
      .select('id, col_key, kind')
      .eq('board_id', item.board_id)
      .in('col_key', requiredKeys)
    const { data: values } = await service
      .from('item_values')
      .select('column_id, value_text, value_number, value_date, value_json')
      .eq('item_id', item.id)
    const valByCol = new Map((values ?? []).map((v: any) => [v.column_id, v]))

    const blocked: Array<{ col_key: string; reason: string }> = []
    for (const col of cols ?? []) {
      const v = valByCol.get((col as any).id)
      const raw = v ? formatValueFromRow(v as any, (col as any).kind) : null
      const empty = raw === null || raw === undefined || raw === '' ||
                    (Array.isArray(raw) && raw.length === 0)
      if (empty) blocked.push({ col_key: (col as any).col_key, reason: 'requerido y vacío' })
    }

    if (blocked.length) {
      return {
        sid:        item.sid,
        from:       fromName,
        to:         (target as any).name,
        ok:         false,
        blocked_by: blocked,
      }
    }
  }

  const { error } = await service
    .from('items')
    .update({ stage_id: (target as any).id })
    .eq('id', item.id)
  if (error) throw new Error(error.message)

  return { sid: item.sid, from: fromName, to: (target as any).name, ok: true }
}

export const changeStage: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'change_stage',
  description: 'Mueve un item a otra etapa. Respeta los stage gates: si hay columnas requeridas vacías, retorna ok=false con blocked_by y no hace el cambio.',
  inputSchema: Input,
  handler,
}
