export type RollupAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_not_empty'

export type RollupConfig = {
  source_level: 'children' | 'descendants'  // 'descendants' = todos los niveles recursivamente
  source_col_key: string                     // col_key de la columna a agregar
  aggregate: RollupAggregate
}

type RowLike = {
  values: { col_key: string; value_number: number | null; value_text: string | null }[]
  children?: { values: { col_key: string; value_number: number | null; value_text: string | null }[]; children?: unknown[] }[]
}

/**
 * Computes a rollup result based on the given configuration and row data.
 * Returns null for any invalid/edge case rather than throwing.
 */
export function computeRollup(
  config: RollupConfig,
  row: RowLike
): number | null {
  try {
    const relevantRows = collectRows(config.source_level, row)

    if (relevantRows.length === 0) {
      return null
    }

    switch (config.aggregate) {
      case 'sum':
        return sumAggregate(config.source_col_key, relevantRows)
      case 'avg':
        return avgAggregate(config.source_col_key, relevantRows)
      case 'min':
        return minAggregate(config.source_col_key, relevantRows)
      case 'max':
        return maxAggregate(config.source_col_key, relevantRows)
      case 'count':
        return countAggregate(relevantRows)
      case 'count_not_empty':
        return countNotEmptyAggregate(config.source_col_key, relevantRows)
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Helper: Collect all relevant rows based on source_level
 */
function collectRows(sourceLevel: 'children' | 'descendants', row: RowLike): RowLike[] {
  if (sourceLevel === 'children') {
    // Only direct children (L2)
    return (row.children ?? []) as RowLike[]
  } else {
    // 'descendants': recursively all levels
    const result: RowLike[] = []
    const stack = [...(row.children ?? [])] as RowLike[]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue
      result.push(current)
      if (current.children) {
        stack.push(...(current.children as RowLike[]))
      }
    }
    return result
  }
}

/**
 * Helper: Extract value_number from a row for a given col_key
 */
function getNumberValue(colKey: string, row: RowLike): number | null {
  const val = row.values.find(v => v.col_key === colKey)
  if (!val) return null
  return val.value_number
}

/**
 * Helper: Check if a row has a non-empty value for a given col_key
 */
function hasNonEmptyValue(colKey: string, row: RowLike): boolean {
  const val = row.values.find(v => v.col_key === colKey)
  if (!val) return false
  return val.value_number !== null || val.value_text !== null
}

/**
 * Aggregate: Sum
 */
function sumAggregate(colKey: string, rows: RowLike[]): number | null {
  let total = 0
  let count = 0
  for (const row of rows) {
    const num = getNumberValue(colKey, row)
    if (num !== null) {
      total += num
      count++
    }
  }
  return count > 0 ? total : null
}

/**
 * Aggregate: Average
 */
function avgAggregate(colKey: string, rows: RowLike[]): number | null {
  let total = 0
  let count = 0
  for (const row of rows) {
    const num = getNumberValue(colKey, row)
    if (num !== null) {
      total += num
      count++
    }
  }
  return count > 0 ? total / count : null
}

/**
 * Aggregate: Min
 */
function minAggregate(colKey: string, rows: RowLike[]): number | null {
  let min: number | null = null
  for (const row of rows) {
    const num = getNumberValue(colKey, row)
    if (num !== null) {
      if (min === null || num < min) {
        min = num
      }
    }
  }
  return min
}

/**
 * Aggregate: Max
 */
function maxAggregate(colKey: string, rows: RowLike[]): number | null {
  let max: number | null = null
  for (const row of rows) {
    const num = getNumberValue(colKey, row)
    if (num !== null) {
      if (max === null || num > max) {
        max = num
      }
    }
  }
  return max
}

/**
 * Aggregate: Count (counts rows, regardless of value)
 */
function countAggregate(rows: RowLike[]): number | null {
  return rows.length > 0 ? rows.length : null
}

/**
 * Aggregate: Count not empty (counts rows where value is not null/empty)
 */
function countNotEmptyAggregate(colKey: string, rows: RowLike[]): number | null {
  const count = rows.filter(row => hasNonEmptyValue(colKey, row)).length
  return count > 0 ? count : null
}
