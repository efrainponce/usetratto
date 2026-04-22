/**
 * POST /api/admin/seed-perf
 *
 * Seeds 250+ realistic opportunities with sub-items for performance testing.
 * Only callable by admin or superadmin roles.
 */
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

const WS = 'aaaaaaaa-0000-0000-0000-000000000001'

export async function POST() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return jsonError('Solo admins', 403)
  }

  const supabase = createServiceClient()
  const log: string[] = []

  // ── 1. Get board IDs by slug ──────────────────────────────────────────────
  const { data: boards } = await supabase
    .from('boards')
    .select('id, slug')
    .eq('workspace_id', WS)

  const boardMap: Record<string, string> = {}
  boards?.forEach(b => {
    boardMap[b.slug] = b.id
  })

  const oppBoardId = boardMap['oportunidades']
  const catalogBoardId = boardMap['catalogo']
  const contactsBoardId = boardMap['contactos']
  const accountsBoardId = boardMap['cuentas']

  if (!oppBoardId) {
    return jsonError('Board oportunidades not found — run /api/admin/seed first', 400)
  }

  // ── 2. Get stages for opportunities ───────────────────────────────────────
  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name')
    .eq('board_id', oppBoardId)

  const stageMap: Record<string, string> = {}
  stages?.forEach(s => {
    stageMap[s.name] = s.id
  })

  // ── 3. Get existing contacts and accounts (for relation values) ───────────
  const { data: contacts } = await supabase
    .from('items')
    .select('id, name')
    .eq('board_id', contactsBoardId ?? '')

  const { data: accounts } = await supabase
    .from('items')
    .select('id, name')
    .eq('board_id', accountsBoardId ?? '')

  // ── 4. Get existing catalog items (for sub-items) ─────────────────────────
  const { data: catalogItems } = await supabase
    .from('items')
    .select('id, name')
    .eq('board_id', catalogBoardId ?? '')

  // ── 5. Get column IDs for relation columns (contacto, institucion, monto) ──
  const { data: oppCols } = await supabase
    .from('board_columns')
    .select('id, col_key')
    .eq('board_id', oppBoardId)

  const colMap: Record<string, string> = {}
  oppCols?.forEach(c => {
    colMap[c.col_key] = c.id
  })

  // ── 6. Get sub_item_columns for the opportunities board ──────────────────
  const { data: subItemCols } = await supabase
    .from('sub_item_columns')
    .select('id, col_key')
    .eq('board_id', oppBoardId)

  const subColMap: Record<string, string> = {}
  subItemCols?.forEach(c => {
    subColMap[c.col_key] = c.id
  })

  // ── 7. Generate 250 opportunities ─────────────────────────────────────────
  const stageNames = ['Nueva', 'Cotización', 'Costeo', 'Presentada', 'Cerrada']
  const territories = [
    'dddddddd-0000-0000-0000-000000000001',
    'dddddddd-0000-0000-0000-000000000002',
    'dddddddd-0000-0000-0000-000000000003',
  ]

  // Realistic Mexican military/security opportunity names
  const clients = [
    'SEDENA',
    'Guardia Nacional',
    'SSP Federal',
    'Marina',
    'Policía Federal',
    'SSPE Jalisco',
    'SSPE NL',
    'CNDH',
    'Ejército',
    'Fuerza Aérea',
    'SEMAR',
    'CNS',
    'INM',
    'CENAPI',
    'PGR',
    'SSP Guerrero',
    'SSP Tamaulipas',
    'SSP Sonora',
    'SSP Chihuahua',
    'SSP Veracruz',
  ]

  const products = [
    'uniformes tácticos',
    'chalecos antibalas',
    'botas tácticas',
    'cascos balísticos',
    'guantes de combate',
    'cinturones',
    'mochilas de asalto',
    'rodilleras',
    'gafas balísticas',
    'radios portátiles',
    'fundas tácticas',
    'fornituras',
    'camisolas',
    'pantalones BDU',
    'gorras operativas',
    'coderas',
    'ponchos impermeables',
    'cantimploras',
    'pasamontañas',
    'insignias',
  ]

  const quantities = ['50u', '100u', '200u', '300u', '500u', '750u', '1000u', '1500u', '2000u', '3000u']
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4']

  const now = new Date()

  const randomDate = (minDays: number, maxDays: number): string => {
    const days = minDays + Math.floor(Math.random() * (maxDays - minDays))
    const dt = new Date(now)
    dt.setDate(dt.getDate() + days)
    return dt.toISOString().split('T')[0]
  }

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  const randomAmount = (): number => Math.floor(50000 + Math.random() * 5000000) // 50K - 5M MXN

  // Build 250 opportunity rows
  const oppRows = Array.from({ length: 250 }, (_, i) => {
    const stageName = pick(stageNames)
    const isClosed = stageName === 'Cerrada'
    return {
      workspace_id: WS,
      board_id: oppBoardId,
      name: `${pick(clients)} ${pick(products)} ${pick(quantities)} ${pick(quarters)}`,
      stage_id: stageMap[stageName] ?? null,
      territory_id: pick(territories),
      deadline: isClosed ? randomDate(-60, -1) : randomDate(5, 120),
      owner_id: auth.userId,
      position: i + 100, // offset to not conflict with existing
    }
  })

  // ── 8. Insert opportunities in batches of 50 ──────────────────────────────
  for (let i = 0; i < oppRows.length; i += 50) {
    const batch = oppRows.slice(i, i + 50)
    const { error } = await supabase.from('items').insert(batch)
    if (error) {
      log.push(`batch ${i} error: ${error.message}`)
      break
    }
    log.push(`items batch ${i}-${i + batch.length} inserted`)
  }

  // ── 9. Fetch all opportunities we just created (get their IDs) ─────────────
  const { data: allOpps } = await supabase
    .from('items')
    .select('id')
    .eq('board_id', oppBoardId)
    .eq('workspace_id', WS)
    .order('position', { ascending: true })

  // ── 10. Set item_values for contacto, institucion, monto ─────────────────
  if (allOpps && colMap['contacto'] && contacts?.length) {
    const contactValues = allOpps.map(opp => ({
      item_id: opp.id,
      column_id: colMap['contacto'],
      value_text: pick(contacts).id,
    }))
    // Upsert in batches
    for (let i = 0; i < contactValues.length; i += 50) {
      await supabase.from('item_values').upsert(contactValues.slice(i, i + 50), {
        onConflict: 'item_id,column_id',
      })
    }
    log.push('contacto values set')
  }

  if (allOpps && colMap['institucion'] && accounts?.length) {
    const accountValues = allOpps.map(opp => ({
      item_id: opp.id,
      column_id: colMap['institucion'],
      value_text: pick(accounts).id,
    }))
    for (let i = 0; i < accountValues.length; i += 50) {
      await supabase.from('item_values').upsert(accountValues.slice(i, i + 50), {
        onConflict: 'item_id,column_id',
      })
    }
    log.push('institucion values set')
  }

  if (allOpps && colMap['monto']) {
    const montoValues = allOpps.map(opp => ({
      item_id: opp.id,
      column_id: colMap['monto'],
      value_number: randomAmount(),
    }))
    for (let i = 0; i < montoValues.length; i += 50) {
      await supabase.from('item_values').upsert(montoValues.slice(i, i + 50), {
        onConflict: 'item_id,column_id',
      })
    }
    log.push('monto values set')
  }

  // ── 11. Create sub-items (2-5 catalog products per opportunity) ───────────
  if (allOpps && catalogItems?.length) {
    const subItemRows: Array<{
      workspace_id: string
      item_id: string
      depth: number
      name: string
      position: number
    }> = []

    for (const opp of allOpps) {
      const numProducts = 2 + Math.floor(Math.random() * 4) // 2-5 products
      const shuffled = [...catalogItems].sort(() => Math.random() - 0.5)
      for (let j = 0; j < numProducts && j < shuffled.length; j++) {
        subItemRows.push({
          workspace_id: WS,
          item_id: opp.id,
          depth: 0,
          name: shuffled[j].name,
          position: j,
        })
      }
    }

    // Insert sub_items in batches of 100
    for (let i = 0; i < subItemRows.length; i += 100) {
      const batch = subItemRows.slice(i, i + 100)
      const { error } = await supabase.from('sub_items').insert(batch)
      if (error) {
        log.push(`sub_items batch ${i} error: ${error.message}`)
        break
      }
    }
    log.push(`${subItemRows.length} sub_items inserted`)

    // ── 12. Set sub_item_values (qty + unit_price) ────────────────────────
    if (Object.keys(subColMap).length > 0) {
      const { data: allSubItems } = await supabase
        .from('sub_items')
        .select('id')
        .eq('workspace_id', WS)
        .in(
          'item_id',
          allOpps.map(o => o.id)
        )

      if (allSubItems) {
        const subValues: Array<{
          sub_item_id: string
          column_id: string
          value_number: number
        }> = []

        for (const si of allSubItems) {
          // qty column
          if (subColMap['qty']) {
            subValues.push({
              sub_item_id: si.id,
              column_id: subColMap['qty'],
              value_number: Math.floor(1 + Math.random() * 500),
            })
          }
          // unit_price column
          if (subColMap['unit_price']) {
            subValues.push({
              sub_item_id: si.id,
              column_id: subColMap['unit_price'],
              value_number: Math.floor(100 + Math.random() * 10000),
            })
          }
        }

        for (let i = 0; i < subValues.length; i += 100) {
          await supabase.from('sub_item_values').upsert(subValues.slice(i, i + 100), {
            onConflict: 'sub_item_id,column_id',
          })
        }
        log.push(`${subValues.length} sub_item_values set`)
      }
    }
  }

  return NextResponse.json({ ok: true, log, count: { items: oppRows.length } })
}
