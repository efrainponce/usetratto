'use client'

import type { ComponentType } from 'react'

// ─── Field from the source (Airtable field, CSV header, Monday column, etc.) ─

export type ImportField = {
  key:        string    // stable key used in fetchAll() records
  label:      string    // display name shown in the mapper
  sourceKind?: string   // source system's type hint (e.g. Airtable 'number', 'date')
                        // ColumnMapper uses this to auto-detect the Tratto kind on create
}

// ─── Result returned by a ConnectStep once connection is established ──────────

export type ConnectResult = {
  fields:   ImportField[]
  // Returns ALL records as { [field.key]: string }
  // Called after column mapping is confirmed, before final import
  fetchAll: () => Promise<Array<Record<string, string>>>
}

// ─── Props received by every ConnectStep component ───────────────────────────

export type ConnectStepProps = {
  onConnected: (result: ConnectResult) => void
  onBack:      () => void                     // go back to source picker
}

// ─── Source definition registered in sources/index.ts ────────────────────────

export type ImportSource = {
  id:          string                               // 'airtable' | 'csv' | 'monday' …
  label:       string                               // 'Airtable'
  description: string                               // 'Conecta con tu base de Airtable'
  icon:        ComponentType<{ className?: string }> // SVG icon component
  ConnectStep: ComponentType<ConnectStepProps>
}
