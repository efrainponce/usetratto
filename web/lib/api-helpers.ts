import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verify board exists and belongs to workspace.
 * Returns board data or NextResponse error.
 */
export async function verifyBoardAccess(
  supabase: SupabaseClient,
  boardId: string,
  workspaceId: string
): Promise<{ board: any } | NextResponse> {
  const { data: board, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error || !board) return jsonError('Not found', 404)
  return { board }
}

/**
 * Get next position value for ordered items in a table.
 * Filters by one column value, orders by position descending, returns max + 1.
 */
export async function getNextPosition(
  supabase: SupabaseClient,
  table: string,
  filterCol: string,
  filterVal: string
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('position')
    .eq(filterCol, filterVal)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.position ?? -1) + 1
}

/**
 * Get next position with multiple filters.
 * Useful for tables with compound filtering keys.
 */
export async function getNextPositionMultiFilter(
  supabase: SupabaseClient,
  table: string,
  filters: { [col: string]: string }
): Promise<number> {
  let query = supabase
    .from(table)
    .select('position')

  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val)
  }

  const { data } = await query
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.position ?? -1) + 1
}

/**
 * Return a JSON error response with optional status code (default 400).
 */
export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Return a JSON success response. If data is provided, return it; otherwise return { ok: true }.
 */
export function jsonOk(data?: any, status = 200): NextResponse {
  if (data !== undefined) {
    return NextResponse.json(data, { status })
  }
  return NextResponse.json({ ok: true }, { status })
}

/**
 * Return a JSON error response for server errors.
 */
export function jsonServerError(message = 'Internal server error'): NextResponse {
  return jsonError(message, 500)
}
