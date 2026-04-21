import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import TemplateEditorView from './TemplateEditorView'

type PageParams = {
  params: Promise<{
    workspaceSid: string
    boardId: string
    tplId: string
  }>
}

export default async function TemplateEditorPage({ params }: PageParams) {
  const { workspaceSid, boardId, tplId } = await params
  const user = await requireAuth()

  const service = createServiceClient()

  // Fetch board with columns
  const { data: board, error: boardError } = await service
    .from('boards')
    .select('id, name, sid, workspace_id')
    .eq('id', boardId)
    .eq('workspace_id', user.workspaceId)
    .maybeSingle()

  if (boardError || !board) {
    redirect('/app')
  }

  // Fetch board columns
  const { data: columns } = await service
    .from('board_columns')
    .select('id, col_key, name, kind, settings')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  // Fetch sub-item columns
  const { data: subItemColumns } = await service
    .from('sub_item_columns')
    .select('id, col_key, name, kind, settings')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  // Fetch template
  const { data: template, error: tplError } = await service
    .from('document_templates')
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at')
    .eq('id', tplId)
    .eq('workspace_id', user.workspaceId)
    .maybeSingle()

  if (tplError || !template) {
    redirect(`/app/w/${workspaceSid}/settings/boards/${boardId}?tab=documentos`)
  }

  // Verify template belongs to this board
  if (template.target_board_id !== boardId) {
    redirect(`/app/w/${workspaceSid}/settings/boards/${boardId}?tab=documentos`)
  }

  // Fetch workspace
  const { data: workspace } = await service
    .from('workspaces')
    .select('id, name, logo_url')
    .eq('id', user.workspaceId)
    .maybeSingle()

  return (
    <TemplateEditorView
      template={template}
      board={board}
      columns={columns || []}
      subItemColumns={subItemColumns || []}
      workspace={workspace || { id: '', name: 'Workspace' }}
      workspaceSid={workspaceSid}
    />
  )
}
