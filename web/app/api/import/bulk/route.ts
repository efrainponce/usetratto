import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient }         from '@/lib/supabase/server'
import { NextResponse }                 from 'next/server'
import { jsonError } from '@/lib/api-helpers'

// Generic bulk import endpoint.
// All import sources (CSV, Airtable, Monday, etc.) transform their data
// client-side and POST here. No source-specific logic lives here.

type Body = {
  board_id: string
  records:  Array<Record<string, string>>  // col_key → string value, already mapped
}

const SYSTEM_COL_KEYS = new Set(['name', 'stage', 'owner', 'deadline', '__sid'])

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = (await req.json()) as Body
  const { board_id, records } = body

  if (!board_id || !Array.isArray(records) || records.length === 0) {
    return jsonError('board_id and records (min 1) required', 400)
  }

  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', board_id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (!board) {
    return jsonError('Board no encontrado', 404)
  }

  // col_key → column UUID (for item_values)
  const { data: cols } = await supabase
    .from('board_columns')
    .select('id, col_key')
    .eq('board_id', board_id)

  const colKeyToId: Record<string, string> = {}
  for (const c of cols ?? []) colKeyToId[c.col_key] = c.id

  // Stage name → id (case-insensitive match)
  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name')
    .eq('board_id', board_id)

  const stageList = stages ?? []

  // Base position (append after existing items)
  const { data: last } = await supabase
    .from('items')
    .select('position')
    .eq('board_id', board_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const basePos = (last?.position ?? -1) + 1

  // ── Batch insert items ─────────────────────────────────────────────────────
  const itemsPayload = records.map((record, i) => {
    const payload: Record<string, unknown> = {
      workspace_id: auth.workspaceId,
      board_id,
      name:         record['name'] || 'Sin nombre',
      position:     basePos + i,
    }
    if (record['stage']) {
      const stage = stageList.find(s => s.name.toLowerCase() === record['stage'].toLowerCase())
      if (stage) payload.stage_id = stage.id
    }
    if (record['deadline']) payload.deadline = record['deadline']
    return payload
  })

  const { data: inserted, error } = await supabase
    .from('items')
    .insert(itemsPayload)
    .select('id')

  if (error || !inserted) {
    return jsonError(error?.message ?? 'Error al insertar items', 500)
  }

  // ── Batch insert item_values for custom columns ────────────────────────────
  const valuesPayload: Array<{ item_id: string; column_id: string; value_text: string }> = []
  for (let i = 0; i < records.length; i++) {
    const itemId = inserted[i]?.id
    if (!itemId) continue
    for (const [colKey, value] of Object.entries(records[i])) {
      if (SYSTEM_COL_KEYS.has(colKey) || !value) continue
      const colId = colKeyToId[colKey]
      if (!colId) continue
      valuesPayload.push({ item_id: itemId, column_id: colId, value_text: value })
    }
  }
  if (valuesPayload.length > 0) {
    await supabase.from('item_values').insert(valuesPayload)
  }

  return NextResponse.json({ imported: inserted.length })
}
