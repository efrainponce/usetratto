/**
 * POST /api/admin/seed
 *
 * Crea workspace CMP + 5 boards de sistema + data de ejemplo.
 * Solo lo puede llamar superadmin o admin.
 * Idempotente — no duplica si ya existe.
 */
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

const WORKSPACE_ID   = 'aaaaaaaa-0000-0000-0000-000000000001'
const WORKSPACE_NAME = 'CMP'

export async function POST() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return jsonError('Solo admins', 403)
  }

  const supabase = createServiceClient()
  const log: string[] = []

  // ── 1. Workspace ──────────────────────────────────────────────────────────
  const { error: wsErr } = await supabase
    .from('workspaces')
    .upsert({ id: WORKSPACE_ID, name: WORKSPACE_NAME }, { onConflict: 'id' })
  if (wsErr) return NextResponse.json({ error: wsErr.message, log }, { status: 500 })
  log.push('workspace OK')

  // ── 2. Assign calling user to workspace (if not already assigned) ─────────
  const { data: currentUser } = await supabase
    .from('users')
    .select('workspace_id, role')
    .eq('id', auth.userId)
    .single()

  if (!currentUser?.workspace_id) {
    await supabase
      .from('users')
      .update({ workspace_id: WORKSPACE_ID, role: 'admin' })
      .eq('id', auth.userId)
    log.push('user assigned to workspace')
  } else {
    log.push('user already in workspace')
  }

  // ── 3. System boards — call seed_system_boards only if not seeded ─────────
  const { count } = await supabase
    .from('boards')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', WORKSPACE_ID)

  if ((count ?? 0) === 0) {
    const { error: fnErr } = await supabase.rpc('seed_system_boards', {
      p_workspace_id: WORKSPACE_ID,
    })
    if (fnErr) return NextResponse.json({ error: fnErr.message, log }, { status: 500 })
    log.push('system boards seeded')
  } else {
    log.push(`boards already exist (${count})`)
  }

  // ── 4. Teams ──────────────────────────────────────────────────────────────
  await supabase.from('teams').upsert([
    { id: 'cccccccc-0000-0000-0000-000000000001', workspace_id: WORKSPACE_ID, name: 'Ventas' },
    { id: 'cccccccc-0000-0000-0000-000000000002', workspace_id: WORKSPACE_ID, name: 'Compras' },
  ], { onConflict: 'id', ignoreDuplicates: true })
  log.push('teams OK')

  // ── 5. Territories ────────────────────────────────────────────────────────
  await supabase.from('territories').upsert([
    { id: 'dddddddd-0000-0000-0000-000000000001', workspace_id: WORKSPACE_ID, name: 'Norte' },
    { id: 'dddddddd-0000-0000-0000-000000000002', workspace_id: WORKSPACE_ID, name: 'Centro' },
    { id: 'dddddddd-0000-0000-0000-000000000003', workspace_id: WORKSPACE_ID, name: 'Sur' },
  ], { onConflict: 'id', ignoreDuplicates: true })
  log.push('territories OK')

  // ── 6. Sample items (only if boards exist and no items yet) ───────────────
  const { data: boards } = await supabase
    .from('boards')
    .select('id, slug')
    .eq('workspace_id', WORKSPACE_ID)

  const boardMap: Record<string, string> = {}
  boards?.forEach(b => { boardMap[b.slug] = b.id })

  const { count: itemCount } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', WORKSPACE_ID)

  if ((itemCount ?? 0) === 0) {
    // Stages for opportunities
    const { data: stages } = await supabase
      .from('board_stages')
      .select('id, name')
      .eq('board_id', boardMap['oportunidades'] ?? '')

    const stageMap: Record<string, string> = {}
    stages?.forEach(s => { stageMap[s.name] = s.id })

    const now = new Date()
    const d = (days: number) => {
      const dt = new Date(now)
      dt.setDate(dt.getDate() + days)
      return dt.toISOString().split('T')[0]
    }

    const t = 'dddddddd-0000-0000-0000-00000000000'
    const territories = { Norte: `${t}1`, Centro: `${t}2`, Sur: `${t}3` }

    // Opportunities
    if (boardMap['oportunidades']) {
      const opps = [
        { name: 'SEDENA lote Q1',         stage: 'Nueva',       terr: 'Centro', deadline: d(30) },
        { name: 'GN uniformes Q2',         stage: 'Nueva',       terr: 'Norte',  deadline: d(45) },
        { name: 'SSP equipamiento',        stage: 'Cotización',  terr: 'Centro', deadline: d(15) },
        { name: 'PF chalecos 500u',        stage: 'Cotización',  terr: 'Sur',    deadline: d(20) },
        { name: 'Marina botas 200u',       stage: 'Costeo',      terr: 'Norte',  deadline: d(10) },
        { name: 'Ejército gorras 1000u',   stage: 'Costeo',      terr: 'Centro', deadline: d(25) },
        { name: 'SSPE radios 50u',         stage: 'Presentada',  terr: 'Sur',    deadline: d(7)  },
        { name: 'Policía Federal guantes', stage: 'Presentada',  terr: 'Norte',  deadline: d(5)  },
        { name: 'GN cascos 100u',          stage: 'Cerrada',     terr: 'Centro', deadline: d(-10) },
        { name: 'CNDH uniformes',          stage: 'Cerrada',     terr: 'Sur',    deadline: d(-5)  },
      ]
      await supabase.from('items').insert(
        opps.map((o, i) => ({
          workspace_id: WORKSPACE_ID,
          board_id:     boardMap['oportunidades'],
          name:         o.name,
          stage_id:     stageMap[o.stage] ?? null,
          territory_id: territories[o.terr as keyof typeof territories],
          deadline:     o.deadline,
          owner_id:     auth.userId,
          position:     i,
        }))
      )
    }

    // Catalog
    if (boardMap['catalogo']) {
      const products = [
        'Uniforme táctico completo', 'Chaleco táctico', 'Bota táctica',
        'Casco balístico', 'Guantes de combate', 'Cinturón de servicio',
        'Mochila de asalto', 'Rodilleras tácticas', 'Gafas balísticas', 'Radio portátil',
      ]
      await supabase.from('items').insert(
        products.map((name, i) => ({ workspace_id: WORKSPACE_ID, board_id: boardMap['catalogo'], name, position: i }))
      )
    }

    // Accounts
    if (boardMap['cuentas']) {
      await supabase.from('items').insert([
        { workspace_id: WORKSPACE_ID, board_id: boardMap['cuentas'], name: 'SEDENA',           position: 0 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['cuentas'], name: 'Guardia Nacional',  position: 1 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['cuentas'], name: 'SSP Federal',       position: 2 },
      ])
    }

    // Contacts
    if (boardMap['contactos']) {
      await supabase.from('items').insert([
        { workspace_id: WORKSPACE_ID, board_id: boardMap['contactos'], name: 'Juan Martínez',  position: 0 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['contactos'], name: 'Ana Rodríguez',  position: 1 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['contactos'], name: 'Carlos López',   position: 2 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['contactos'], name: 'María González', position: 3 },
        { workspace_id: WORKSPACE_ID, board_id: boardMap['contactos'], name: 'Pedro Sánchez',  position: 4 },
      ])
    }

    log.push('sample items inserted')
  } else {
    log.push(`items already exist (${itemCount})`)
  }

  return NextResponse.json({ ok: true, log })
}
