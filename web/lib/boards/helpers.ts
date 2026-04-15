export function getPrimaryStageColKey(columns: Array<{ col_key: string; kind: string; settings?: any }>): string | null {
  const tagged = columns.find(c => c.settings?.role === 'primary_stage' && c.kind === 'select')
  if (tagged) return tagged.col_key
  const fallback = columns.find(c => c.col_key === 'stage' && c.kind === 'select')
  return fallback?.col_key ?? null
}

export function getOwnerColKey(columns: Array<{ col_key: string; kind: string; settings?: any }>): string | null {
  const tagged = columns.find(c => c.settings?.role === 'owner' && c.kind === 'people')
  if (tagged) return tagged.col_key
  const fallback = columns.find(c => c.col_key === 'owner' && c.kind === 'people')
  return fallback?.col_key ?? null
}

export function getEndDateColKey(columns: Array<{ col_key: string; kind: string; settings?: any }>): string | null {
  const tagged = columns.find(c => c.settings?.role === 'end_date' && c.kind === 'date')
  if (tagged) return tagged.col_key
  const fallback = columns.find(c => c.col_key === 'deadline' && c.kind === 'date')
  return fallback?.col_key ?? null
}
