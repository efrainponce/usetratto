import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk, verifyBoardAccess, getNextPosition } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const viewId = new URL(req.url).searchParams.get('viewId')
  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  let query = supabase
    .from('sub_item_columns')
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, is_system, settings, source_col_key')
    .eq('board_id', id)
    .order('position')

  if (viewId) query = query.eq('view_id', viewId)

  const { data: columns, error } = await query

  if (error) return jsonError(error.message, 500)
  return jsonOk(columns ?? [])
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const body = await req.json() as {
    col_key: string
    name: string
    kind: string
    position?: number
    is_hidden?: boolean
    required?: boolean
    is_system?: boolean
    settings?: Record<string, unknown>
    source_col_key?: string | null
    view_id?: string | null
  }

  const supabase = createServiceClient()

  // Verify board belongs to workspace
  const verified = await verifyBoardAccess(supabase, id, auth.workspaceId)
  if (verified instanceof NextResponse) return verified

  // Get next position if not provided
  let position = body.position
  if (position === undefined) {
    position = await getNextPosition(supabase, 'sub_item_columns', 'board_id', id)
  }

  const { data, error } = await supabase
    .from('sub_item_columns')
    .insert({
      board_id: id,
      col_key: body.col_key,
      name: body.name,
      kind: body.kind,
      position,
      is_hidden: body.is_hidden ?? false,
      required: body.required ?? false,
      is_system: body.is_system ?? false,
      settings: body.settings ?? {},
      source_col_key: body.source_col_key ?? null,
      view_id: body.view_id ?? null,
    })
    .select('id, board_id, col_key, name, kind, position, is_hidden, required, is_system, settings, source_col_key')
    .single()

  if (error) return jsonError(error.message, 500)

  // Backfill: if the new column is mapped to a source col, copy values for all
  // existing sub_items of this view that have a source_item_id set.
  // Avoids the "new column shows empty until user clicks ↻" UX papercut.
  if (data && body.source_col_key && body.view_id) {
    try {
      const { data: subs } = await supabase
        .from('sub_items')
        .select('id, source_item_id')
        .eq('view_id', body.view_id)
        .not('source_item_id', 'is', null)

      const sourceItemIds = (subs ?? []).map(s => s.source_item_id).filter(Boolean) as string[]

      if (sourceItemIds.length > 0) {
        const { data: sourceItem } = await supabase
          .from('items')
          .select('board_id')
          .eq('id', sourceItemIds[0])
          .single()

        if (sourceItem) {
          const { data: sourceCol } = await supabase
            .from('board_columns')
            .select('id, kind')
            .eq('board_id', sourceItem.board_id)
            .eq('col_key', body.source_col_key)
            .maybeSingle()

          if (sourceCol) {
            const { data: sourceVals } = await supabase
              .from('item_values')
              .select('item_id, value_text, value_number, value_date, value_json')
              .eq('column_id', sourceCol.id)
              .in('item_id', sourceItemIds)

            const valsByItem: Record<string, { value_text: string | null; value_number: number | null; value_date: string | null; value_json: unknown }> = {}
            for (const v of sourceVals ?? []) {
              valsByItem[v.item_id] = v
            }

            const rows = (subs ?? []).flatMap(s => {
              if (!s.source_item_id) return []
              const v = valsByItem[s.source_item_id]
              if (!v) return []
              return [{
                sub_item_id: s.id,
                column_id: data.id,
                value_text:   v.value_text,
                value_number: v.value_number,
                value_date:   v.value_date,
                value_json:   v.value_json,
              }]
            })

            if (rows.length > 0) {
              await supabase.from('sub_item_values').insert(rows)
            }
          }
        }
      }
    } catch (backfillErr) {
      console.error('[POST sub-item-columns] backfill error:', backfillErr)
      // do not fail the request — column is created, user can refresh manually
    }
  }

  return jsonOk(data, 201)
}
