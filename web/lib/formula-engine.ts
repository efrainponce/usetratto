export type FormulaCondition = {
  col: string
  operator: '>' | '<' | '=' | '!=' | 'empty' | 'not_empty'
  value?: unknown
}

export type FormulaConfig =
  | { type: 'arithmetic'; op: 'add' | 'subtract' | 'multiply' | 'divide' | 'percent'; col_a: string; col_b: string }
  | { type: 'if'; condition: FormulaCondition; col_true: string | number; col_false: string | number }
  | { type: 'concat'; cols: string[]; separator: string }
  | { type: 'date_diff'; col_a: string; col_b: string; unit: 'days' | 'hours' }
  | { type: 'count_if'; col: string; operator: '>' | '<' | '=' | '!='; value: unknown }

/**
 * Computes a formula result based on the given configuration and row data.
 * Returns null for any invalid/edge case rather than throwing.
 */
export function computeFormula(
  config: FormulaConfig,
  row: Record<string, unknown>
): number | string | null {
  try {
    switch (config.type) {
      case 'arithmetic':
        return computeArithmetic(config, row)
      case 'if': {
        const result = computeIf(config, row)
        // Normalize to number, string, or null
        if (result === null || result === undefined) return null
        if (typeof result === 'number' || typeof result === 'string') return result
        return String(result)
      }
      case 'concat':
        return computeConcat(config, row)
      case 'date_diff':
        return computeDateDiff(config, row)
      case 'count_if':
        return computeCountIf(config, row)
      default:
        return null
    }
  } catch {
    return null
  }
}

function computeArithmetic(
  config: { type: 'arithmetic'; op: 'add' | 'subtract' | 'multiply' | 'divide' | 'percent'; col_a: string; col_b: string },
  row: Record<string, unknown>
): number | null {
  const a = toNumber(row[config.col_a])
  const b = toNumber(row[config.col_b])

  if (a === null || b === null) return null

  switch (config.op) {
    case 'add':
      return a + b
    case 'subtract':
      return a - b
    case 'multiply':
      return a * b
    case 'divide':
      return b === 0 ? null : a / b
    case 'percent':
      return (a * b) / 100
    default:
      return null
  }
}

function computeIf(
  config: { type: 'if'; condition: FormulaCondition; col_true: string | number; col_false: string | number },
  row: Record<string, unknown>
): unknown {
  const conditionMet = evaluateCondition(config.condition, row)
  const resultKey = conditionMet ? config.col_true : config.col_false

  // If resultKey is a number literal, return it directly
  if (typeof resultKey === 'number') {
    return resultKey
  }

  // Otherwise treat as column key
  const value = row[resultKey]
  return value ?? null
}

function computeConcat(
  config: { type: 'concat'; cols: string[]; separator: string },
  row: Record<string, unknown>
): string {
  const parts: string[] = []

  for (const col of config.cols) {
    const value = row[col]
    if (value !== null && value !== undefined && value !== '') {
      parts.push(String(value))
    }
  }

  return parts.join(config.separator)
}

function computeDateDiff(
  config: { type: 'date_diff'; col_a: string; col_b: string; unit: 'days' | 'hours' },
  row: Record<string, unknown>
): number | null {
  const dateA = toDate(row[config.col_a])
  const dateB = toDate(row[config.col_b])

  if (!dateA || !dateB) return null

  const diffMs = dateA.getTime() - dateB.getTime()

  switch (config.unit) {
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24))
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60))
    default:
      return null
  }
}

function computeCountIf(
  config: { type: 'count_if'; col: string; operator: '>' | '<' | '=' | '!='; value: unknown },
  row: Record<string, unknown>
): number {
  const cellValue = row[config.col]

  // If array (multiselect), count items matching
  if (Array.isArray(cellValue)) {
    return cellValue.filter((item) => conditionMatches(item, config.operator, config.value)).length
  }

  // If single value, return 1 if matches, 0 otherwise
  return conditionMatches(cellValue, config.operator, config.value) ? 1 : 0
}

/**
 * Helper: Evaluate a single condition
 */
function evaluateCondition(condition: FormulaCondition, row: Record<string, unknown>): boolean {
  const value = row[condition.col]

  switch (condition.operator) {
    case 'empty':
      return value === null || value === undefined || value === ''
    case 'not_empty':
      return value !== null && value !== undefined && value !== ''
    case '=':
    case '!=':
    case '<':
    case '>':
      return conditionMatches(value, condition.operator, condition.value)
    default:
      return false
  }
}

/**
 * Helper: Check if a value matches a comparison condition
 */
function conditionMatches(value: unknown, operator: '>' | '<' | '=' | '!=', compareValue: unknown): boolean {
  // Try numeric comparison if both are numbers
  const numValue = toNumber(value)
  const numCompare = toNumber(compareValue)

  if (numValue !== null && numCompare !== null) {
    switch (operator) {
      case '=':
        return numValue === numCompare
      case '!=':
        return numValue !== numCompare
      case '<':
        return numValue < numCompare
      case '>':
        return numValue > numCompare
      default:
        return false
    }
  }

  // Fall back to string comparison
  const strValue = String(value)
  const strCompare = String(compareValue)

  switch (operator) {
    case '=':
      return strValue === strCompare
    case '!=':
      return strValue !== strCompare
    case '<':
      return strValue < strCompare
    case '>':
      return strValue > strCompare
    default:
      return false
  }
}

/**
 * Helper: Safely convert value to number
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? null : parsed
}

/**
 * Helper: Safely convert value to Date
 */
function toDate(value: unknown): Date | null {
  if (!value) return null
  try {
    const date = new Date(value as string | number)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}
