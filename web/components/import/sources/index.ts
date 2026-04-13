import type { ImportSource } from './types'
import { AirtableSource } from './AirtableSource'
import { CsvSource }      from './CsvSource'

// ─── Source registry ──────────────────────────────────────────────────────────
// To add a new source (e.g. Monday.com):
//   1. Create MondaySource.tsx with icon + ConnectStep + ImportSource def
//   2. Add it to this array — ImportWizard will display it automatically

export const IMPORT_SOURCES: ImportSource[] = [
  AirtableSource,
  CsvSource,
]

export type { ImportSource } from './types'
export type { ConnectResult, ConnectStepProps, ImportField } from './types'
