import type { SubItemData } from '@/lib/boards/types'

export function findInTree(rows: SubItemData[], id: string): SubItemData | null {
  for (const r of rows) {
    if (r.id === id) return r
    if (r.children) {
      const found = findInTree(r.children, id)
      if (found) return found
    }
  }
  return null
}

export function patchTree(rows: SubItemData[], id: string, patch: Partial<SubItemData>): SubItemData[] {
  return rows.map(r => {
    if (r.id === id) return { ...r, ...patch }
    if (r.children) return { ...r, children: patchTree(r.children, id, patch) }
    return r
  })
}

export function patchValueInTree(rows: SubItemData[], id: string, columnId: string, value: unknown): SubItemData[] {
  return rows.map(row => {
    if (row.id === id) {
      const isNum = typeof value === 'number'
      const existing = row.values.find(v => v.column_id === columnId)
      const newVal = existing
        ? { ...existing, value_number: isNum ? (value as number) : existing.value_number, value_text: !isNum ? (value as string) : existing.value_text }
        : { column_id: columnId, col_key: '', value_number: isNum ? (value as number) : null, value_text: !isNum ? (value as string) : null, value_date: null, value_json: null }
      const newValues = existing
        ? row.values.map(v => v.column_id === columnId ? newVal : v)
        : [...row.values, newVal]
      return { ...row, values: newValues }
    }
    if (row.children?.length) {
      return { ...row, children: patchValueInTree(row.children, id, columnId, value) }
    }
    return row
  })
}
