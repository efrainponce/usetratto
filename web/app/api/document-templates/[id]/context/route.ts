import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

/**
 * GET /api/document-templates/[id]/context
 * Returns template + board + board_columns + sub_item_columns + workspace in one call.
 * Used by QuoteEditorModal to hydrate the editor client-side.
 */
export async function GET(_req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  const { data: template, error: tplErr } = await service
    .from('document_templates')
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (tplErr || !template) return jsonError('Template not found', 404)

  const [{ data: board }, { data: columns }, { data: subItemColumns }, { data: workspace }] = await Promise.all([
    service.from('boards')
      .select('id, name, sid, workspace_id')
      .eq('id', template.target_board_id)
      .maybeSingle(),
    service.from('board_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)
      .order('position', { ascending: true }),
    service.from('sub_item_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)
      .order('position', { ascending: true }),
    service.from('workspaces')
      .select('id, name')
      .eq('id', auth.workspaceId)
      .maybeSingle(),
  ])

  if (!board) return jsonError('Board not found', 404)

  return jsonOk({
    template,
    board,
    columns: columns ?? [],
    subItemColumns: subItemColumns ?? [],
    workspace: workspace ?? { id: auth.workspaceId, name: 'Workspace' },
  })
}
