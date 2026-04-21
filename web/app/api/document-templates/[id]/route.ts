import { NextResponse } from 'next/server'
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { requireBoardAdmin } from '@/lib/permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { jsonError, jsonOk } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

/**
 * GET /api/document-templates/[id]
 * Fetch un template por UUID
 */
export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  const { data: template, error } = await service
    .from('document_templates')
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at, created_by')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[GET /api/document-templates/[id]] Query error:', error.message)
    return jsonError(error.message, 500)
  }

  if (!template) {
    return jsonError('Template not found', 404)
  }

  return jsonOk(template)
}

/**
 * PATCH /api/document-templates/[id]
 * Actualiza un template
 * Body: { name?, body_json?, style_json?, signature_config?, pre_conditions?, folio_format?, status? }
 */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  // Fetch template to verify it exists and belongs to workspace
  const { data: template, error: fetchError } = await service
    .from('document_templates')
    .select('id, target_board_id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (fetchError || !template) {
    return jsonError('Template not found', 404)
  }

  // Check permissions: workspace admin OR board admin for target_board
  const isWorkspaceAdmin = auth.role === 'admin' || auth.role === 'superadmin'
  let isBoardAdmin = false

  if (!isWorkspaceAdmin) {
    isBoardAdmin = await requireBoardAdmin(template.target_board_id, auth.userId, auth.workspaceId, auth.role)
  }

  if (!isWorkspaceAdmin && !isBoardAdmin) {
    return jsonError('Only workspace or board admin can update templates', 403)
  }

  const body = await req.json() as Partial<{
    name: string
    body_json: unknown
    style_json: unknown
    signature_config: unknown
    pre_conditions: unknown
    folio_format: string | null
    status: string
  }>

  const patch: Record<string, unknown> = {}

  if ('name' in body && body.name !== undefined) {
    if (!body.name?.trim()) {
      return jsonError('Template name cannot be empty', 400)
    }
    patch.name = body.name.trim()
  }

  if ('body_json' in body) {
    patch.body_json = body.body_json ?? []
  }

  if ('style_json' in body) {
    patch.style_json = body.style_json ?? {}
  }

  if ('signature_config' in body) {
    patch.signature_config = body.signature_config ?? []
  }

  if ('pre_conditions' in body) {
    patch.pre_conditions = body.pre_conditions ?? []
  }

  if ('folio_format' in body) {
    patch.folio_format = body.folio_format ?? null
  }

  if ('status' in body && body.status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(body.status)) {
      return jsonError("Status must be 'draft', 'active', or 'archived'", 400)
    }
    patch.status = body.status
  }

  if (Object.keys(patch).length === 0) {
    return jsonError('Nothing to update', 400)
  }

  const { data: updated, error: updateError } = await service
    .from('document_templates')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .select('id, sid, name, target_board_id, status, body_json, style_json, signature_config, pre_conditions, folio_format, created_at, updated_at, created_by')
    .single()

  if (updateError) {
    console.error('[PATCH /api/document-templates/[id]] Update error:', updateError.message)
    return jsonError(updateError.message, 500)
  }

  if (!updated) {
    return jsonError('Update failed', 500)
  }

  return jsonOk(updated)
}

/**
 * DELETE /api/document-templates/[id]
 * Elimina un template
 */
export async function DELETE(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const service = createServiceClient()

  // Fetch template to verify it exists and belongs to workspace
  const { data: template, error: fetchError } = await service
    .from('document_templates')
    .select('id, target_board_id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (fetchError || !template) {
    return jsonError('Template not found', 404)
  }

  // Check permissions: workspace admin OR board admin for target_board
  const isWorkspaceAdmin = auth.role === 'admin' || auth.role === 'superadmin'
  let isBoardAdmin = false

  if (!isWorkspaceAdmin) {
    isBoardAdmin = await requireBoardAdmin(template.target_board_id, auth.userId, auth.workspaceId, auth.role)
  }

  if (!isWorkspaceAdmin && !isBoardAdmin) {
    return jsonError('Only workspace or board admin can delete templates', 403)
  }

  // Delete
  const { error: deleteError } = await service
    .from('document_templates')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[DELETE /api/document-templates/[id]] Delete error:', deleteError.message)
    return jsonError(deleteError.message, 500)
  }

  return new Response(null, { status: 204 })
}
