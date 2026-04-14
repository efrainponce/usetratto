import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = createServiceClient()

  // 1. Load sub-item by id
  const { data: subItem } = await supabase
    .from('sub_items')
    .select('id, item_id, workspace_id, depth, source_item_id')
    .eq('id', id)
    .single()

  if (!subItem) {
    return NextResponse.json({ error: 'Sub-item not found' }, { status: 404 })
  }

  // Check depth is 0
  if (subItem.depth !== 0) {
    return NextResponse.json(
      { error: 'Solo sub-items de profundidad 0 pueden refrescarse' },
      { status: 400 }
    )
  }

  // Check source_item_id is not null
  if (!subItem.source_item_id) {
    return NextResponse.json(
      { error: 'Sub-item sin fuente' },
      { status: 400 }
    )
  }

  // 2. Status check (locked guard)
  // Load parent item board_id
  const { data: parentItem } = await supabase
    .from('items')
    .select('board_id')
    .eq('id', subItem.item_id)
    .single()

  if (!parentItem) {
    return NextResponse.json({ error: 'Parent item not found' }, { status: 404 })
  }

  // Load board settings
  const { data: board } = await supabase
    .from('boards')
    .select('settings')
    .eq('id', parentItem.board_id)
    .single()

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const boardSettings = board.settings as Record<string, unknown> || {}
  const statusSubColKey = boardSettings.status_sub_col_key as string | null
  const closedSubValues = boardSettings.closed_sub_values as string[] | null

  // If both status_sub_col_key and closed_sub_values exist, check if locked
  if (statusSubColKey && closedSubValues && closedSubValues.length > 0) {
    // Find the sub_item_column with col_key = status_sub_col_key
    const { data: statusCol } = await supabase
      .from('sub_item_columns')
      .select('id')
      .eq('col_key', statusSubColKey)
      .eq('board_id', parentItem.board_id)
      .single()

    if (statusCol) {
      // Load sub_item_values for this column
      const { data: statusValue } = await supabase
        .from('sub_item_values')
        .select('value_text')
        .eq('sub_item_id', id)
        .eq('column_id', statusCol.id)
        .maybeSingle()

      if (statusValue?.value_text && closedSubValues.includes(statusValue.value_text)) {
        return NextResponse.json(
          { error: 'Sub-item terminado — no se puede refrescar', locked: true },
          { status: 409 }
        )
      }
    }
  }

  // 3. Value refresh
  // Load sub_item_columns with source_col_key mapping
  const { data: subItemCols } = await supabase
    .from('sub_item_columns')
    .select('id, source_col_key')
    .eq('board_id', parentItem.board_id)
    .not('source_col_key', 'is', null)

  if (!subItemCols || subItemCols.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  // Load source item's board_id
  const { data: sourceItem } = await supabase
    .from('items')
    .select('board_id')
    .eq('id', subItem.source_item_id)
    .single()

  if (!sourceItem) {
    return NextResponse.json({ error: 'Source item not found' }, { status: 404 })
  }

  // For each sub_item_column with source_col_key, copy values
  let updated = 0

  for (const subItemCol of subItemCols) {
    const sourceColKey = subItemCol.source_col_key as string

    // Find board_column in source board
    const { data: sourceBoardCol } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', sourceItem.board_id)
      .eq('col_key', sourceColKey)
      .maybeSingle()

    if (!sourceBoardCol) {
      // Source column doesn't exist, skip
      continue
    }

    // Find item_value in source item
    const { data: sourceValue } = await supabase
      .from('item_values')
      .select('value_text, value_number, value_date, value_json')
      .eq('item_id', subItem.source_item_id)
      .eq('column_id', sourceBoardCol.id)
      .maybeSingle()

    // Upsert into sub_item_values
    const { error: upsertError } = await supabase
      .from('sub_item_values')
      .upsert(
        {
          sub_item_id: id,
          column_id: subItemCol.id,
          value_text: sourceValue?.value_text ?? null,
          value_number: sourceValue?.value_number ?? null,
          value_date: sourceValue?.value_date ?? null,
          value_json: sourceValue?.value_json ?? null,
        },
        { onConflict: 'sub_item_id,column_id' }
      )

    if (!upsertError) {
      updated++
    }
  }

  return NextResponse.json({ updated })
}
