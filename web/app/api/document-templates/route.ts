import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/api-helpers'
import { buildQuoteBody, DEFAULT_QUOTE_CONFIG } from '@/lib/document-blocks/defaults'

/**
 * GET /api/document-templates
 * Lista templates del workspace
 * Query params:
 *   - ?target_board_id=UUID (opcional) — filtra por board
 *   - ?status=active (opcional, default: todos)
 */
export async function GET(request: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const targetBoardId = url.searchParams.get('target_board_id')
  const status = url.searchParams.get('status')

  const service = createServiceClient()

  let query = service
    .from('document_templates')
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at, created_by')
    .eq('workspace_id', auth.workspaceId)

  if (targetBoardId) {
    query = query.eq('target_board_id', targetBoardId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('[GET /api/document-templates] Query error:', error.message)
    return jsonError(error.message, 500)
  }

  return jsonOk({ templates: data ?? [] })
}

/**
 * POST /api/document-templates
 * Crea un nuevo template
 * Body: { name: string, target_board_id: string, body_json?: [], style_json?: {}, signature_config?: [], pre_conditions?: [], folio_format?: string | null }
 */
export async function POST(request: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const body = await request.json()
  const { name, target_board_id, body_json, style_json, signature_config, pre_conditions, folio_format } = body

  // Validation: name non-empty
  if (!name || typeof name !== 'string' || !name.trim()) {
    return jsonError('Template name cannot be empty', 400)
  }

  // Validation: target_board_id is required
  if (!target_board_id || typeof target_board_id !== 'string') {
    return jsonError('target_board_id is required', 400)
  }

  const service = createServiceClient()

  // Check if target board exists and belongs to workspace
  const { data: targetBoard, error: boardError } = await service
    .from('boards')
    .select('id')
    .eq('id', target_board_id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (boardError || !targetBoard) {
    return jsonError('Target board not found or does not belong to this workspace', 404)
  }

  // Check permissions: workspace admin OR board admin for target_board
  const isWorkspaceAdmin = auth.role === 'admin' || auth.role === 'superadmin'
  let isBoardAdmin = false

  if (!isWorkspaceAdmin) {
    isBoardAdmin = await requireBoardAdmin(target_board_id, auth.userId, auth.workspaceId, auth.role)
  }

  if (!isWorkspaceAdmin && !isBoardAdmin) {
    return jsonError('Only workspace or board admin can create templates', 403)
  }

  // Insert template
  const { data: template, error: insertError } = await service
    .from('document_templates')
    .insert({
      workspace_id: auth.workspaceId,
      name: name.trim(),
      target_board_id,
      body_json: Array.isArray(body_json) && body_json.length > 0 ? body_json : buildQuoteBody(DEFAULT_QUOTE_CONFIG),
      style_json: style_json && typeof style_json === 'object' && (style_json as Record<string, unknown>).quote_config
        ? style_json
        : { ...(style_json as Record<string, unknown> ?? {}), quote_config: DEFAULT_QUOTE_CONFIG },
      signature_config: signature_config ?? [],
      pre_conditions: pre_conditions ?? [],
      folio_format: folio_format ?? null,
      status: 'draft',
      created_by: auth.userId,
    })
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at, created_by')
    .single()

  if (insertError) {
    console.error('[POST /api/document-templates] Insert error:', insertError.message)
    return jsonError(insertError.message, 500)
  }

  return jsonOk(template, 201)
}
