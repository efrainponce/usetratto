export const runtime = 'nodejs'

import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

interface DocumentItem {
  id: string
  sid: number
  name: string
  folio: string | null
  status: string | null
  pdf_url: string | null
  signatures: unknown[] | null
  template_id: string | null
  created_at: string
  generated_by_name: string | null
}

export async function GET(req: Request) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(req.url)
    const sourceItemId = url.searchParams.get('source_item_id')

    if (!sourceItemId) {
      return jsonError('source_item_id query param required', 400)
    }

    const service = createServiceClient()

    // Find quotes board
    const { data: documentsBoard } = await service
      .from('boards')
      .select('id')
      .eq('workspace_id', auth.workspaceId)
      .eq('system_key', 'quotes')
      .maybeSingle()

    if (!documentsBoard) {
      return NextResponse.json([], { status: 200 })
    }

    // Find board columns
    const { data: boardCols } = await service
      .from('board_columns')
      .select('id, col_key')
      .eq('board_id', documentsBoard.id)

    const colKeyToId: Record<string, string> = {}
    for (const col of boardCols ?? []) {
      colKeyToId[col.col_key] = col.id
    }

    // Find source_item_id column
    const sourceItemColId = colKeyToId['source_item_id']
    if (!sourceItemColId) {
      return NextResponse.json([], { status: 200 })
    }

    // Find all items with source_item_id value matching
    const { data: docItems } = await service
      .from('items')
      .select(
        'id, sid, name, created_at, owner_id, ' +
        'item_values(column_id, value_text, value_json)'
      )
      .eq('board_id', documentsBoard.id)
      .eq('workspace_id', auth.workspaceId)
      .order('created_at', { ascending: false }) as any

    // Filter items with source_item_id matching
    const filtered = (docItems ?? []).filter((item: any) => {
      const sourceValue = (item.item_values ?? []).find(
        (iv: any) => iv.column_id === sourceItemColId
      )
      return sourceValue?.value_text === sourceItemId
    })

    // Map values by col_key for each item
    const { data: generatedByColId } = await service
      .from('board_columns')
      .select('id')
      .eq('board_id', documentsBoard.id)
      .eq('col_key', 'generated_by')
      .maybeSingle() as any

    // Fetch user names for generated_by column if present
    const userIds = new Set<string>()
    for (const item of filtered) {
      const generatedByVal = (item.item_values ?? []).find(
        (iv: any) => iv.column_id === generatedByColId?.id
      )
      if (generatedByVal?.value_text) {
        userIds.add(generatedByVal.value_text)
      }
    }

    const userMap: Record<string, string> = {}
    if (userIds.size > 0) {
      const { data: users } = await service
        .from('users')
        .select('id, name')
        .in('id', Array.from(userIds))

      for (const u of users ?? []) {
        userMap[u.id] = u.name ?? u.id
      }
    }

    const result: DocumentItem[] = filtered.map((item: any) => {
      const valuesMap: Record<string, any> = {}
      for (const iv of item.item_values ?? []) {
        const colKey = Object.keys(colKeyToId).find(
          k => colKeyToId[k] === iv.column_id
        )
        if (colKey) {
          valuesMap[colKey] = iv.value_text ?? iv.value_json ?? null
        }
      }

      const generatedByUserId = valuesMap['generated_by']
      const generatedByName = generatedByUserId
        ? userMap[generatedByUserId] ?? 'Desconocido'
        : null

      // pdf_url is stored as JSON array with file object
      let pdfUrl: string | null = null
      const pdfUrlValue = valuesMap['pdf_url']
      if (pdfUrlValue) {
        try {
          const files = Array.isArray(pdfUrlValue)
            ? pdfUrlValue
            : JSON.parse(pdfUrlValue)
          if (Array.isArray(files) && files[0]?.url) {
            pdfUrl = files[0].url
          }
        } catch {
          // Ignore parse error
        }
      }

      // signatures is stored as JSON string
      let signatures: unknown[] = []
      const sigsValue = valuesMap['signatures']
      if (sigsValue) {
        try {
          signatures = Array.isArray(sigsValue)
            ? sigsValue
            : JSON.parse(sigsValue)
        } catch {
          // Ignore parse error
        }
      }

      return {
        id: item.id,
        sid: item.sid,
        name: item.name,
        folio: valuesMap['folio'] ?? null,
        status: valuesMap['status'] ?? null,
        pdf_url: pdfUrl,
        signatures,
        template_id: valuesMap['template_id'] ?? null,
        created_at: item.created_at,
        generated_by_name: generatedByName,
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[documents GET] Error:', error)
    return jsonError('Internal server error', 500)
  }
}
