import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveBoard, getBoardMembership } from './_helpers'

const Input = z.object({
  board_key: z.string().max(100).describe('system_key, slug o nombre del board (debe ser tipo pipeline)'),
  name: z.string().min(1).max(60).describe('Nombre de la nueva etapa'),
  color: z.string().max(20).optional()
    .describe('Color hex de la etapa (ej #4F46E5). Si se omite, asigna uno por defecto.'),
  position: z.number().int().min(0).max(50).optional()
    .describe('Posición 0-indexed donde insertar. Si se omite, va al final.'),
  is_closed: z.boolean().optional().default(false)
    .describe('Marca etapa como cerrada/terminal (ganada/perdida/cancelada)'),
})

type Out = {
  stage: { sid: number; name: string; color: string; position: number; is_closed: boolean }
  board: string
  message: string
}

const DEFAULT_PALETTE = ['#3B82F6', '#A855F7', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899']

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const board = await resolveBoard(ctx, input.board_key)
  if (!board) throw new Error(`Board '${input.board_key}' no encontrado`)

  if (board.type !== 'pipeline') {
    throw new Error(`'${board.name}' es tipo tabla — solo boards tipo pipeline tienen etapas`)
  }

  const member = await getBoardMembership(ctx, board.id)
  if (!member || (member.access !== 'admin' && ctx.role !== 'admin' && ctx.role !== 'superadmin')) {
    throw new Error(`Solo administradores del board pueden crear etapas. Pide acceso al admin de '${board.name}'.`)
  }

  let finalColor = input.color
  if (!finalColor) {
    const { count } = await service
      .from('board_stages')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', board.id)
    const stageCount = count ?? 0
    finalColor = DEFAULT_PALETTE[stageCount % DEFAULT_PALETTE.length]
  }

  let finalPosition = input.position
  if (finalPosition === undefined) {
    const { data: maxPos } = await service
      .from('board_stages')
      .select('position')
      .eq('board_id', board.id)
      .order('position', { ascending: false })
      .limit(1)
      .single()
    finalPosition = (maxPos as any)?.position !== undefined ? ((maxPos as any).position + 1) : 0
  } else {
    const { data: toShift } = await service
      .from('board_stages')
      .select('id, position')
      .eq('board_id', board.id)
      .gte('position', finalPosition)
      .order('position', { ascending: false })

    for (const s of toShift ?? []) {
      await service
        .from('board_stages')
        .update({ position: (s as any).position + 1 })
        .eq('id', (s as any).id)
    }
  }

  const { data: stage, error } = await service
    .from('board_stages')
    .insert({
      board_id: board.id,
      name: input.name.trim(),
      color: finalColor,
      position: finalPosition,
      is_closed: input.is_closed ?? false,
    })
    .select('id, sid, name, color, position, is_closed')
    .single()

  if (error) throw new Error(error.message)

  return {
    stage: {
      sid: (stage as any).sid,
      name: (stage as any).name,
      color: (stage as any).color,
      position: (stage as any).position,
      is_closed: (stage as any).is_closed,
    },
    board: board.name,
    message: `Creé etapa '${(stage as any).name}'${input.is_closed ? ' (cerrada)' : ''} en posición ${(stage as any).position} de ${board.name}`,
  }
}

export const createStage: TrattoTool<z.infer<typeof Input>, Out> = {
  name: 'create_stage',
  description: 'Crea una nueva etapa en un board tipo pipeline. Solo admins del board pueden usarla. Acepta name, color (opcional, hex), position (opcional, default al final), is_closed (opcional, default false). Retorna confirmación con sid de la etapa.',
  inputSchema: Input,
  handler,
}
