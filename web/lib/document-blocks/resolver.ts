import type { RenderContext, ResolvedValue } from './types'

// ─── Formatter type ─────────────────────────────────────────────────────────────

export type Formatter = 'date' | 'datetime' | 'money' | 'number' | 'percent' | 'relative' | 'upper' | 'lower'

// ─── Format value ───────────────────────────────────────────────────────────────

export function formatValue(value: unknown, formatter: Formatter | undefined): string {
  if (value === null || value === undefined) return ''

  switch (formatter) {
    case 'date': {
      const date = toDate(value)
      return date ? formatDateString(date, false) : ''
    }
    case 'datetime': {
      const date = toDate(value)
      return date ? formatDateString(date, true) : ''
    }
    case 'money':
      return formatMoney(toNumber(value))
    case 'number':
      return formatNumber(toNumber(value))
    case 'percent':
      return formatPercent(toNumber(value))
    case 'relative':
      return formatRelative(toDate(value))
    case 'upper':
      return String(value).toUpperCase()
    case 'lower':
      return String(value).toLowerCase()
    default:
      return String(value)
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  try {
    const date = new Date(value as string | number)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return isNaN(value) ? null : value
  }
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? null : parsed
}

function formatDateString(date: Date, includeTime: boolean): string {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()

  const monthNames = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
  ]
  const monthStr = monthNames[month]

  if (includeTime) {
    const hourStr = hour.toString().padStart(2, '0')
    const minStr = minute.toString().padStart(2, '0')
    return `${day} ${monthStr} ${year}, ${hourStr}:${minStr}`
  }
  return `${day} ${monthStr} ${year}`
}

function formatMoney(value: number | null): string {
  if (value === null) return ''
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatNumber(value: number | null): string {
  if (value === null) return ''
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatPercent(value: number | null): string {
  if (value === null) return ''
  const percent = value > 1 ? value : value * 100
  return `${Math.round(percent)}%`
}

function formatRelative(date: Date | null): string {
  if (!date) return ''

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) return `hace ${diffDay} día${diffDay > 1 ? 's' : ''}`
  if (diffHour > 0) return `hace ${diffHour} hora${diffHour > 1 ? 's' : ''}`
  if (diffMin > 0) return `hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`
  if (diffSec > 30) return 'hace menos de un minuto'
  return 'ahora'
}

// ─── Resolve field ──────────────────────────────────────────────────────────────

export function resolveField(context: RenderContext, expr: string): string {
  const [path, formatter] = expr.split('|').map(s => s.trim())

  let value: ResolvedValue = null

  // Split path by dots
  const segments = path.split('.')

  if (segments.length > 1) {
    const root = segments[0]
    const rest = segments.slice(1)

    // Escape parent scope
    if (root === 'parent') {
      const key = rest[0]
      value = context.rootItem.values[key] ?? null
    }
    // Workspace
    else if (root === 'workspace') {
      const key = rest[0]
      if (key === 'name') value = context.workspace.name
      else if (key === 'logo_url') value = context.workspace.logo_url ?? null
    }
    // Document meta
    else if (['folio', 'generated_by_name', 'created_at'].includes(root)) {
      const meta = context.document
      if (meta) {
        if (root === 'folio') value = meta.folio ?? null
        else if (root === 'generated_by_name') value = meta.generated_by_name ?? null
        else if (root === 'created_at') value = meta.created_at ?? null
      }
    }
  } else {
    // Single segment
    if (path === 'folio' || path === 'generated_by_name' || path === 'created_at') {
      const meta = context.document
      if (meta) {
        if (path === 'folio') value = meta.folio ?? null
        else if (path === 'generated_by_name') value = meta.generated_by_name ?? null
        else if (path === 'created_at') value = meta.created_at ?? null
      }
    } else if (context.current) {
      // In repeat scope
      value = context.current.item.values[path] ?? null
    } else {
      // Root item
      value = context.rootItem.values[path] ?? null
    }
  }

  return formatValue(value, formatter as Formatter | undefined)
}

// ─── Resolve template ───────────────────────────────────────────────────────────

export function resolveTemplate(context: RenderContext, text: string): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    return resolveField(context, expr)
  })
}

// ─── With repeat scope ──────────────────────────────────────────────────────────

export function withRepeatScope(
  context: RenderContext,
  scope: 'sub_item' | 'relation',
  item: { id: string; name: string; values: Record<string, ResolvedValue> }
): RenderContext {
  return {
    ...context,
    current: {
      scope,
      item
    }
  }
}
