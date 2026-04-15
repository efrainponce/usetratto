'use client'

import type { CellProps } from '../types'
import { TextCell }        from './TextCell'
import { NumberCell }      from './NumberCell'
import { DateCell }        from './DateCell'
import { SelectCell }      from './SelectCell'
import { MultiSelectCell } from './MultiSelectCell'
import { PeopleCell }      from './PeopleCell'
import { BooleanCell }     from './BooleanCell'
import { RelationCell }    from './RelationCell'
import { PhoneCell }       from './PhoneCell'
import { EmailCell }       from './EmailCell'
import { AutonumberCell }  from './AutonumberCell'
import { FileCell }        from './FileCell'
import { ButtonCell }      from './ButtonCell'
import { SignatureCell }   from './SignatureCell'
import { FormulaCell }     from './FormulaCell'
import { RollupCell }      from './RollupCell'
import { evaluateCondition, type FormulaCondition } from '@/lib/formula-engine'

// Fase 16: canEdit prop support for permission model
export function ColumnCell(props: CellProps & { canEdit?: boolean }) {
  const { canEdit = true, ...cellProps } = props
  const validation = cellProps.column.settings?.validation
  const isInvalid = (() => {
    // Required field check: if settings.required is true, the value must be non-empty
    if (cellProps.column.settings?.required === true) {
      const v = cellProps.value
      const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
      if (isEmpty) return true
    }

    if (!validation?.condition) return false
    // When condition.col is empty, default to this column's own key
    const condition: FormulaCondition = {
      ...validation.condition as FormulaCondition,
      col: (validation.condition.col as string) || cellProps.column.key,
    }
    const evalRow = cellProps.row ?? { [cellProps.column.key]: cellProps.value }
    try {
      return !evaluateCondition(condition, evalRow as Record<string, unknown>)
    } catch {
      return false
    }
  })()

  // Check if column is read-only (system columns with read_only or relative display)
  const settingsAny = cellProps.column.settings as any
  const isSystemReadOnly = settingsAny?.read_only === true || settingsAny?.display === 'read_only' || settingsAny?.display === 'relative'

  // Disable edit if canEdit is false or if column is system read-only
  const safeOnStartEdit = (canEdit && !isSystemReadOnly) ? cellProps.onStartEdit : () => {}

  const cell = (() => {
    const cellPropsAdjusted = { ...cellProps, onStartEdit: safeOnStartEdit }
    switch (cellProps.column.kind) {
      case 'text':        return <TextCell        {...cellPropsAdjusted} />
      case 'number':      return <NumberCell      {...cellPropsAdjusted} />
      case 'date':        return <DateCell        {...cellPropsAdjusted} settings={cellProps.column.settings as any} />
      case 'select':      return <SelectCell      {...cellPropsAdjusted} />
      case 'multiselect': return <MultiSelectCell {...cellPropsAdjusted} />
      case 'people':      return <PeopleCell      {...cellPropsAdjusted} settings={cellProps.column.settings as any} />
      case 'boolean':     return <BooleanCell     {...cellPropsAdjusted} />
      case 'relation':    return <RelationCell    {...cellPropsAdjusted} />
      case 'phone':       return <PhoneCell       {...cellPropsAdjusted} />
      case 'email':       return <EmailCell       {...cellPropsAdjusted} />
      case 'autonumber':  return <AutonumberCell  {...cellPropsAdjusted} />
      case 'file':        return <FileCell        {...cellPropsAdjusted} />
      case 'button':      return <ButtonCell      {...cellPropsAdjusted} />
      case 'signature':   return <SignatureCell   {...cellPropsAdjusted} />
      case 'formula':     return <FormulaCell     {...cellPropsAdjusted} />
      case 'rollup':      return <RollupCell      {...cellPropsAdjusted} />
      case 'reflejo': {
        // Ref col: dispatch based on mirrored field's kind, always read-only
        const refFieldKind = (cellProps.column.settings as any)?.ref_field_kind as string | undefined
        const readOnlyProps = { ...cellProps, onStartEdit: () => {}, onCommit: () => {} }
        switch (refFieldKind) {
          case 'text':        return <TextCell        {...readOnlyProps} />
          case 'number':      return <NumberCell      {...readOnlyProps} />
          case 'date':        return <DateCell        {...readOnlyProps} settings={cellProps.column.settings as any} />
          case 'select':      return <SelectCell      {...readOnlyProps} />
          case 'people':      return <PeopleCell      {...readOnlyProps} settings={cellProps.column.settings as any} />
          case 'phone':       return <PhoneCell       {...readOnlyProps} />
          case 'email':       return <EmailCell       {...readOnlyProps} />
          case 'boolean':     return <BooleanCell     {...readOnlyProps} />
          case 'relation':    return <RelationCell    {...readOnlyProps} />  // RelationCell already detects ref and renders read-only
          default:            return (
            <span className="block w-full px-2 py-1 text-[13px] text-gray-700 truncate">
              {cellProps.value != null ? String(cellProps.value) : '—'}
            </span>
          )
        }
      }
      default:            return (
        <span className="block w-full px-2 py-1 text-[13px] text-gray-400 truncate">
          {cellProps.value != null ? String(cellProps.value) : '—'}
        </span>
      )
    }
  })()

  if (!isInvalid) return cell

  const tooltipMessage = (() => {
    if (cellProps.column.settings?.required === true) {
      const v = cellProps.value
      const isEmpty = v == null || v === '' || (Array.isArray(v) && v.length === 0)
      if (isEmpty) return 'Campo requerido'
    }
    return validation?.message ?? 'Valor inválido'
  })()

  return (
    <div className="relative w-full h-full" title={tooltipMessage}>
      {cell}
      <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-inset ring-red-400/70 bg-red-50/30" />
      <span className="pointer-events-none absolute top-0.5 right-0.5 text-[10px] leading-none select-none">❌</span>
    </div>
  )
}
