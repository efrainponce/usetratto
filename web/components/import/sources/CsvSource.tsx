'use client'

import { useState, useRef } from 'react'
import type { ImportSource, ConnectStepProps } from './types'

// ─── Icon ─────────────────────────────────────────────────────────────────────

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V10l-8-8z"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h8M8 9h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── CSV parser (no external deps) ───────────────────────────────────────────

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  return { headers: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) }
}

// ─── ConnectStep ──────────────────────────────────────────────────────────────

function CsvConnectStep({ onConnected, onBack }: ConnectStepProps) {
  const [dragging, setDragging] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File) => {
    setError(null)
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('El archivo debe ser .csv')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (headers.length === 0) {
        setError('No se pudo leer el archivo. Verifica que sea un CSV válido.')
        return
      }
      if (rows.length === 0) {
        setError('El archivo no tiene registros (solo encabezados).')
        return
      }
      const fields = headers.map(h => ({ key: h, label: h }))
      const fetchAll = async () =>
        rows.map(row => {
          const record: Record<string, string> = {}
          headers.forEach((h, i) => { if (row[i]) record[h] = row[i] })
          return record
        })
      onConnected({ fields, fetchAll })
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-gray-500">
        Primera fila como encabezados. Puedes mapear cada columna a los campos de este board.
      </p>

      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) processFile(file)
        }}
        className={`flex flex-col items-center justify-center gap-2 h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400 stroke-current">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] text-gray-500">Arrastra un archivo CSV o <span className="text-indigo-600">haz clic</span></span>
        <span className="text-[11px] text-gray-400">Solo archivos .csv</span>
      </label>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Volver
        </button>
      </div>
    </div>
  )
}

// ─── Source definition ────────────────────────────────────────────────────────

export const CsvSource: ImportSource = {
  id:          'csv',
  label:       'Archivo CSV',
  description: 'Sube un archivo .csv',
  icon:        CsvIcon,
  ConnectStep: CsvConnectStep,
}
