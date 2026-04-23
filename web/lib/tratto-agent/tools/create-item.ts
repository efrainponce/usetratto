import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveBoard, getBoardMembership, valueColumnForKind } from './_helpers'

const Input = z.object({
  board_key:   z.string().max(100),
  name:        z.string().min(1).max(500),
  stage_name:  z.string().max(100).optional(),
  owner_sid:   z.number().int().positive().optional(),
  values:      z.record(z.string(), z.unknown()).optional(),
})

type Out = {
  sid:   number
  name:  string
  board: string
  stage: string | null
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const board = await resolveBoard(ctx, input.board_key)
  if (!board) throw new Error(`Board '${input.board_key}' no encontrado`)

  const member = await getBoardMembership(ctx, board.id)
  if (!member || member.access === 'view') {
    throw new Error(`Sin permiso para crear items en ${board.name}`)
  }

  // Resolver stage si aplica
  let stageId: string | null = null
  let stageName: string | null = null
  if (board.type === 'pipeline') {
    if (input.stage_name) {
      const { data: stage } = await service
        .from('board_stages')
        .select('id, name')
        .eq('board_id', board.id)
        .ilike('name', input.stage_name)
        .maybeSingle()
      if (!stage) throw new Error(`Etapa '${input.stage_name}' no existe en ${board.name}`)
      stageId = (stage as any).id
      stageName = (stage as any).name
    } else {
      // Primera etapa no cerrada
      const { data: stage } = await service
        .from('board_stages')
        .select('id, name')
        .eq('board_id', board.id)
        .eq('is_closed', false)
        .order('position')
        .limit(1)
        .maybeSingle()
      stageId = (stage as any)?.id ?? null
      stageName = (stage as any)?.name ?? null
    }
  }

  // Resolver owner
  let ownerId: string | null = ctx.userId
  if (input.owner_sid) {
    const { data: user } = await service.from('users').select('id').eq('sid', input.owner_sid).eq('workspace_id', ctx.workspaceId).maybeSingle()
    if (!user) throw new Error(`Usuario con sid ${input.owner_sid} no encontrado`)
    ownerId = (user as any).id
  }

  // Insertar item
  const { data: newItem, error: insertErr } = await service
    .from('items')
    .insert({
      workspace_id: ctx.workspaceId,
      board_id:     board.id,
      name:         input.name,
      stage_id:     stageId,
      owner_id:     ownerId,
      created_by:   ctx.userId,
    })
    .select('id, sid, name')
    .single()
  if (insertErr) throw new Error(insertErr.message)

  // Insertar values opcionales
  if (input.values && Object.keys(input.values).length) {
    const { data: cols } = await service
      .from('board_columns')
      .select('id, col_key, kind')
      .eq('board_id', board.id)
    const colByKey = new Map((cols ?? []).map((c: any) => [c.col_key, c]))

    const rows: any[] = []
    for (const [key, value] of Object.entries(input.values)) {
      const col = colByKey.get(key)
      if (!col) continue
      const field = valueColumnForKind((col as any).kind)
      rows.push({
        item_id:   (newItem as any).id,
        column_id: (col as any).id,
        [field]:   value,
      })
    }
    if (rows.length) await service.from('item_values').insert(rows)
  }

  return {
    sid:   (newItem as any).sid,
    name:  (newItem as any).name,
    board: board.name,
    stage: stageName,
  }
}

export const createItem: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'create_item',
  description: 'Crea un nuevo item en un board. Requiere board_key (system_key, slug o nombre) y name. Opcionalmente stage_name, owner_sid y values (map col_key→valor). Retorna el sid del item creado.',
  inputSchema: Input,
  handler,
}
