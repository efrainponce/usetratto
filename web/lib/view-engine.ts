import type {
  Row,
  ColumnDef,
  CellValue,
  ViewFilter,
  ViewSort,
  FilterOperator,
  GroupedRows,
  DateBucket,
  SelectOption,
} from '@/components/data-table/types'

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Coerce a cell value to a string for comparison.
 */
function cellToString(value: CellValue): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}

/**
 * Check if a cell value is considered "empty".
 */
function isEmpty(value: CellValue): boolean {
  if (value === null || value === undefined) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * Normalize a value for equality comparison.
 */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v.toLowerCase() : v))
  }
  if (typeof value === 'string') {
    return value.toLowerCase()
  }
  return value
}

/**
 * Get the numeric value from a CellValue for numeric comparisons.
 */
function toNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return null
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const num = Number(value)
  return isNaN(num) ? null : num
}

/**
 * Get the ISO date string from a CellValue for date comparisons.
 */
function toDate(value: CellValue): string | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return null
  if (typeof value === 'string') {
    // Very basic check: if it looks like ISO date, use it
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value
  }
  return null
}

/**
 * Extract bucket key from an ISO date string.
 * Exported for reuse in panels.
 */
export function dateBucketKey(iso: string, bucket: DateBucket): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return '__empty'

  const year = match[1]
  const month = match[2]
  const day = match[3]

  if (bucket === 'day') {
    return `${year}-${month}-${day}`
  }
  if (bucket === 'week') {
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`)
    const jan4 = new Date(`${year}-01-04T00:00:00Z`)
    const weekStart = new Date(date)
    weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay() + 1)
    const dayDiff = Math.floor(
      (weekStart.getTime() - jan4.getTime() + (jan4.getUTCDay() - 1) * 86400000) /
        (7 * 86400000)
    )
    const weekNum = String(dayDiff + 1).padStart(2, '0')
    return `${year}-W${weekNum}`
  }
  if (bucket === 'month') {
    return `${year}-${month}`
  }
  return '__empty'
}

/**
 * Evaluate a single filter condition against a cell value.
 */
function evaluateFilter(
  cellValue: CellValue,
  operator: FilterOperator,
  filterValue: unknown,
  columnKind: string
): boolean {
  // Empty checks
  if (operator === 'is_empty') {
    return isEmpty(cellValue)
  }
  if (operator === 'is_not_empty') {
    return !isEmpty(cellValue)
  }

  // All other operators fail if cell is empty (except 'in'/'not_in' which handle arrays)
  if (isEmpty(cellValue)) {
    if (operator === 'in' || operator === 'not_in') {
      // Continue to check against the filter array
    } else {
      return false
    }
  }

  // Equality
  if (operator === 'equals') {
    const normalized = normalizeValue(cellValue)
    const normalizedFilter = normalizeValue(filterValue)
    return normalized === normalizedFilter
  }

  if (operator === 'not_equals') {
    const normalized = normalizeValue(cellValue)
    const normalizedFilter = normalizeValue(filterValue)
    return normalized !== normalizedFilter
  }

  // Contains (substring for strings; membership for arrays)
  if (operator === 'contains') {
    const filterStr = String(filterValue).toLowerCase()
    if (Array.isArray(cellValue)) {
      return cellValue.some((v) => String(v).toLowerCase().includes(filterStr))
    }
    return cellToString(cellValue).toLowerCase().includes(filterStr)
  }

  if (operator === 'not_contains') {
    const filterStr = String(filterValue).toLowerCase()
    if (Array.isArray(cellValue)) {
      return !cellValue.some((v) => String(v).toLowerCase().includes(filterStr))
    }
    return !cellToString(cellValue).toLowerCase().includes(filterStr)
  }

  // Numeric comparisons
  if (operator === 'gt' || operator === 'lt' || operator === 'gte' || operator === 'lte') {
    if (columnKind === 'date') {
      const cellDate = toDate(cellValue)
      const filterDate = typeof filterValue === 'string' ? filterValue : null
      if (!cellDate || !filterDate) return false

      const cmp = cellDate.localeCompare(filterDate)
      if (operator === 'gt') return cmp > 0
      if (operator === 'lt') return cmp < 0
      if (operator === 'gte') return cmp >= 0
      if (operator === 'lte') return cmp <= 0
    } else {
      const cellNum = toNumber(cellValue)
      const filterNum = typeof filterValue === 'number' ? filterValue : null
      if (cellNum === null || filterNum === null) return false

      if (operator === 'gt') return cellNum > filterNum
      if (operator === 'lt') return cellNum < filterNum
      if (operator === 'gte') return cellNum >= filterNum
      if (operator === 'lte') return cellNum <= filterNum
    }
  }

  // Between (inclusive)
  if (operator === 'between') {
    if (!Array.isArray(filterValue) || filterValue.length !== 2) return false

    if (columnKind === 'date') {
      const cellDate = toDate(cellValue)
      if (!cellDate) return false
      const [startDate, endDate] = filterValue
      return cellDate >= String(startDate) && cellDate <= String(endDate)
    } else {
      const cellNum = toNumber(cellValue)
      if (cellNum === null) return false
      const [start, end] = filterValue
      const startNum = typeof start === 'number' ? start : null
      const endNum = typeof end === 'number' ? end : null
      if (startNum === null || endNum === null) return false
      return cellNum >= startNum && cellNum <= endNum
    }
  }

  // in / not_in
  if (operator === 'in') {
    if (!Array.isArray(filterValue)) return false
    if (Array.isArray(cellValue)) {
      // Multiselect: passes if any value is in the filter array
      return cellValue.some((v) =>
        filterValue.includes(v)
      )
    }
    return filterValue.includes(cellValue)
  }

  if (operator === 'not_in') {
    if (!Array.isArray(filterValue)) return false
    if (Array.isArray(cellValue)) {
      // Multiselect: passes if no values are in the filter array
      return !cellValue.some((v) =>
        filterValue.includes(v)
      )
    }
    return !filterValue.includes(cellValue)
  }

  // Unknown operator: lenient (pass)
  return true
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply filters to rows.
 * Returns rows where ALL filters match (AND logic).
 * Missing columns or unknown operators are treated leniently.
 */
export function applyFilters(
  rows: Row[],
  filters: ViewFilter[] | undefined,
  columns: ColumnDef[]
): Row[] {
  if (!filters || filters.length === 0) {
    return rows
  }

  const columnMap = new Map(columns.map((col) => [col.key, col]))

  return rows.filter((row) => {
    return filters.every((filter) => {
      const column = columnMap.get(filter.col_key)
      if (!column) return true // Missing column: lenient

      const cellValue = row.cells[filter.col_key]
      return evaluateFilter(cellValue, filter.operator, filter.value, column.kind)
    })
  })
}

/**
 * Apply multi-column sort to rows.
 * Stable sort by priority (first sort is primary, second is tiebreaker, etc).
 * Null/empty values always sort to the end.
 * Returns a NEW array; does not mutate input.
 */
export function applySort(rows: Row[], sorts: ViewSort[] | undefined): Row[] {
  if (!sorts || sorts.length === 0) {
    return [...rows]
  }

  const sorted = [...rows]

  // Apply sorts in reverse order for stable multi-column sort
  for (let i = sorts.length - 1; i >= 0; i--) {
    const sort = sorts[i]

    sorted.sort((a, b) => {
      const aVal = a.cells[sort.col_key]
      const bVal = b.cells[sort.col_key]

      // Empty values sort to the end
      const aEmpty = isEmpty(aVal)
      const bEmpty = isEmpty(bVal)
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1

      // Arrays: compare by joined string
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        const aStr = aVal.join(',')
        const bStr = bVal.join(',')
        const cmp = aStr.localeCompare(bStr, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        return sort.dir === 'asc' ? cmp : -cmp
      }

      // Booleans: true > false
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        const cmp = Number(bVal) - Number(aVal) // true (1) > false (0)
        return sort.dir === 'asc' ? cmp : -cmp
      }

      // Numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const cmp = aVal - bVal
        return sort.dir === 'asc' ? cmp : -cmp
      }

      // Dates and strings: lexicographic
      const aStr = cellToString(aVal)
      const bStr = cellToString(bVal)
      const cmp = aStr.localeCompare(bStr, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  return sorted
}

/**
 * Group rows by a column value.
 * Returns array of GroupedRows in deterministic order.
 * If no groupBy specified, returns single group with all rows.
 * Empty groups (0 rows) are not returned.
 */
export function groupRows(
  rows: Row[],
  groupBy: string | null | undefined,
  columns: ColumnDef[],
  bucket?: DateBucket
): GroupedRows[] {
  // No grouping: return all rows in one group
  if (!groupBy) {
    return [{ key: '__all', label: 'Todos', rows }]
  }

  const column = columns.find((col) => col.key === groupBy)
  if (!column) {
    return [{ key: '__all', label: 'Todos', rows }]
  }

  // Build option map for select/multiselect/people
  const optionMap = new Map<string, SelectOption>()
  const optionOrder: string[] = []
  if (column.settings.options) {
    column.settings.options.forEach((opt) => {
      optionMap.set(opt.value, opt)
      optionOrder.push(opt.value)
    })
  }

  // Accumulate groups
  const groups = new Map<string, Row[]>()
  const groupLabels = new Map<string, string>()
  const groupColors = new Map<string, string | undefined>()

  rows.forEach((row) => {
    const cellValue = row.cells[groupBy]
    let groupKeys: string[] = []
    let labels: Map<string, string> = new Map()
    let colors: Map<string, string | undefined> = new Map()

    // Compute group keys/labels per kind
    if (column.kind === 'select') {
      const strVal = isEmpty(cellValue) ? '' : cellToString(cellValue)
      const key = strVal || '__empty'
      groupKeys = [key]

      const option = optionMap.get(strVal)
      labels.set(key, option?.label || '—')
      colors.set(key, option?.color)
    } else if (column.kind === 'multiselect') {
      if (Array.isArray(cellValue) && cellValue.length > 0) {
        groupKeys = cellValue.map((v) => String(v))
      } else {
        groupKeys = ['__empty']
      }

      groupKeys.forEach((key) => {
        const option = optionMap.get(key)
        labels.set(key, option?.label || '—')
        colors.set(key, option?.color)
      })
    } else if (column.kind === 'people') {
      const id: string[] = isEmpty(cellValue)
        ? ['__empty']
        : Array.isArray(cellValue)
          ? cellValue.map((v) => String(v))
          : [String(cellValue)]

      groupKeys = id

      groupKeys.forEach((key) => {
        if (key === '__empty') {
          labels.set(key, 'Sin asignar')
        } else {
          const option = optionMap.get(key)
          labels.set(key, option?.label || key)
          colors.set(key, option?.color)
        }
      })
    } else if (column.kind === 'date') {
      const dateStr = isEmpty(cellValue) ? null : toDate(cellValue)
      const key = dateStr ? dateBucketKey(dateStr, bucket ?? 'day') : '__empty'
      groupKeys = [key]
      labels.set(key, key === '__empty' ? 'Sin fecha' : key)
    } else if (column.kind === 'boolean') {
      const boolVal = cellValue === true
      const key = String(boolVal)
      groupKeys = [key]
      labels.set(key, boolVal ? 'Sí' : 'No')
    } else if (column.kind === 'number') {
      const numVal = toNumber(cellValue)
      const key = numVal !== null ? String(numVal) : '—'
      groupKeys = [key]
      labels.set(key, key)
    } else if (column.kind === 'relation') {
      // Value is already resolved to a name
      const strVal = isEmpty(cellValue) ? '' : cellToString(cellValue)
      const key = strVal || '—'
      groupKeys = [key]
      labels.set(key, key)
    } else {
      // Everything else: group by string coercion
      const strVal = isEmpty(cellValue) ? '—' : cellToString(cellValue)
      groupKeys = [strVal]
      labels.set(strVal, strVal)
    }

    // Add row to each group (for multiselect, a row may belong to multiple groups)
    groupKeys.forEach((key) => {
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(row)

      groupLabels.set(key, labels.get(key) || key)
      const color = colors.get(key)
      if (color) {
        groupColors.set(key, color)
      }
    })
  })

  // Sort groups deterministically
  const sortedKeys: string[] = []

  // 1. Known option order (select/multiselect)
  if (column.kind === 'select' || column.kind === 'multiselect') {
    optionOrder.forEach((optKey) => {
      if (groups.has(optKey)) {
        sortedKeys.push(optKey)
      }
    })
  }

  // 2. Date groups sort ascending by key
  if (column.kind === 'date') {
    const dateKeys = Array.from(groups.keys()).filter((k) => k !== '__empty')
    dateKeys.sort()
    sortedKeys.push(...dateKeys)
  }

  // 3. Everything else: alphabetical by label
  const remainingKeys = Array.from(groups.keys()).filter(
    (k) =>
      !sortedKeys.includes(k) &&
      k !== '—' &&
      k !== '__empty'
  )
  remainingKeys.sort((a, b) => {
    const labelA = groupLabels.get(a) || a
    const labelB = groupLabels.get(b) || b
    return labelA.localeCompare(labelB, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
  sortedKeys.push(...remainingKeys)

  // 4. Empty group always last
  if (groups.has('__empty')) {
    sortedKeys.push('__empty')
  }
  if (groups.has('—')) {
    sortedKeys.push('—')
  }

  // Build result
  const result: GroupedRows[] = []
  sortedKeys.forEach((key) => {
    const rowsInGroup = groups.get(key)
    if (rowsInGroup && rowsInGroup.length > 0) {
      result.push({
        key,
        label: groupLabels.get(key) || key,
        color: groupColors.get(key),
        rows: rowsInGroup,
      })
    }
  })

  return result
}
