import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveBoard, getBoardMembership } from './_helpers'

const Input = z.object({
  board_key: z.string().max(100).describe('system_key, slug o nombre del board'),
  name: z.string().min(1).max(100).describe('Nombre visible de la columna'),
  kind: z.enum([
    'text', 'number', 'date', 'select', 'multiselect', 'people', 'boolean',
    'url', 'email', 'phone', 'file', 'formula', 'rollup', 'relation',
  ]).describe('Tipo de columna'),
  options: z.array(z.object({
    label: z.string().min(1).max(50),
    color: z.string().max(20).optional(),
  })).optional().describe('Opciones para kind=select|multiselect'),
  relation_target_board_key: z.string().max(100).optional()
    .describe('Para kind=relation: board_key del board destino'),
  rollup: z.object({
    source_col_key: z.string().describe('col_key de una columna numérica/formula en sub_item_columns del MISMO board'),
    aggregate: z.enum(['sum', 'count', 'count_not_empty', 'avg', 'min', 'max']).default('sum'),
    source_level: z.enum(['children', 'descendants']).default('children'),
  }).optional().describe('Para kind=rollup: cómo agregar valores de sub-items'),
  formula: z.object({
    op: z.enum(['multiply', 'add', 'subtract', 'divide', 'percent']),
    col_a: z.string().describe('col_key de columna numérica del board'),
    col_b: z.string().describe('col_key de columna numérica del board'),
  }).optional().describe('Para kind=formula tipo aritmético entre 2 columnas del board'),
})

type Out = {
  column: { sid?: number; col_key: string; name: string; kind: string }
  board: string
  message: string
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const board = await resolveBoard(ctx, input.board_key)
  if (!board) throw new Error(`Board '${input.board_key}' no encontrado`)

  const member = await getBoardMembership(ctx, board.id)
  if (member?.access !== 'admin' && ctx.role !== 'admin' && ctx.role !== 'superadmin') {
    throw new Error(`Solo administradores del board pueden crear columnas. Pide acceso al admin de '${board.name}'.`)
  }

  let settings: Record<string, unknown> = {}

  if (input.kind === 'select' || input.kind === 'multiselect') {
    if (!input.options || input.options.length === 0) {
      throw new Error('Las columnas select/multiselect requieren opciones (al menos 1)')
    }
    settings = { options: input.options }
  }

  if (input.kind === 'relation') {
    if (!input.relation_target_board_key) {
      throw new Error('Para kind=relation es necesario relation_target_board_key')
    }
    const targetBoard = await resolveBoard(ctx, input.relation_target_board_key)
    if (!targetBoard) {
      throw new Error(`Board destino '${input.relation_target_board_key}' no encontrado`)
    }
    settings = { target_board_id: targetBoard.id }
  }

  if (input.kind === 'rollup') {
    if (!input.rollup) {
      throw new Error('Para kind=rollup es necesario rollup')
    }
    const { data: subCol } = await service
      .from('sub_item_columns')
      .select('col_key, kind')
      .eq('board_id', board.id)
      .eq('col_key', input.rollup.source_col_key)
      .maybeSingle()

    if (!subCol) {
      const { data: availableCols } = await service
        .from('sub_item_columns')
        .select('col_key')
        .eq('board_id', board.id)
      const available = availableCols?.map((c: any) => c.col_key).join(', ') ?? 'ninguna'
      throw new Error(`La sub-columna '${input.rollup.source_col_key}' no existe en este board. Sub-columnas disponibles: ${available}`)
    }

    const numericKinds = ['number', 'formula', 'currency']
    const countAggregates = ['count', 'count_not_empty']
    const isNumeric = numericKinds.includes((subCol as any).kind)
    const isCountAgg = countAggregates.includes(input.rollup.aggregate)

    if (!isNumeric && !isCountAgg) {
      throw new Error(`La sub-columna '${input.rollup.source_col_key}' es de tipo ${(subCol as any).kind}. Solo columnas numéricas (number, formula, currency) pueden sumarse/promediarse. Para contar items, usa aggregate=count o count_not_empty.`)
    }

    settings = {
      rollup_config: {
        source_level: input.rollup.source_level,
        source_col_key: input.rollup.source_col_key,
        aggregate: input.rollup.aggregate,
      },
    }
  }

  if (input.kind === 'formula') {
    if (!input.formula) {
      throw new Error('Para kind=formula es necesario formula')
    }
    const { data: cols } = await service
      .from('board_columns')
      .select('col_key')
      .eq('board_id', board.id)
    const colKeys = new Set((cols ?? []).map((c: any) => c.col_key))

    if (!colKeys.has(input.formula.col_a) || !colKeys.has(input.formula.col_b)) {
      const available = Array.from(colKeys).join(', ')
      throw new Error(`Una o ambas columnas no existen. Columnas del board: ${available}`)
    }

    settings = {
      formula_config: {
        type: 'arithmetic',
        op: input.formula.op,
        col_a: input.formula.col_a,
        col_b: input.formula.col_b,
      },
    }
  }

  const baseKey = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  let col_key = baseKey
  let attempt = 0
  while (true) {
    const { data: existing } = await service
      .from('board_columns')
      .select('id')
      .eq('board_id', board.id)
      .eq('col_key', col_key)
      .maybeSingle()
    if (!existing) break
    attempt++
    col_key = `${baseKey}_${attempt}`
  }

  const { data: maxPos } = await service
    .from('board_columns')
    .select('position')
    .eq('board_id', board.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const position = ((maxPos as any)?.position ?? -1) + 1

  const { data: newColumn, error: insertErr } = await service
    .from('board_columns')
    .insert({
      board_id: board.id,
      col_key,
      name: input.name,
      kind: input.kind,
      position,
      is_system: false,
      is_hidden: false,
      required: false,
      settings,
    })
    .select('id, col_key, name, kind')
    .single()

  if (insertErr) throw new Error(insertErr.message)

  let message: string
  if (input.kind === 'rollup') {
    message = `Creé columna '${input.name}' (rollup ${input.rollup!.aggregate} de '${input.rollup!.source_col_key}') en ${board.name}`
  } else if (input.kind === 'formula') {
    message = `Creé columna '${input.name}' (fórmula ${input.formula!.col_a} ${input.formula!.op} ${input.formula!.col_b}) en ${board.name}`
  } else if (input.kind === 'select') {
    message = `Creé columna '${input.name}' (select con ${input.options!.length} opciones) en ${board.name}`
  } else if (input.kind === 'multiselect') {
    message = `Creé columna '${input.name}' (multiselect con ${input.options!.length} opciones) en ${board.name}`
  } else if (input.kind === 'relation') {
    const targetBoard = await resolveBoard(ctx, input.relation_target_board_key!)
    message = `Creé columna '${input.name}' (relación a ${targetBoard!.name}) en ${board.name}`
  } else {
    message = `Creé columna '${input.name}' (${input.kind}) en ${board.name}`
  }

  return {
    column: {
      col_key: (newColumn as any).col_key,
      name: (newColumn as any).name,
      kind: (newColumn as any).kind,
    },
    board: board.name,
    message,
  }
}

export const createColumn: TrattoTool<z.infer<typeof Input>, Out> = {
  name: 'create_column',
  description: 'Crea una nueva columna en un board. Solo admins del board pueden usarla. Soporta kinds: text, number, date, select, multiselect, people, boolean, url, email, phone, file, formula (aritmética entre 2 columnas), rollup (agrega sub-items), relation (link a otro board). Retorna confirmación con el nombre de la columna creada.',
  inputSchema: Input,
  handler,
}
