'use client'

import { useState } from 'react'
import type { ImportSource, ConnectStepProps, ImportField } from './types'

// ─── Icon ─────────────────────────────────────────────────────────────────────

function AirtableIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3"  y="3"  width="6" height="6" fill="currentColor" />
      <rect x="3"  y="11" width="6" height="6" fill="currentColor" />
      <rect x="11" y="3"  width="6" height="6" fill="currentColor" />
      <rect x="11" y="11" width="6" height="6" fill="currentColor" />
      <rect x="19" y="3"  width="2" height="14" fill="currentColor" />
      <rect x="3"  y="19" width="14" height="2"  fill="currentColor" />
    </svg>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'API Key' },
    { n: 2, label: 'Base'    },
    { n: 3, label: 'Tabla'   },
  ] as const
  return (
    <div className="flex items-center mb-5">
      {steps.map(({ n, label }, i) => {
        const done    = current > n
        const active  = current === n
        const pending = current < n
        return (
          <div key={n} className="flex items-center" style={{ flex: i < 2 ? 1 : 'none' }}>
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                done    ? 'bg-emerald-500 text-white' :
                active  ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' :
                          'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-white">
                    <path d="M2 5l2.5 2.5L8 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : n}
              </div>
              <span className={`text-[12px] font-medium transition-colors ${
                done    ? 'text-emerald-600' :
                active  ? 'text-gray-800' :
                          'text-gray-400'
              }`}>{label}</span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-px mx-2 transition-colors ${done ? 'bg-emerald-200' : 'bg-gray-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Airtable → Tratto kind mapping ──────────────────────────────────────────

const AIRTABLE_KIND: Record<string, string> = {
  singleLineText:        'text',
  multilineText:         'text',
  richText:              'text',
  number:                'number',
  currency:              'number',
  percent:               'number',
  rating:                'number',
  autoNumber:            'number',
  count:                 'number',
  rollup:                'number',
  date:                  'date',
  dateTime:              'date',
  createdTime:           'date',
  lastModifiedTime:      'date',
  singleSelect:          'select',
  multipleSelects:       'multiselect',
  checkbox:              'boolean',
  email:                 'email',
  phoneNumber:           'phone',
  url:                   'url',
  collaborator:          'people',
  formula:               'text',
  lookup:                'text',
  multipleRecordLinks:   'text',
  multipleAttachments:   'text',
  createdBy:             'text',
  lastModifiedBy:        'text',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AirtableBase  = { id: string; name: string }
type AirtableField = { id: string; name: string; type: string }
type AirtableTable = { id: string; name: string; fields: AirtableField[] }

// ─── ConnectStep ──────────────────────────────────────────────────────────────

function AirtableConnectStep({ onConnected, onBack }: ConnectStepProps) {
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1)
  const [pat,     setPat]     = useState('')
  const [bases,   setBases]   = useState<AirtableBase[]>([])
  const [baseId,  setBaseId]  = useState('')
  const [tables,  setTables]  = useState<AirtableTable[]>([])
  const [tableId, setTableId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Step 1 → 2: fetch available bases ─────────────────────────────────────
  const handleConnectPat = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('https://api.airtable.com/v0/meta/bases', {
        headers: { Authorization: `Bearer ${pat}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err?.error?.message ?? `Error ${res.status} — verifica que el token sea válido`)
      }
      const data = await res.json() as { bases: AirtableBase[] }
      if (!data.bases?.length) throw new Error('No se encontraron bases accesibles con este token.')
      setBases(data.bases)
      setBaseId(data.bases[0].id)
      setSubStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2 → 3: fetch tables for selected base ─────────────────────────────
  const handleSelectBase = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
        headers: { Authorization: `Bearer ${pat}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err?.error?.message ?? `Error ${res.status} al obtener tablas`)
      }
      const data = await res.json() as { tables: AirtableTable[] }
      if (!data.tables?.length) throw new Error('Esta base no tiene tablas.')
      setTables(data.tables)
      setTableId(data.tables[0].id)
      setSubStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 → done: call onConnected ───────────────────────────────────────
  const handleSelectTable = () => {
    const table = tables.find(t => t.id === tableId)
    if (!table) return

    const fields: ImportField[] = [
      // Capture Airtable record ID for future refresh/sync (user can map or ignore)
      { key: '__airtable_id', label: 'Airtable ID', sourceKind: 'text' },
      ...table.fields.map(f => ({
        key:        f.name,
        label:      f.name,
        sourceKind: AIRTABLE_KIND[f.type] ?? 'text',
      })),
    ]

    const fetchAll = async (): Promise<Array<Record<string, string>>> => {
      const all: Array<Record<string, string>> = []
      let offset: string | undefined
      do {
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } })
        if (!r.ok) throw new Error(`Error ${r.status} al obtener registros de Airtable`)
        const page = await r.json() as {
          records: Array<{ id: string; fields: Record<string, unknown> }>
          offset?: string
        }
        for (const rec of page.records) {
          const row: Record<string, string> = {}
          row['__airtable_id'] = rec.id  // stable ID for future refresh/sync
          for (const [k, v] of Object.entries(rec.fields)) {
            if (v == null) continue
            row[k] = Array.isArray(v) ? v.join(', ') : String(v)
          }
          all.push(row)
        }
        offset = page.offset
      } while (offset)
      return all
    }

    onConnected({ fields, fetchAll })
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-indigo-400'
  const selectCls = 'w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-indigo-400 bg-white'
  const btnPrimary = 'px-4 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors'
  const btnBack = 'text-[12px] text-gray-500 hover:text-gray-700 transition-colors'

  return (
    <div className="flex flex-col gap-4">
      <StepBar current={subStep} />

      {/* ── Step 1: API Key ──────────────────────────────────────────────── */}
      {subStep === 1 && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-gray-600">
              Necesitas un <strong>Personal Access Token</strong> de Airtable con los scopes:{' '}
              <code className="bg-gray-100 px-1 rounded text-[11px]">data.records:read</code>{' '}
              <code className="bg-gray-100 px-1 rounded text-[11px]">schema.bases:read</code>
            </p>
            <a
              href="https://airtable.com/create/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-indigo-600 hover:text-indigo-700 mt-1"
            >
              Crear token en Airtable
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
                <path d="M2 8L8 2M8 2H4M8 2v4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-gray-700">Personal Access Token</span>
            <input
              type="password"
              value={pat}
              onChange={e => setPat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && pat && !loading && handleConnectPat()}
              placeholder="patXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className={inputCls}
              autoFocus
            />
          </label>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <button onClick={onBack} className={btnBack}>← Volver</button>
            <button onClick={handleConnectPat} disabled={!pat || loading} className={btnPrimary}>
              {loading ? 'Conectando…' : 'Conectar →'}
            </button>
          </div>
        </>
      )}

      {/* ── Step 2: Seleccionar base ─────────────────────────────────────── */}
      {subStep === 2 && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-gray-600">
              Se encontraron <strong>{bases.length}</strong> base{bases.length !== 1 ? 's' : ''} accesibles con tu token.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-gray-700">Base de Airtable</span>
            <select value={baseId} onChange={e => setBaseId(e.target.value)} className={selectCls}>
              {bases.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            <button onClick={() => { setSubStep(1); setError(null) }} className={btnBack}>← Volver</button>
            <button onClick={handleSelectBase} disabled={!baseId || loading} className={btnPrimary}>
              {loading ? 'Cargando tablas…' : 'Continuar →'}
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Seleccionar tabla ─────────────────────────────────────── */}
      {subStep === 3 && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-gray-600">
              La base <strong>{bases.find(b => b.id === baseId)?.name}</strong> tiene{' '}
              <strong>{tables.length}</strong> tabla{tables.length !== 1 ? 's' : ''}.
              Elige cuál importar.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-gray-700">Tabla</span>
            <select value={tableId} onChange={e => setTableId(e.target.value)} className={selectCls}>
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.fields.length} campo{t.fields.length !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>

          {tableId && (() => {
            const t = tables.find(t => t.id === tableId)
            return t ? (
              <p className="text-[11px] text-gray-400">
                Campos: {t.fields.slice(0, 6).map(f => f.name).join(', ')}
                {t.fields.length > 6 ? ` +${t.fields.length - 6} más` : ''}
              </p>
            ) : null
          })()}

          <div className="flex items-center justify-between pt-1">
            <button onClick={() => { setSubStep(2); setError(null) }} className={btnBack}>← Volver</button>
            <button onClick={handleSelectTable} disabled={!tableId} className={btnPrimary}>
              Listo, mapear columnas →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Source definition ────────────────────────────────────────────────────────

export const AirtableSource: ImportSource = {
  id:          'airtable',
  label:       'Airtable',
  description: 'Conecta con tu base de Airtable',
  icon:        AirtableIcon,
  ConnectStep: AirtableConnectStep,
}
