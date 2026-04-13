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

// ─── ConnectStep ──────────────────────────────────────────────────────────────

type AirtableFieldMeta = { id: string; name: string; type: string }

function AirtableConnectStep({ onConnected, onBack }: ConnectStepProps) {
  const [pat,     setPat]     = useState('')
  const [baseId,  setBaseId]  = useState('')
  const [tableId, setTableId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleConnect = async () => {
    setError(null)
    setLoading(true)
    try {
      // Fetch table metadata client-side (Airtable API supports CORS)
      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
        { headers: { Authorization: `Bearer ${pat}` } }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(err?.error?.message ?? `Error ${res.status} al conectar con Airtable`)
      }
      const data = await res.json() as { tables: Array<{ id: string; fields: AirtableFieldMeta[] }> }
      const table = data.tables?.find(t => t.id === tableId)
      if (!table) throw new Error('Tabla no encontrada en esa base. Verifica el Table ID.')

      const fields: ImportField[] = table.fields.map(f => ({ key: f.name, label: f.name }))

      // fetchAll: paginate through all records client-side
      const fetchAll = async (): Promise<Array<Record<string, string>>> => {
        const all: Array<Record<string, string>> = []
        let offset: string | undefined
        do {
          const url = `https://api.airtable.com/v0/${baseId}/${tableId}?pageSize=100${offset ? `&offset=${offset}` : ''}`
          const r = await fetch(url, { headers: { Authorization: `Bearer ${pat}` } })
          if (!r.ok) throw new Error(`Error ${r.status} al obtener registros de Airtable`)
          const page = await r.json() as {
            records: Array<{ fields: Record<string, unknown> }>
            offset?: string
          }
          for (const rec of page.records) {
            const row: Record<string, string> = {}
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-gray-500">
        Necesitas un Personal Access Token de Airtable con permisos de lectura (<code className="bg-gray-100 px-1 rounded">data.records:read</code>).
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-gray-700">Personal Access Token</span>
          <input
            type="password"
            value={pat}
            onChange={e => setPat(e.target.value)}
            placeholder="patXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-gray-700">Base ID</span>
          <input
            value={baseId}
            onChange={e => setBaseId(e.target.value)}
            placeholder="appXXXXXXXXXXXXXX"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-indigo-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-gray-700">Table ID</span>
          <input
            value={tableId}
            onChange={e => setTableId(e.target.value)}
            placeholder="tblXXXXXXXXXXXXXX"
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] focus:outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Volver
        </button>
        <button
          onClick={handleConnect}
          disabled={!pat || !baseId || !tableId || loading}
          className="px-4 py-2 bg-indigo-600 text-white text-[13px] font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Conectando…' : 'Conectar'}
        </button>
      </div>
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
