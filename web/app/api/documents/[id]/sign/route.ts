export const runtime = 'nodejs'

import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import type { Block, RenderContext, BoardColumnMeta } from '@/lib/document-blocks/types'
import { DocumentPdf } from '@/lib/document-blocks/pdf-renderer'
import { NextResponse } from 'next/server'
import type { CellKind } from '@/components/data-table/types'
import { jsonError } from '@/lib/api-helpers'

type Context = { params: Promise<{ id: string }> }

interface SignRequest {
  role: string
  signature_image_base64: string
  user_name?: string
}

interface SignatureEntry {
  role: string
  user_id: string
  user_name: string
  signed_at: string
  image_url: string
  ip: string | null
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  try {
    const { id: documentId } = await params
    const body = await req.json() as SignRequest
    const { role, signature_image_base64, user_name } = body

    if (!role || !signature_image_base64) {
      return jsonError('role and signature_image_base64 required', 400)
    }

    const service = createServiceClient()

    // Fetch document item
    const { data: docItem } = await service
      .from('items')
      .select(
        'id, sid, name, board_id, ' +
        'item_values(column_id, value_text, value_number, value_date, value_json)'
      )
      .eq('id', documentId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle() as any

    if (!docItem) {
      return jsonError('Document not found', 404)
    }

    // Fetch board_columns from documents board
    const { data: docBoardCols } = await service
      .from('board_columns')
      .select('id, col_key')
      .eq('board_id', docItem.board_id)

    const colKeyToId: Record<string, string> = {}
    const idToColKey: Record<string, string> = {}
    for (const col of docBoardCols ?? []) {
      colKeyToId[col.col_key] = col.id
      idToColKey[col.id] = col.col_key
    }

    // Reverse map item_values to col_keys
    const valuesByColKey: Record<string, any> = {}
    for (const iv of docItem.item_values ?? []) {
      const colKey = idToColKey[iv.column_id]
      if (colKey) {
        valuesByColKey[colKey] = iv.value_text ?? iv.value_number ?? iv.value_date ?? iv.value_json
      }
    }

    // Extract template_id, source_item_id, current signatures
    const templateId = valuesByColKey['template_id'] as string | undefined
    const sourceItemId = valuesByColKey['source_item_id'] as string | undefined
    const pdfUrl = valuesByColKey['pdf_url'] as string | undefined
    let signatures: SignatureEntry[] = []

    try {
      if (valuesByColKey['signatures']) {
        signatures = JSON.parse(valuesByColKey['signatures'])
      }
    } catch {
      signatures = []
    }

    if (!templateId || !sourceItemId) {
      return jsonError('Document missing template_id or source_item_id', 400)
    }

    // Fetch template
    const { data: template } = await service
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle()

    if (!template) {
      return jsonError('Template not found', 404)
    }

    // Upload signature image
    const bucketName = 'signatures'
    try {
      await service.storage.createBucket(bucketName, { public: true })
    } catch {
      // Bucket likely already exists
    }

    // Verify document is in quotes board (not documents)
    const { data: quotesBoard } = await service
      .from('boards')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('system_key', 'quotes')
      .maybeSingle()

    if (quotesBoard && docItem.board_id !== quotesBoard.id) {
      return jsonError('Document not in quotes board', 403)
    }

    // Decode base64 signature
    let signatureBuffer: Buffer
    try {
      const base64Data = signature_image_base64.replace(/^data:image\/\w+;base64,/, '')
      signatureBuffer = Buffer.from(base64Data, 'base64')
    } catch {
      return jsonError('Invalid signature image format', 400)
    }

    const signaturePath = `${auth.workspaceId}/${crypto.randomUUID()}.png`
    const { error: sigUploadError } = await service.storage
      .from(bucketName)
      .upload(signaturePath, signatureBuffer, {
        contentType: 'image/png',
        upsert: false
      })

    if (sigUploadError) {
      return jsonError('Failed to upload signature', 500)
    }

    const { data: sigUrlData } = service.storage
      .from(bucketName)
      .getPublicUrl(signaturePath)

    const signatureImageUrl = sigUrlData.publicUrl

    // Get IP from headers
    const ip = req.headers.get('x-forwarded-for') ?? null

    // Add new signature
    const newSignature: SignatureEntry = {
      role,
      user_id: auth.userId,
      user_name: user_name ?? auth.name ?? 'Anónimo',
      signed_at: new Date().toISOString(),
      image_url: signatureImageUrl,
      ip
    }

    signatures.push(newSignature)

    // Fetch source item + values for re-render
    const { data: sourceItem } = await service
      .from('items')
      .select(
        'id, sid, name, ' +
        'item_values(column_id, value_text, value_number, value_date, value_json)'
      )
      .eq('id', sourceItemId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle() as any

    if (!sourceItem) {
      return jsonError('Source item not found', 404)
    }

    // Build RenderContext with updated signatures
    // Resolve source item values (reuse from generate logic, simplified)
    const { data: boardCols } = await service
      .from('board_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)

    const colMap: Record<string, any> = {}
    for (const col of boardCols ?? []) {
      colMap[col.col_key] = col
    }

    const rootValues: Record<string, string | number | null> = {}
    const itemValueMap: Record<string, any> = {}
    for (const iv of sourceItem.item_values ?? []) {
      const col = boardCols?.find(c => c.id === iv.column_id)
      if (!col) continue
      itemValueMap[col.col_key] = iv
    }

    for (const col of boardCols ?? []) {
      const colKey = col.col_key
      const iv = itemValueMap[colKey]
      const value = iv ? (iv.value_text ?? iv.value_number ?? iv.value_date ?? iv.value_json) : null

      if (col.kind === 'relation' && value && typeof value === 'string') {
        const { data: relItem } = await service
          .from('items')
          .select('name')
          .eq('id', value)
          .eq('workspace_id', auth.workspaceId)
          .maybeSingle()
        rootValues[colKey] = relItem?.name ?? value
      } else if (col.kind === 'people' && value && typeof value === 'string') {
        const { data: user } = await service
          .from('users')
          .select('name')
          .eq('id', value)
          .maybeSingle()
        rootValues[colKey] = user?.name ?? value
      } else if (col.kind === 'select' && value && typeof value === 'string') {
        const opts = (col.settings as Record<string, unknown>)?.options as Array<{ value: string; label: string }> | undefined
        const opt = opts?.find(o => o.value === value)
        rootValues[colKey] = opt?.label ?? value
      } else if (col.kind === 'multiselect' && Array.isArray(value)) {
        const opts = (col.settings as Record<string, unknown>)?.options as Array<{ value: string; label: string }> | undefined
        const labels = value.map((v: string) => {
          const opt = opts?.find(o => o.value === v)
          return opt?.label ?? v
        })
        rootValues[colKey] = labels.join(', ')
      } else if (col.kind === 'boolean') {
        rootValues[colKey] = value ? 'Sí' : 'No'
      } else if (value !== null && value !== undefined) {
        rootValues[colKey] = typeof value === 'string' ? value : String(value)
      } else {
        rootValues[colKey] = null
      }
    }

    // Fetch sub_items for re-render
    const { data: subItems } = await service
      .from('sub_items')
      .select(
        'id, sid, name, sub_item_values(column_id, value_text, value_number, value_date, value_json)'
      )
      .eq('item_id', sourceItem.id)
      .eq('depth', 0) as any

    const { data: subItemCols } = await service
      .from('sub_item_columns')
      .select('id, col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)

    const subColMap: Record<string, any> = {}
    for (const col of subItemCols ?? []) {
      subColMap[col.col_key] = col
    }

    const subItemsValues: Array<Record<string, string | number | null>> = []
    for (const subItem of subItems ?? []) {
      const subValues: Record<string, string | number | null> = {}

      const subValueMap: Record<string, any> = {}
      for (const sv of subItem.sub_item_values ?? []) {
        const col = subItemCols?.find(c => c.id === sv.column_id)
        if (!col) continue
        subValueMap[col.col_key] = sv
      }

      for (const col of subItemCols ?? []) {
        const colKey = col.col_key
        const sv = subValueMap[colKey]
        const value = sv ? (sv.value_text ?? sv.value_number ?? sv.value_date ?? sv.value_json) : null

        if (col.kind === 'people' && value && typeof value === 'string') {
          const { data: user } = await service
            .from('users')
            .select('name')
            .eq('id', value)
            .maybeSingle()
          subValues[colKey] = user?.name ?? value
        } else if (col.kind === 'select' && value && typeof value === 'string') {
          const opts = (col.settings as Record<string, unknown>)?.options as Array<{ value: string; label: string }> | undefined
          const opt = opts?.find(o => o.value === value)
          subValues[colKey] = opt?.label ?? value
        } else if (col.kind === 'multiselect' && Array.isArray(value)) {
          const opts = (col.settings as Record<string, unknown>)?.options as Array<{ value: string; label: string }> | undefined
          const labels = value.map((v: string) => {
            const opt = opts?.find(o => o.value === v)
            return opt?.label ?? v
          })
          subValues[colKey] = labels.join(', ')
        } else if (col.kind === 'boolean') {
          subValues[colKey] = value ? 'Sí' : 'No'
        } else if (value !== null && value !== undefined) {
          subValues[colKey] = typeof value === 'string' ? value : String(value)
        } else {
          subValues[colKey] = null
        }
      }

      subItemsValues.push(subValues)
    }

    // Fetch workspace
    const { data: workspace } = await service
      .from('workspaces')
      .select('name, logo_url')
      .eq('id', auth.workspaceId)
      .maybeSingle()

    const rootColumns: BoardColumnMeta[] = (boardCols ?? []).map(col => ({
      col_key: col.col_key,
      name: col.name,
      kind: col.kind as CellKind,
      settings: col.settings
    }))

    const subItemColumns: BoardColumnMeta[] = (subItemCols ?? []).map(col => ({
      col_key: col.col_key,
      name: col.name,
      kind: col.kind as CellKind,
      settings: col.settings
    }))

    const renderContext: RenderContext = {
      rootItem: {
        id: sourceItem.id,
        sid: sourceItem.sid,
        name: sourceItem.name,
        values: rootValues
      },
      rootColumns,
      subItems: (subItems ?? []).map((si: any, idx: number) => ({
        id: si.id,
        sid: si.sid,
        name: si.name,
        values: subItemsValues[idx] ?? {}
      })),
      subItemColumns,
      workspace: {
        name: workspace?.name ?? 'Tratto',
        logo_url: workspace?.logo_url
      },
      document: {
        signatures: signatures as any,
        created_at: new Date().toISOString(),
        generated_by_name: auth.name ?? undefined
      }
    }

    // Re-render PDF
    const pdf = require('@react-pdf/renderer').pdf
    const element = DocumentPdf({
      blocks: template.body_json as Block[],
      context: renderContext,
      style: template.style_json
    })

    const newBuffer = await pdf(element).toBuffer()

    // Upload new PDF
    const bucketName2 = 'documents'
    const newPdfPath = `${auth.workspaceId}/${crypto.randomUUID()}.pdf`
    const { error: pdfUploadError } = await service.storage
      .from(bucketName2)
      .upload(newPdfPath, newBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (pdfUploadError) {
      return jsonError('Failed to upload new PDF', 500)
    }

    const { data: newUrlData } = service.storage
      .from(bucketName2)
      .getPublicUrl(newPdfPath)

    const newPdfUrl = newUrlData.publicUrl

    // Update item_values
    const updateInserts: Array<{
      item_id: string
      column_id: string
      value_text?: string
    }> = []

    if (colKeyToId['pdf_url']) {
      updateInserts.push({
        item_id: documentId,
        column_id: colKeyToId['pdf_url'],
        value_text: JSON.stringify([
          {
            url: newPdfUrl,
            name: 'documento.pdf',
            size: newBuffer.length,
            type: 'application/pdf'
          }
        ])
      })
    }

    if (colKeyToId['signatures']) {
      updateInserts.push({
        item_id: documentId,
        column_id: colKeyToId['signatures'],
        value_text: JSON.stringify(signatures)
      })
    }

    if (updateInserts.length > 0) {
      // Delete old values and insert new ones
      for (const update of updateInserts) {
        await service
          .from('item_values')
          .delete()
          .eq('item_id', documentId)
          .eq('column_id', update.column_id)

        await service
          .from('item_values')
          .insert(update)
      }
    }

    // Insert audit event
    await service.from('document_audit_events').insert({
      document_item_id: documentId,
      workspace_id: auth.workspaceId,
      event_type: 'signed',
      actor_id: auth.userId,
      metadata: {
        role,
        user_id: auth.userId
      }
    })

    return NextResponse.json({
      signatures,
      pdf_url: newPdfUrl
    })
  } catch (error) {
    console.error('[documents/[id]/sign] Error:', error)
    return jsonError('Internal server error', 500)
  }
}
