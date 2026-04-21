export const runtime = 'nodejs'

import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validatePreConditions, type PreCondition } from '@/lib/document-blocks/validator'
import type { Block, RenderContext, BoardColumnMeta, DocumentMeta } from '@/lib/document-blocks/types'
import { DocumentPdf } from '@/lib/document-blocks/pdf-renderer'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { CellKind } from '@/components/data-table/types'

interface GenerateRequest {
  template_id: string
  source_item_id: string
}

interface ResolvedItemValues {
  rootValues: Record<string, string | number | null>
  subItemsValues: Array<Record<string, string | number | null>>
}

async function resolveItemValues(
  service: ReturnType<typeof createServiceClient>,
  template: any,
  sourceItem: any,
  workspaceId: string
): Promise<ResolvedItemValues> {
  const rootValues: Record<string, string | number | null> = {}
  const subItemsValues: Array<Record<string, string | number | null>> = []

  // Fetch board_columns
  const { data: boardCols } = await service
    .from('board_columns')
    .select('id, col_key, name, kind, settings')
    .eq('board_id', template.target_board_id)

  const colMap: Record<string, any> = {}
  for (const col of boardCols ?? []) {
    colMap[col.col_key] = col
  }

  // Build rootValues map: col_key -> column_id
  const colKeyToId: Record<string, string> = {}
  for (const col of boardCols ?? []) {
    colKeyToId[col.col_key] = col.id
  }

  // Transform item_values to col_key -> value
  const itemValueMap: Record<string, any> = {}
  for (const iv of sourceItem.item_values ?? []) {
    const col = boardCols?.find(c => c.id === iv.column_id)
    if (!col) continue
    itemValueMap[col.col_key] = iv
  }

  // Resolve each column value
  for (const col of boardCols ?? []) {
    const colKey = col.col_key
    const iv = itemValueMap[colKey]
    const value = iv ? (iv.value_text ?? iv.value_number ?? iv.value_date ?? iv.value_json) : null

    if (col.kind === 'relation' && value && typeof value === 'string') {
      // Fetch related item name
      const { data: relItem } = await service
        .from('items')
        .select('name')
        .eq('id', value)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      rootValues[colKey] = relItem?.name ?? value
    } else if (col.kind === 'people' && value && typeof value === 'string') {
      // Fetch user name
      const { data: user } = await service
        .from('users')
        .select('name')
        .eq('id', value)
        .maybeSingle()
      rootValues[colKey] = user?.name ?? value
    } else if (col.kind === 'select' && value && typeof value === 'string') {
      // Lookup in settings.options
      const opts = (col.settings as Record<string, unknown>)?.options as Array<{ value: string; label: string }> | undefined
      const opt = opts?.find(o => o.value === value)
      rootValues[colKey] = opt?.label ?? value
    } else if (col.kind === 'multiselect' && Array.isArray(value)) {
      // Map array of values to labels
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

  // Fetch sub_items
  const { data: subItems } = await service
    .from('sub_items')
    .select(
      'id, sid, name, sub_item_values(column_id, value_text, value_number, value_date, value_json)'
    )
    .eq('item_id', sourceItem.id)
    .eq('depth', 0) as any

  // Fetch sub_item_columns
  const { data: subCols } = await service
    .from('sub_item_columns')
    .select('id, col_key, name, kind, settings')
    .eq('board_id', template.target_board_id)

  const subColMap: Record<string, any> = {}
  for (const col of subCols ?? []) {
    subColMap[col.col_key] = col
  }

  const subColKeyToId: Record<string, string> = {}
  for (const col of subCols ?? []) {
    subColKeyToId[col.col_key] = col.id
  }

  // Resolve sub_items values
  for (const subItem of subItems ?? []) {
    const subValues: Record<string, string | number | null> = {}

    const subValueMap: Record<string, any> = {}
    for (const sv of subItem.sub_item_values ?? []) {
      const col = subCols?.find(c => c.id === sv.column_id)
      if (!col) continue
      subValueMap[col.col_key] = sv
    }

    for (const col of subCols ?? []) {
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

  return { rootValues, subItemsValues }
}

export async function POST(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  try {
    const body = await req.json() as GenerateRequest
    const { template_id, source_item_id } = body

    if (!template_id || !source_item_id) {
      return NextResponse.json(
        { error: 'template_id and source_item_id required' },
        { status: 400 }
      )
    }

    const service = createServiceClient()

    // Fetch template
    const { data: template, error: templateError } = await service
      .from('document_templates')
      .select('*')
      .eq('id', template_id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Fetch source item with item_values
    const sourceItemResponse = await service
      .from('items')
      .select(
        'id, sid, name, ' +
        'item_values(column_id, value_text, value_number, value_date, value_json)'
      )
      .eq('id', source_item_id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle() as any
    const sourceItem = sourceItemResponse.data

    if (!sourceItem) {
      return NextResponse.json({ error: 'Source item not found' }, { status: 404 })
    }

    // Fetch workspace info
    const { data: workspace } = await service
      .from('workspaces')
      .select('name, logo_url')
      .eq('id', auth.workspaceId)
      .maybeSingle()

    // Resolve values
    const { rootValues, subItemsValues } = await resolveItemValues(
      service,
      template,
      sourceItem,
      auth.workspaceId
    )

    // Validate pre-conditions
    const validation = validatePreConditions(template.pre_conditions ?? [], {
      rootValues,
      subItemsValues
    })

    if (!validation.ok) {
      return NextResponse.json(
        { error: 'Pre-conditions not met', errors: validation.errors },
        { status: 400 }
      )
    }

    // Fetch board_columns for rootColumns
    const { data: boardCols } = await service
      .from('board_columns')
      .select('col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)

    const rootColumns: BoardColumnMeta[] = (boardCols ?? []).map(col => ({
      col_key: col.col_key,
      name: col.name,
      kind: col.kind as CellKind,
      settings: col.settings
    }))

    // Fetch sub_item_columns for subItemColumns
    const { data: subItemCols } = await service
      .from('sub_item_columns')
      .select('col_key, name, kind, settings')
      .eq('board_id', template.target_board_id)

    const subItemColumns: BoardColumnMeta[] = (subItemCols ?? []).map(col => ({
      col_key: col.col_key,
      name: col.name,
      kind: col.kind as CellKind,
      settings: col.settings
    }))

    // Generate folio
    let folio: string | null = null
    if (template.folio_format) {
      const now = new Date()
      const year = now.getFullYear()
      let folioFormat = template.folio_format.replace('{YYYY}', String(year))

      if (folioFormat.includes('{N}')) {
        // Count items in documents board with this template_id
        const { data: templateColId } = await service
          .from('board_columns')
          .select('id')
          .eq('board_id', template.target_board_id)
          .eq('col_key', 'template_id')
          .maybeSingle() as any

        let count = 1
        if (templateColId?.id) {
          const { data: existingDocs } = await service
            .from('item_values')
            .select('item_id')
            .eq('column_id', templateColId.id)
            .eq('value_text', template.id) as any
          count = (existingDocs ?? []).length + 1
        } else {
          // Fallback: count all items in documents board
          const { data: allDocs } = await service
            .from('items')
            .select('id')
            .eq('board_id', template.target_board_id)
            .eq('workspace_id', auth.workspaceId) as any
          count = (allDocs ?? []).length + 1
        }

        const paddedCount = String(count).padStart(4, '0')
        folioFormat = folioFormat.replace('{N}', paddedCount)
      }

      folio = folioFormat
    }

    // Build RenderContext
    const subItemsResponse = await service
      .from('sub_items')
      .select('id, sid, name')
      .eq('item_id', sourceItem.id)
      .eq('depth', 0) as any
    const subItemsList = subItemsResponse.data

    const renderContext: RenderContext = {
      rootItem: {
        id: sourceItem.id,
        sid: sourceItem.sid,
        name: sourceItem.name,
        values: rootValues
      },
      rootColumns,
      subItems: (subItemsList ?? []).map((si: any, idx: number) => ({
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
        folio,
        created_at: new Date().toISOString(),
        generated_by_name: auth.name ?? undefined
      }
    }

    // Render PDF
    const pdf = require('@react-pdf/renderer').pdf
    const element = DocumentPdf({
      blocks: template.body_json as Block[],
      context: renderContext,
      style: template.style_json
    })

    const buffer = await pdf(element).toBuffer()

    // Create storage bucket if not exists
    const bucketName = 'documents'
    try {
      await service.storage.createBucket(bucketName, { public: true })
    } catch {
      // Bucket likely already exists
    }

    // Upload to storage
    const filePath = `${auth.workspaceId}/${crypto.randomUUID()}.pdf`
    const { data: uploadData, error: uploadError } = await service.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload PDF', details: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = service.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    const pdfUrl = urlData.publicUrl

    // Find quotes board
    const { data: documentsBoard } = await service
      .from('boards')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('system_key', 'quotes')
      .maybeSingle()

    if (!documentsBoard) {
      return NextResponse.json({ error: 'Quotes board not found' }, { status: 404 })
    }

    // Find board_columns
    const { data: docBoardCols } = await service
      .from('board_columns')
      .select('id, col_key')
      .eq('board_id', documentsBoard.id)

    const colKeyToId: Record<string, string> = {}
    for (const col of docBoardCols ?? []) {
      colKeyToId[col.col_key] = col.id
    }

    // Fetch columns from source opp board to get source_contacto_id, source_institucion_id, source_monto
    const { data: oppBoardCols } = await service
      .from('board_columns')
      .select('id, col_key')
      .eq('board_id', template.target_board_id)

    const oppColKeyToId: Record<string, string> = {}
    for (const col of oppBoardCols ?? []) {
      oppColKeyToId[col.col_key] = col.id
    }

    // Read source opp item_values for contacto, institucion, monto
    let sourceContactoId: string | null = null
    let sourceInstitucionId: string | null = null
    let sourceMontoValue: number | null = null

    if (oppColKeyToId['contacto'] && oppColKeyToId['institucion'] && oppColKeyToId['monto']) {
      const { data: sourceValues } = await service
        .from('item_values')
        .select('column_id, value_text, value_number')
        .eq('item_id', source_item_id)
        .in('column_id', [
          oppColKeyToId['contacto'],
          oppColKeyToId['institucion'],
          oppColKeyToId['monto']
        ]) as any

      for (const iv of sourceValues ?? []) {
        if (iv.column_id === oppColKeyToId['contacto']) {
          sourceContactoId = iv.value_text
        } else if (iv.column_id === oppColKeyToId['institucion']) {
          sourceInstitucionId = iv.value_text
        } else if (iv.column_id === oppColKeyToId['monto']) {
          sourceMontoValue = iv.value_number
        }
      }
    }

    // Create document item
    const docItemName = `${template.name} — ${sourceItem.name}`
    const { data: docItem, error: itemError } = await service
      .from('items')
      .insert({
        workspace_id: auth.workspaceId,
        board_id: documentsBoard.id,
        name: docItemName,
        owner_id: auth.userId,
        position: ((await service.from('items').select('position').eq('board_id', documentsBoard.id).order('position', { ascending: false }).limit(1).maybeSingle()).data?.position ?? -1) + 1
      })
      .select('id, sid')
      .single()

    if (itemError || !docItem) {
      return NextResponse.json(
        { error: 'Failed to create document item' },
        { status: 500 }
      )
    }

    // Insert item_values for document columns
    const itemValuesInserts: Array<{
      item_id: string
      column_id: string
      value_text?: string
      value_number?: number
      value_json?: unknown
    }> = []

    if (colKeyToId['template_id']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['template_id'],
        value_text: template.id
      })
    }

    // Add relation to source oportunidad
    if (colKeyToId['oportunidad']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['oportunidad'],
        value_text: source_item_id
      })
    }

    // Add relation to contacto
    if (colKeyToId['contacto'] && sourceContactoId) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['contacto'],
        value_text: sourceContactoId
      })
    }

    // Add relation to institucion
    if (colKeyToId['institucion'] && sourceInstitucionId) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['institucion'],
        value_text: sourceInstitucionId
      })
    }

    // Add monto number value
    if (colKeyToId['monto'] && sourceMontoValue !== null) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['monto'],
        value_number: sourceMontoValue
      })
    }

    if (colKeyToId['pdf_url']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['pdf_url'],
        value_json: [
          {
            url: pdfUrl,
            name: 'documento.pdf',
            size: buffer.length,
            type: 'application/pdf'
          }
        ]
      })
    }

    if (folio && colKeyToId['folio']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['folio'],
        value_text: folio
      })
    }

    if (colKeyToId['signatures']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['signatures'],
        value_text: '[]'
      })
    }

    if (colKeyToId['generated_by']) {
      itemValuesInserts.push({
        item_id: docItem.id,
        column_id: colKeyToId['generated_by'],
        value_text: auth.userId
      })
    }

    if (itemValuesInserts.length > 0) {
      await service.from('item_values').insert(itemValuesInserts)
    }

    // Insert audit event
    await service.from('document_audit_events').insert({
      document_item_id: docItem.id,
      workspace_id: auth.workspaceId,
      event_type: 'generated',
      actor_id: auth.userId,
      metadata: {
        template_id,
        source_item_id,
        folio
      }
    })

    return NextResponse.json(
      {
        document_item_id: docItem.id,
        document_item_sid: docItem.sid,
        pdf_url: pdfUrl,
        folio
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[documents/generate] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
