/**
 * Standalone seed script — runs directly with tsx, no auth needed.
 * Usage: npx tsx scripts/seed-perf.ts
 *
 * Seeds 250 opportunities with contacts, institutions, montos, and 2-5 sub-items each.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const WS = 'aaaaaaaa-0000-0000-0000-000000000001'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in web/.env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

async function main() {
  console.log('🔧 Seed perf — 250 opportunities + sub-items')

  // ── 1. Boards ─────────────────────────────────────────────────────────────
  const { data: boards } = await supabase.from('boards').select('id, slug').eq('workspace_id', WS)
  const bm: Record<string, string> = {}
  boards?.forEach(b => { bm[b.slug] = b.id })

  if (!bm['oportunidades']) { console.error('❌ Board oportunidades not found — run /api/admin/seed first'); process.exit(1) }
  console.log(`  boards: ${Object.keys(bm).join(', ')}`)

  // ── 2. Stages ─────────────────────────────────────────────────────────────
  const { data: stages } = await supabase.from('board_stages').select('id, name').eq('board_id', bm['oportunidades'])
  const sm: Record<string, string> = {}
  stages?.forEach(s => { sm[s.name] = s.id })
  console.log(`  stages: ${Object.keys(sm).join(', ')}`)

  // ── 3. Existing data ──────────────────────────────────────────────────────
  const [{ data: contacts }, { data: accounts }, { data: catalogItems }] = await Promise.all([
    supabase.from('items').select('id, name').eq('board_id', bm['contactos'] ?? ''),
    supabase.from('items').select('id, name').eq('board_id', bm['cuentas'] ?? ''),
    supabase.from('items').select('id, name').eq('board_id', bm['catalogo'] ?? ''),
  ])
  console.log(`  contacts: ${contacts?.length ?? 0}, accounts: ${accounts?.length ?? 0}, catalog: ${catalogItems?.length ?? 0}`)

  // ── 4. Column IDs ─────────────────────────────────────────────────────────
  const { data: oppCols } = await supabase.from('board_columns').select('id, col_key').eq('board_id', bm['oportunidades'])
  const cm: Record<string, string> = {}
  oppCols?.forEach(c => { cm[c.col_key] = c.id })

  const { data: subCols } = await supabase.from('sub_item_columns').select('id, col_key').eq('board_id', bm['oportunidades'])
  const scm: Record<string, string> = {}
  subCols?.forEach(c => { scm[c.col_key] = c.id })

  // ── 5. Find user by email ─────────────────────────────────────────────────
  const { data: user } = await supabase.from('users').select('id').eq('email', 'efrain.ponces@gmail.com').maybeSingle()
  const ownerId = user?.id ?? null
  console.log(`  owner: ${ownerId ? 'found' : 'not found (will be null)'}`)

  // ── 6. Generate 250 opportunities ─────────────────────────────────────────
  const clients = ['SEDENA','Guardia Nacional','SSP Federal','Marina','Policía Federal','SSPE Jalisco','SSPE NL','CNDH','Ejército','Fuerza Aérea','SEMAR','CNS','INM','CENAPI','PGR','SSP Guerrero','SSP Tamaulipas','SSP Sonora','SSP Chihuahua','SSP Veracruz']
  const products = ['uniformes tácticos','chalecos antibalas','botas tácticas','cascos balísticos','guantes de combate','cinturones','mochilas de asalto','rodilleras','gafas balísticas','radios portátiles','fundas tácticas','fornituras','camisolas','pantalones BDU','gorras operativas','coderas','ponchos impermeables','cantimploras','pasamontañas','insignias']
  const quantities = ['50u','100u','200u','300u','500u','750u','1000u','1500u','2000u','3000u']
  const quarters = ['Q1','Q2','Q3','Q4']
  const territories = ['dddddddd-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000003']
  const stageNames = ['Nueva','Cotización','Costeo','Presentada','Cerrada']

  const now = new Date()
  const rDate = (min: number, max: number) => {
    const d = new Date(now); d.setDate(d.getDate() + min + Math.floor(Math.random() * (max - min)))
    return d.toISOString().split('T')[0]
  }

  const oppRows = Array.from({ length: 250 }, (_, i) => {
    const stage = pick(stageNames)
    return {
      workspace_id: WS,
      board_id: bm['oportunidades'],
      name: `${pick(clients)} ${pick(products)} ${pick(quantities)} ${pick(quarters)}`,
      stage_id: sm[stage] ?? null,
      territory_id: pick(territories),
      deadline: stage === 'Cerrada' ? rDate(-60, -1) : rDate(5, 120),
      owner_id: ownerId,
      position: i + 100,
    }
  })

  // ── 7. Insert items in batches ────────────────────────────────────────────
  for (let i = 0; i < oppRows.length; i += 50) {
    const { error } = await supabase.from('items').insert(oppRows.slice(i, i + 50))
    if (error) { console.error(`  ❌ items batch ${i}: ${error.message}`); return }
    process.stdout.write(`  items ${i + 50}/250\r`)
  }
  console.log('  ✅ 250 items inserted')

  // ── 8. Get all opportunity IDs ────────────────────────────────────────────
  const { data: allOpps } = await supabase
    .from('items').select('id').eq('board_id', bm['oportunidades']).eq('workspace_id', WS)
    .order('position', { ascending: true })

  if (!allOpps?.length) { console.error('  ❌ no items found'); return }

  // ── 9. Set item_values ────────────────────────────────────────────────────
  if (cm['contacto'] && contacts?.length) {
    const vals = allOpps.map(o => ({ item_id: o.id, column_id: cm['contacto'], value_text: pick(contacts!).id }))
    for (let i = 0; i < vals.length; i += 50) {
      await supabase.from('item_values').upsert(vals.slice(i, i + 50), { onConflict: 'item_id,column_id' })
    }
    console.log('  ✅ contacto values set')
  }

  if (cm['cuenta'] && accounts?.length) {
    const vals = allOpps.map(o => ({ item_id: o.id, column_id: cm['cuenta'], value_text: pick(accounts!).id }))
    for (let i = 0; i < vals.length; i += 50) {
      await supabase.from('item_values').upsert(vals.slice(i, i + 50), { onConflict: 'item_id,column_id' })
    }
    console.log('  ✅ cuenta values set')
  }

  if (cm['monto']) {
    const vals = allOpps.map(o => ({ item_id: o.id, column_id: cm['monto'], value_number: Math.floor(50000 + Math.random() * 5000000) }))
    for (let i = 0; i < vals.length; i += 50) {
      await supabase.from('item_values').upsert(vals.slice(i, i + 50), { onConflict: 'item_id,column_id' })
    }
    console.log('  ✅ monto values set')
  }

  // ── 10. Sub-items (2-5 catalog products per opportunity) ──────────────────
  if (catalogItems?.length) {
    const subRows: Array<{ workspace_id: string; item_id: string; depth: number; name: string; position: number }> = []
    for (const opp of allOpps) {
      const n = 2 + Math.floor(Math.random() * 4)
      const shuffled = [...catalogItems].sort(() => Math.random() - 0.5)
      for (let j = 0; j < n && j < shuffled.length; j++) {
        subRows.push({ workspace_id: WS, item_id: opp.id, depth: 0, name: shuffled[j].name, position: j })
      }
    }

    for (let i = 0; i < subRows.length; i += 100) {
      const { error } = await supabase.from('sub_items').insert(subRows.slice(i, i + 100))
      if (error) { console.error(`  ❌ sub_items batch ${i}: ${error.message}`); return }
      process.stdout.write(`  sub_items ${Math.min(i + 100, subRows.length)}/${subRows.length}\r`)
    }
    console.log(`  ✅ ${subRows.length} sub_items inserted`)

    // Set qty + unit_price if sub_item_columns exist
    if (scm['qty'] || scm['unit_price']) {
      const { data: allSubs } = await supabase.from('sub_items').select('id').eq('workspace_id', WS).in('item_id', allOpps.map(o => o.id))
      if (allSubs) {
        const subVals: Array<{ sub_item_id: string; column_id: string; value_number: number }> = []
        for (const si of allSubs) {
          if (scm['qty']) subVals.push({ sub_item_id: si.id, column_id: scm['qty'], value_number: Math.floor(1 + Math.random() * 500) })
          if (scm['unit_price']) subVals.push({ sub_item_id: si.id, column_id: scm['unit_price'], value_number: Math.floor(100 + Math.random() * 10000) })
        }
        for (let i = 0; i < subVals.length; i += 100) {
          await supabase.from('sub_item_values').upsert(subVals.slice(i, i + 100), { onConflict: 'sub_item_id,column_id' })
        }
        console.log(`  ✅ ${subVals.length} sub_item_values set`)
      }
    }
  }

  console.log('\n🎉 Done! Open /app/b/[oportunidades-sid] to test performance.')
}

main().catch(console.error)
