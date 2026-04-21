/**
 * Pre-condition validation for document templates.
 * Validates conditions before template document generation.
 */

export interface PreCondition {
  col_key: string
  operator: '>' | '<' | '=' | '!=' | 'empty' | 'not_empty' | 'contains' | 'not_contains'
  value?: unknown
  error_msg: string
  scope?: 'root' | 'sub_items_all' | 'sub_items_any'
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export interface ValidationContext {
  rootValues: Record<string, unknown>
  subItemsValues?: Array<Record<string, unknown>>
}

/**
 * Evaluate a single condition against a value.
 * Reuses comparison logic patterns from formula-engine but inlined.
 */
function evalCondition(operator: PreCondition['operator'], rawValue: unknown, targetValue: unknown): boolean {
  try {
    switch (operator) {
      case 'empty':
        return (
          rawValue === null ||
          rawValue === undefined ||
          rawValue === '' ||
          (Array.isArray(rawValue) && rawValue.length === 0)
        )

      case 'not_empty':
        return (
          rawValue !== null &&
          rawValue !== undefined &&
          rawValue !== '' &&
          !(Array.isArray(rawValue) && rawValue.length === 0)
        )

      case 'contains': {
        const needle = String(targetValue ?? '').toLowerCase()
        if (Array.isArray(rawValue)) {
          return rawValue.some((v) => String(v).toLowerCase().includes(needle))
        }
        return String(rawValue ?? '').toLowerCase().includes(needle)
      }

      case 'not_contains': {
        const needle = String(targetValue ?? '').toLowerCase()
        if (Array.isArray(rawValue)) {
          return !rawValue.some((v) => String(v).toLowerCase().includes(needle))
        }
        return !String(rawValue ?? '').toLowerCase().includes(needle)
      }

      case '=':
      case '!=':
      case '<':
      case '>':
        return compareValues(operator, rawValue, targetValue)

      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * Helper: Compare two values using >, <, =, !=.
 * Tries numeric comparison first; falls back to string comparison.
 */
function compareValues(operator: '>' | '<' | '=' | '!=', rawValue: unknown, targetValue: unknown): boolean {
  // null/undefined: only equality checks make sense
  if (rawValue === null || rawValue === undefined) {
    const targetIsNull = targetValue === null || targetValue === undefined
    if (operator === '=') return targetIsNull
    if (operator === '!=') return !targetIsNull
    return false
  }

  // Try numeric comparison
  const numValue = toNumber(rawValue)
  const numTarget = toNumber(targetValue)

  if (numValue !== null && numTarget !== null) {
    switch (operator) {
      case '=':
        return numValue === numTarget
      case '!=':
        return numValue !== numTarget
      case '<':
        return numValue < numTarget
      case '>':
        return numValue > numTarget
      default:
        return false
    }
  }

  // String comparison fallback
  const strValue = String(rawValue)
  const strTarget = String(targetValue)

  switch (operator) {
    case '=':
      return strValue === strTarget
    case '!=':
      return strValue !== strTarget
    case '<':
      return strValue < strTarget
    case '>':
      return strValue > strTarget
    default:
      return false
  }
}

/**
 * Safely convert value to number or null.
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return isNaN(value) ? null : value

  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? null : parsed
}

/**
 * Validate pre-conditions against given context.
 * Supports scope: root (default), sub_items_all (all must pass), sub_items_any (at least one must pass).
 */
export function validatePreConditions(
  conditions: PreCondition[],
  context: ValidationContext
): ValidationResult {
  const errors: string[] = []

  for (const condition of conditions) {
    const scope = condition.scope ?? 'root'

    try {
      if (scope === 'root') {
        const rawValue = context.rootValues[condition.col_key]
        const conditionPasses = evalCondition(condition.operator, rawValue, condition.value)

        if (!conditionPasses) {
          errors.push(condition.error_msg)
        }
      } else if (scope === 'sub_items_all') {
        // All sub-items must pass the condition
        if (!context.subItemsValues || context.subItemsValues.length === 0) {
          errors.push(condition.error_msg)
          continue
        }

        const allPass = context.subItemsValues.every((subItem) => {
          const rawValue = subItem[condition.col_key]
          return evalCondition(condition.operator, rawValue, condition.value)
        })

        if (!allPass) {
          errors.push(condition.error_msg)
        }
      } else if (scope === 'sub_items_any') {
        // At least one sub-item must pass the condition
        if (!context.subItemsValues || context.subItemsValues.length === 0) {
          errors.push(condition.error_msg)
          continue
        }

        const anyPass = context.subItemsValues.some((subItem) => {
          const rawValue = subItem[condition.col_key]
          return evalCondition(condition.operator, rawValue, condition.value)
        })

        if (!anyPass) {
          errors.push(condition.error_msg)
        }
      }
    } catch {
      // Defensive: treat unexpected errors as condition failure
      errors.push(condition.error_msg)
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

/**
 * Extract unique col_keys used in pre-conditions.
 * Useful for UI display of which columns a template validates.
 */
export function extractUsedColKeys(conditions: PreCondition[]): string[] {
  const keys = new Set<string>()

  for (const condition of conditions) {
    keys.add(condition.col_key)
  }

  return Array.from(keys)
}
