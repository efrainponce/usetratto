'use client'

import { useState, useEffect } from 'react'
import { type FormulaCondition } from '@/lib/formula-engine'
import { PRESET_COLORS, KIND_OPTIONS, NUMBER_FORMATS } from './column-settings/constants'
import { PermissionsTab } from './column-settings/PermissionsTab'

// ─── Local types (compatible with BoardColumn + WorkspaceUser) ────────────────

export type PanelColumn = {
  id: string
  col_key: string
  name: string
  kind: string
  position: number
  is_system: boolean
  is_hidden: boolean
  required: boolean
  settings: Record<string, unknown> & { default_access?: 'edit' | 'view' | 'restricted' }
  permission_mode?: 'public' | 'inherit' | 'custom'
  source_col_key?: string | null
}

export type PanelUser = {
  id: string
  name: string | null
  phone?: string | null
}

type SelectOption = {
  value: string
  label: string
  color?: string
  is_closed?: boolean
}

type RemoteBoard = { id: string; name: string }
type RemoteStage = { id: string; name: string; position: number }

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  column: PanelColumn
  boardId: string
  allColumns: { col_key: string; name: string; kind: string; settings?: Record<string, unknown> }[]
  users: PanelUser[]
  onClose: () => void
  onUpdated: (col: PanelColumn) => void
  /** Called after options are saved — does NOT close the panel (use for add/remove option). */
  onPatched?: (col: PanelColumn) => void
  /** Override the default PATCH URL (e.g. for sub-item columns). Hides the Permisos tab. */
  patchEndpoint?: string
  /** Endpoint for loading and managing permissions. If provided, shows the Permisos tab. */
  permissionsEndpoint?: string
  /** Called after the column is deleted. */
  onDeleted?: (colId: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ColumnSettingsPanel({ column, boardId, allColumns, users, onClose, onUpdated, onPatched, patchEndpoint, permissionsEndpoint, onDeleted }: Props) {
  // ── General state ──────────────────────────────────────────────────────────
  const [name, setName] = useState(column.name)
  const [kind, setKind] = useState(column.kind)
  const [savingGeneral, setSavingGeneral] = useState(false)

  // ── Options state (select/multiselect) ────────────────────────────────────
  const [options, setOptions] = useState<SelectOption[]>(
    (column.settings?.options as SelectOption[] | undefined) ?? []
  )
  const [newOptLabel, setNewOptLabel]   = useState('')
  const [newOptColor, setNewOptColor]   = useState(PRESET_COLORS[0])
  const [savingOpts,  setSavingOpts]    = useState(false)

  // ── Number format state ───────────────────────────────────────────────────
  const [format,       setFormat]       = useState<string>(
    (column.settings?.format as string) ?? 'decimal'
  )
  const [savingFormat, setSavingFormat] = useState(false)

  // ── Autonumber (folio) state ──────────────────────────────────────────────
  const [autoPrefix,       setAutoPrefix]       = useState<string>(
    (column.settings?.prefix as string) ?? ''
  )
  const [autoPad,          setAutoPad]          = useState<number>(
    typeof column.settings?.pad === 'number' ? (column.settings.pad as number) : 3
  )
  const [savingAutonumber, setSavingAutonumber] = useState(false)

  // ── Relation state ────────────────────────────────────────────────────────
  const [boards,          setBoards]          = useState<RemoteBoard[]>([])
  const [targetBoardId,   setTargetBoardId]   = useState<string>(
    (column.settings?.target_board_id as string) ?? ''
  )
  const [savingRelation, setSavingRelation] = useState(false)

  // ── Button config state ───────────────────────────────────────────────────
  const isButton    = kind === 'button'
  const isStageCol  = column.settings?.role === 'primary_stage' || (column.col_key === 'stage' && !column.settings?.role)
  const [stages,          setStages]          = useState<RemoteStage[]>([])
  const [btnLabel,        setBtnLabel]        = useState<string>(
    (column.settings?.label as string) ?? ''
  )
  const [btnAction,       setBtnAction]       = useState<string>(
    (column.settings?.action as string) ?? 'change_stage'
  )
  const [targetStageId,   setTargetStageId]   = useState<string>(
    (column.settings?.target_stage_id as string) ?? ''
  )
  const [btnConfirm,      setBtnConfirm]      = useState<boolean>(
    !!(column.settings?.confirm as boolean)
  )
  const [btnConfirmMsg,   setBtnConfirmMsg]   = useState<string>(
    (column.settings?.confirm_message as string) ?? ''
  )
  // Stage gates: per-stage checklist of col_keys (lives on stage column settings)
  const [stageGates,      setStageGates]      = useState<Record<string, string[]>>(
    (column.settings?.stage_gates as Record<string, string[]> | undefined) ?? {}
  )
const [savingButton,    setSavingButton]    = useState(false)

  // ── Delete state ─────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  // ── Signature description state ───────────────────────────────────────────
  const [sigDescription,      setSigDescription]      = useState<string>(
    (column.settings?.description as string) ?? ''
  )
  const [savingSignatureDesc, setSavingSignatureDesc] = useState(false)

  // ── Formula config state ──────────────────────────────────────────────────
  type FormulaType = 'arithmetic' | 'if' | 'concat' | 'date_diff' | 'count_if'
  type ArithOp = 'add' | 'subtract' | 'multiply' | 'divide' | 'percent'

  const [formulaType,   setFormulaType]   = useState<FormulaType>(
    ((column.settings?.formula_config as {type?:string}|undefined)?.type as FormulaType) ?? 'arithmetic'
  )
  const [arithColA,     setArithColA]     = useState<string>(
    ((column.settings?.formula_config as {col_a?:string}|undefined)?.col_a) ?? ''
  )
  const [arithOp,       setArithOp]       = useState<ArithOp>(
    ((column.settings?.formula_config as {op?:string}|undefined)?.op as ArithOp) ?? 'multiply'
  )
  const [arithColB,     setArithColB]     = useState<string>(
    ((column.settings?.formula_config as {col_b?:string}|undefined)?.col_b) ?? ''
  )
  const [savingFormula, setSavingFormula] = useState(false)
  // Derive picker columns from prop (exclude self)
  const boardCols = allColumns.filter(c => c.col_key !== column.col_key)

  // ── Rollup config state ────────────────────────────────────────────────
  type SubItemCol = { id: string; col_key: string; name: string; kind: string }
  const existingRollup = column.settings?.rollup_config as {
    source_level?: string; source_col_key?: string; aggregate?: string
  } | undefined

  const [rollupSourceLevel,  setRollupSourceLevel]  = useState<'children' | 'descendants'>(
    (existingRollup?.source_level as 'children' | 'descendants') ?? 'children'
  )
  const [rollupSourceColKey, setRollupSourceColKey] = useState<string>(
    existingRollup?.source_col_key ?? ''
  )
  const [rollupAggregate,    setRollupAggregate]    = useState<string>(
    existingRollup?.aggregate ?? 'sum'
  )
  const [subItemCols,        setSubItemCols]        = useState<SubItemCol[]>([])
  const [savingRollup,       setSavingRollup]       = useState(false)

  // ── IF formula state ──────────────────────────────────────────────────────
  type CondOp = FormulaCondition['operator']
  const existingIf = (column.settings?.formula_config as { type?: string; condition?: { col?: string; operator?: string; value?: unknown }; col_true?: unknown; col_false?: unknown; col_true_is_literal?: boolean; col_false_is_literal?: boolean } | undefined)
  const isExistingIf = existingIf?.type === 'if'

  const [ifCondCol,    setIfCondCol]    = useState<string>(isExistingIf ? (existingIf?.condition?.col ?? '') : '')
  const [ifCondOp,     setIfCondOp]     = useState<CondOp>(isExistingIf ? ((existingIf?.condition?.operator ?? '=') as CondOp) : '=')
  const [ifCondValue,  setIfCondValue]  = useState<string>(isExistingIf ? String(existingIf?.condition?.value ?? '') : '')
  const [ifTrueType,   setIfTrueType]   = useState<'col' | 'literal'>(isExistingIf && existingIf?.col_true_is_literal ? 'literal' : 'col')
  const [ifTrueVal,    setIfTrueVal]    = useState<string>(isExistingIf ? String(existingIf?.col_true ?? '') : '')
  const [ifFalseType,  setIfFalseType]  = useState<'col' | 'literal'>(isExistingIf && existingIf?.col_false_is_literal ? 'literal' : 'col')
  const [ifFalseVal,   setIfFalseVal]   = useState<string>(isExistingIf ? String(existingIf?.col_false ?? '') : '')

  // ── Validation state ──────────────────────────────────────────────────────
  const existingVal = column.settings?.validation as { condition?: { col?: string; operator?: string; value?: unknown }; message?: string } | undefined

  const [validationEnabled,  setValidationEnabled]  = useState<boolean>(!!existingVal)
  const [validationCol,      setValidationCol]       = useState<string>(existingVal?.condition?.col ?? '')
  const [validationOp,       setValidationOp]        = useState<CondOp>((existingVal?.condition?.operator ?? '=') as CondOp)
  const [validationValue,    setValidationValue]     = useState<string>(String(existingVal?.condition?.value ?? ''))
  const [validationMessage,  setValidationMessage]   = useState<string>(existingVal?.message ?? '')
  const [savingValidation,   setSavingValidation]    = useState(false)

  // ── Default value state ───────────────────────────────────────────────────
  const [defaultValue,   setDefaultValue]   = useState<string>(
    column.settings?.default_value !== undefined && column.settings?.default_value !== null
      ? String(column.settings.default_value)
      : ''
  )
  const [savingDefault,  setSavingDefault]  = useState(false)

  // ── System role state (Fase 16.5.B) ────────────────────────────────────────
  const [roleError,      setRoleError]      = useState<string>('')
  const [role,           setRole]           = useState<string>(
    (column.settings?.role as string) ?? ''
  )
  const [savingRole,     setSavingRole]     = useState(false)

  // ── Ref/Mirror column state (Fase 16.6.7) ─────────────────────────────────
  const [refTargetCols, setRefTargetCols] = useState<Array<{ id: string; col_key: string; name: string; kind: string }>>([])
  const [refSourceCol, setRefSourceCol] = useState<string>(
    (column.settings as any)?.ref_source_col_key ?? ''
  )
  const [refFieldCol, setRefFieldCol] = useState<string>(
    (column.settings as any)?.ref_field_col_key ?? ''
  )
  const [refError, setRefError] = useState<string | null>(null)
  const [refSaving, setRefSaving] = useState(false)

  // ── Active tab ────────────────────────────────────────────────────────────
  const isSelect    = kind === 'select' || kind === 'multiselect'
  const isNumber    = kind === 'number'
  const isRelation  = kind === 'relation'
  const isSignature = kind === 'signature'
  const isFormula   = kind === 'formula'
  const isRollup    = kind === 'rollup'
  const hasDefault  = !['formula', 'rollup', 'signature', 'file', 'image', 'button', 'autonumber'].includes(kind)
  const canBeRef    = !['formula', 'rollup', 'button', 'signature', 'file', 'image', 'autonumber'].includes(kind)

  type TabId = 'general' | 'opciones' | 'formula' | 'rollup' | 'validacion' | 'reflejo' | 'permisos'
  const [tab, setTab] = useState<TabId>('general')

  // ── Detect sub-item column type ────────────────────────────────────────────
  const isSubItemColumn = patchEndpoint?.includes('/sub-item-columns/') ?? false

  // ── Load boards for relation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isRelation) return
    fetch('/api/boards')
      .then(r => (r.ok ? r.json() : []))
      .then((data: RemoteBoard[]) => setBoards(data))
  }, [isRelation])

  // ── Load stages for button + stage column ────────────────────────────────
  useEffect(() => {
    if (!isButton && !isStageCol) return
    fetch(`/api/boards/${boardId}/stages`)
      .then(r => r.ok ? r.json() : [])
      .then((data: RemoteStage[]) => setStages(Array.isArray(data) ? data.sort((a, b) => a.position - b.position) : []))
  }, [isButton, isStageCol, boardId])

  // ── Load sub-item columns for rollup ─────────────────────────────────────
  useEffect(() => {
    if (!isRollup) return
    fetch(`/api/boards/${boardId}/sub-item-columns`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SubItemCol[]) => setSubItemCols(data.filter(c => c.kind === 'number' || c.kind === 'formula')))
  }, [isRollup, boardId])

  // ── Load target columns for ref/mirror ──────────────────────────────────
  useEffect(() => {
    if (!canBeRef || !refSourceCol) {
      setRefTargetCols([])
      return
    }
    const relationCols = (allColumns ?? []).filter(c => c.kind === 'relation')
    const relCol = relationCols.find(c => c.col_key === refSourceCol)
    const targetBoardId = (relCol?.settings as any)?.target_board_id
    if (!targetBoardId) {
      setRefTargetCols([])
      return
    }
    fetch(`/api/boards/${targetBoardId}/columns`)
      .then(r => (r.ok ? r.json() : []))
      .then((cols: Array<{ id: string; col_key: string; name: string; kind: string }>) => {
        const allowed = cols.filter(
          c => !['formula', 'rollup', 'button', 'signature', 'file', 'image', 'autonumber'].includes(c.kind)
        )
        setRefTargetCols(allowed)
      })
      .catch(() => setRefTargetCols([]))
  }, [refSourceCol, canBeRef, allColumns])

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function patchColumn(patch: Record<string, unknown>): Promise<PanelColumn | null> {
    const res = await fetch(patchEndpoint ?? `/api/boards/${boardId}/columns/${column.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return null
    return res.json() as Promise<PanelColumn>
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveGeneral() {
    if (!name.trim()) return
    setSavingGeneral(true)
    try {
      const patch: Record<string, unknown> = { name: name.trim() }
      if (kind !== column.kind) patch.kind = kind
      const updated = await patchColumn(patch)
      if (updated) onUpdated(updated)
    } finally {
      setSavingGeneral(false)
    }
  }

  async function persistOptions(newOptions: SelectOption[]) {
    setSavingOpts(true)
    try {
      const updated = await patchColumn({
        settings: { ...column.settings, options: newOptions },
      })
      if (updated) (onPatched ?? onUpdated)(updated)
    } finally {
      setSavingOpts(false)
    }
  }

  function handleAddOption() {
    if (!newOptLabel.trim()) return
    const opt: SelectOption = {
      value: newOptLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      label: newOptLabel.trim(),
      color: newOptColor,
    }
    // Ensure unique value
    const base = opt.value || 'option'
    const taken = options.map(o => o.value)
    let finalValue = base
    let suffix = 2
    while (taken.includes(finalValue)) {
      finalValue = `${base}_${suffix++}`
    }
    opt.value = finalValue
    const newOpts = [...options, opt]
    setOptions(newOpts)
    setNewOptLabel('')
    persistOptions(newOpts)
  }

  function handleRemoveOption(value: string) {
    const newOpts = options.filter(o => o.value !== value)
    setOptions(newOpts)
    persistOptions(newOpts)
  }

  function handleToggleClosed(value: string) {
    const newOpts = options.map(o =>
      o.value === value ? { ...o, is_closed: !o.is_closed } : o
    )
    setOptions(newOpts)
    persistOptions(newOpts)
  }

  async function handleSaveFormat() {
    setSavingFormat(true)
    try {
      const updated = await patchColumn({
        settings: { ...column.settings, format },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingFormat(false)
    }
  }

  async function handleSaveAutonumber() {
    setSavingAutonumber(true)
    try {
      const updated = await patchColumn({
        settings: {
          ...column.settings,
          prefix: autoPrefix.trim().toUpperCase().slice(0, 8) || null,
          pad:    Math.max(0, Math.min(8, Math.floor(autoPad || 0))),
        },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingAutonumber(false)
    }
  }

  async function handleSaveRelation() {
    if (!targetBoardId) return
    setSavingRelation(true)
    try {
      const updated = await patchColumn({
        settings: { ...column.settings, target_board_id: targetBoardId },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingRelation(false)
    }
  }

  async function handleSaveButtonConfig() {
    setSavingButton(true)
    try {
      const updated = await patchColumn({
        settings: {
          ...column.settings,
          label:          btnLabel.trim() || null,
          action:         btnAction || null,
          target_stage_id: btnAction === 'change_stage' ? (targetStageId || null) : null,
          confirm:        btnConfirm,
          confirm_message: btnConfirm ? (btnConfirmMsg.trim() || null) : null,
        },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingButton(false)
    }
  }

  async function handleSaveStageGates() {
    setSavingButton(true)
    try {
      const updated = await patchColumn({
        settings: { ...column.settings, stage_gates: stageGates },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingButton(false)
    }
  }

  async function handleSaveSignatureDesc() {
    setSavingSignatureDesc(true)
    try {
      const updated = await patchColumn({
        settings: { ...column.settings, description: sigDescription.trim() },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingSignatureDesc(false)
    }
  }

  async function handleSaveFormula() {
    setSavingFormula(true)
    try {
      let formula_config: Record<string, unknown> | null = null
      if (formulaType === 'arithmetic') {
        if (!arithColA || !arithColB) return
        formula_config = { type: 'arithmetic', op: arithOp, col_a: arithColA, col_b: arithColB }
      } else if (formulaType === 'if') {
        if (!ifCondCol) return
        const trueVal: string | number = ifTrueType === 'literal'
          ? (isNaN(parseFloat(ifTrueVal)) ? ifTrueVal : parseFloat(ifTrueVal))
          : ifTrueVal
        const falseVal: string | number = ifFalseType === 'literal'
          ? (isNaN(parseFloat(ifFalseVal)) ? ifFalseVal : parseFloat(ifFalseVal))
          : ifFalseVal
        formula_config = {
          type: 'if',
          condition: {
            col: ifCondCol,
            operator: ifCondOp,
            ...(ifCondOp !== 'empty' && ifCondOp !== 'not_empty' ? { value: isNaN(parseFloat(ifCondValue)) ? ifCondValue : parseFloat(ifCondValue) } : {}),
          },
          col_true: trueVal,
          col_false: falseVal,
          col_true_is_literal: ifTrueType === 'literal',
          col_false_is_literal: ifFalseType === 'literal',
        }
      }
      if (!formula_config) return
      const updated = await patchColumn({ settings: { ...column.settings, formula_config } })
      if (updated) onUpdated(updated)
    } finally {
      setSavingFormula(false)
    }
  }

  async function handleSaveValidation() {
    setSavingValidation(true)
    try {
      const validation = validationEnabled
        ? {
            condition: {
              col: validationCol || column.col_key,
              operator: validationOp,
              ...(validationOp !== 'empty' && validationOp !== 'not_empty' ? { value: isNaN(parseFloat(validationValue)) ? validationValue : parseFloat(validationValue) } : {}),
            },
            message: validationMessage.trim() || 'Valor inválido',
          }
        : null
      const newSettings = { ...column.settings }
      if (validation) newSettings.validation = validation
      else delete newSettings.validation
      const updated = await patchColumn({ settings: newSettings })
      if (updated) onUpdated(updated)
    } finally {
      setSavingValidation(false)
    }
  }

  async function handleSaveDefault() {
    setSavingDefault(true)
    try {
      let value: unknown = defaultValue
      if (kind === 'number' || kind === 'formula' || kind === 'rollup') {
        value = defaultValue === '' ? null : parseFloat(defaultValue)
      } else if (kind === 'boolean') {
        value = defaultValue === 'true'
      } else if (defaultValue === '') {
        value = null
      }
      const updated = await patchColumn({ settings: { ...column.settings, default_value: value } })
      if (updated) onUpdated(updated)
    } finally {
      setSavingDefault(false)
    }
  }

  async function handleSaveRole() {
    setSavingRole(true)
    setRoleError('')
    try {
      const newRole = role || undefined
      const res = await fetch(patchEndpoint ?? `/api/boards/${boardId}/columns/${column.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { ...column.settings, role: newRole },
        }),
      })
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        setRoleError(body.error ?? 'Ya existe otra columna con este rol')
        return
      }
      if (!res.ok) {
        setRoleError('Error al guardar el rol')
        return
      }
      const updated = await res.json() as PanelColumn
      onUpdated(updated)
    } finally {
      setSavingRole(false)
    }
  }

  async function handleSaveRollup() {
    if (!rollupSourceColKey) return
    setSavingRollup(true)
    try {
      const rollup_config = {
        source_level: rollupSourceLevel,
        source_col_key: rollupSourceColKey,
        aggregate: rollupAggregate,
      }
      const updated = await patchColumn({
        settings: { ...column.settings, rollup_config },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingRollup(false)
    }
  }

  async function handleSaveRef() {
    if (!refSourceCol || !refFieldCol) return
    setRefSaving(true)
    setRefError(null)
    try {
      const targetKind = refTargetCols.find(c => c.col_key === refFieldCol)?.kind ?? 'text'
      const originalKind = column.kind === 'reflejo' ? (column.settings as any)?.original_kind : column.kind
      const nextSettings = {
        ...column.settings,
        ref_source_col_key: refSourceCol,
        ref_field_col_key: refFieldCol,
        ref_field_kind: targetKind,
        original_kind: originalKind,
      }
      const updated = await patchColumn({ settings: nextSettings, kind: 'reflejo' })
      if (updated) {
        onUpdated(updated)
        onClose()
      }
    } catch (err) {
      setRefError('Error al guardar')
    } finally {
      setRefSaving(false)
    }
  }

  async function handleClearRef() {
    setRefSaving(true)
    setRefError(null)
    try {
      const { ref_source_col_key, ref_field_col_key, ref_field_kind, original_kind, ...rest } =
        (column.settings as any) ?? {}
      const revertedKind = original_kind ?? 'text'
      const updated = await patchColumn({ settings: rest, kind: revertedKind })
      if (updated) {
        onUpdated(updated)
        onClose()
      }
    } catch (err) {
      setRefError('Error al limpiar')
    } finally {
      setRefSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true)
    try {
      const url = patchEndpoint ?? `/api/boards/${boardId}/columns/${column.id}`
      const res = await fetch(url, { method: 'DELETE' })
      if (res.ok) {
        onDeleted?.(column.id)
        onClose()
      }
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general',    label: 'General' },
    ...(isSelect  ? [{ id: 'opciones'   as TabId, label: 'Opciones'  }] : []),
    ...(isFormula ? [{ id: 'formula'    as TabId, label: 'Fórmula'   }] : []),
    ...(isRollup  ? [{ id: 'rollup'     as TabId, label: 'Rollup'    }] : []),
    ...(canBeRef  ? [{ id: 'reflejo'    as TabId, label: 'Reflejo'   }] : []),
    { id: 'validacion', label: 'Validación' },
    ...(permissionsEndpoint ? [{ id: 'permisos' as TabId, label: 'Permisos' }] : []),
  ]

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[40rem] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{column.name}</p>
            <p className="text-[11px] text-gray-400 font-mono">{column.col_key}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 text-gray-400 hover:text-gray-700 w-6 h-6 flex items-center justify-center text-lg leading-none"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'py-2.5 mr-4 text-xs font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* ── General ─────────────────────────────────────────────────── */}
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={column.is_system}
                  onKeyDown={e => { if (e.key === 'Enter' && !column.is_system) handleSaveGeneral() }}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                {column.is_system ? (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                    <span className="text-sm text-gray-600">
                      {KIND_OPTIONS.find(k => k.value === kind)?.label ?? kind}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-auto">sistema</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={kind}
                      onChange={e => setKind(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      {KIND_OPTIONS.map(k => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                    {kind !== column.kind && (
                      <p className="mt-1.5 text-[11px] text-amber-600">
                        Cambiar el tipo puede dejar valores existentes incompatibles.
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* System role dropdown (Fase 16.5.B) */}
              {(column.kind === 'people' || column.kind === 'select' || column.kind === 'date') && !column.is_system && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rol del sistema</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value)
                      setRoleError('')
                    }}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    <option value="">Ninguno</option>
                    {column.kind === 'people' && <option value="owner">Owner (dueño del item)</option>}
                    {column.kind === 'select' && <option value="primary_stage">Etapa primaria</option>}
                    {column.kind === 'date' && <option value="end_date">Fecha límite (end_date)</option>}
                  </select>
                  {roleError && (
                    <p className="text-xs text-red-500 mt-1">{roleError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {column.kind === 'people' && 'El owner se usa para restrict_to_own, stage gates y permisos.'}
                    {column.kind === 'select' && 'La etapa primaria se usa para gates, rollups y cierre.'}
                    {column.kind === 'date' && 'La fecha límite (end_date) se usa para filtros "vencidos" y recordatorios.'}
                  </p>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleSaveRole}
                      disabled={savingRole}
                      className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingRole ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Number format — inline in General */}
              {isNumber && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Formato</label>
                  <div className="flex gap-2">
                    <select
                      value={format}
                      onChange={e => setFormat(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      {NUMBER_FORMATS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveFormat}
                      disabled={savingFormat}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingFormat ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Autonumber prefix + pad — inline in General (usado para Folio) */}
              {kind === 'autonumber' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prefijo del folio</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={autoPrefix}
                      onChange={e => setAutoPrefix(e.target.value.toUpperCase())}
                      maxLength={8}
                      placeholder="OPP"
                      className="w-24 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                    <span className="text-sm text-gray-400">-</span>
                    <input
                      type="number"
                      value={autoPad}
                      onChange={e => setAutoPad(parseInt(e.target.value, 10) || 0)}
                      min={0}
                      max={8}
                      className="w-16 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                    <span className="text-xs text-gray-500">dígitos</span>
                    <button
                      onClick={handleSaveAutonumber}
                      disabled={savingAutonumber}
                      className="ml-auto px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingAutonumber ? '...' : 'Guardar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Ejemplo: <span className="font-mono">{(autoPrefix || 'ITEM')}-{'1'.padStart(Math.max(0, Math.min(8, autoPad)) || 0, '0')}</span>
                    {' · '}máx 8 caracteres.
                  </p>
                </div>
              )}

              {/* Relation target — inline in General */}
              {isRelation && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Board destino</label>
                  <div className="flex gap-2">
                    <select
                      value={targetBoardId}
                      onChange={e => setTargetBoardId(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">Seleccionar...</option>
                      {boards.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveRelation}
                      disabled={savingRelation || !targetBoardId}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingRelation ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Button config */}
              {isButton && (
                <div className="space-y-3">
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Texto del botón</label>
                    <input
                      type="text"
                      value={btnLabel}
                      onChange={e => setBtnLabel(e.target.value)}
                      placeholder="Ej: Avanzar a Costeo"
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                  </div>

                  {/* Action */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Acción</label>
                    <div className="space-y-1">
                      {[
                        { value: 'change_stage', label: 'Cambiar etapa' },
                        { value: 'create_quote', label: 'Crear cotización (próx.)' },
                        { value: 'run_automation', label: 'Ejecutar automatización (próx.)' },
                      ].map(opt => (
                        <label key={opt.value} className={`flex items-center gap-2 text-sm cursor-pointer ${opt.value !== 'change_stage' ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <input
                            type="radio"
                            name="btn_action"
                            value={opt.value}
                            checked={btnAction === opt.value}
                            disabled={opt.value !== 'change_stage'}
                            onChange={() => setBtnAction(opt.value)}
                            className="text-indigo-600"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Stage picker — only for change_stage */}
                  {btnAction === 'change_stage' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Stage destino</label>
                      <select
                        value={targetStageId}
                        onChange={e => setTargetStageId(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                      >
                        <option value="">Seleccionar...</option>
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Confirm */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={btnConfirm}
                        onChange={e => setBtnConfirm(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600"
                      />
                      Pedir confirmación antes de ejecutar
                    </label>
                    {btnConfirm && (
                      <input
                        type="text"
                        value={btnConfirmMsg}
                        onChange={e => setBtnConfirmMsg(e.target.value)}
                        placeholder="¿Confirmar acción?"
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                      />
                    )}
                  </div>

                  <button
                    onClick={handleSaveButtonConfig}
                    disabled={savingButton}
                    className="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {savingButton ? 'Guardando...' : 'Guardar configuración'}
                  </button>
                </div>
              )}

              {/* Signature description */}
              {isSignature && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Texto en modal de firma</label>
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={sigDescription}
                      onChange={e => setSigDescription(e.target.value)}
                      rows={3}
                      placeholder="Ej: Al firmar confirmas que has revisado y aceptas los términos de esta cotización."
                      className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 resize-none"
                    />
                    <button
                      onClick={handleSaveSignatureDesc}
                      disabled={savingSignatureDesc}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      {savingSignatureDesc ? '...' : 'Guardar'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Aparece en el modal cuando el usuario va a firmar.</p>
                </div>
              )}

              {/* Default value */}
              {hasDefault && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor por defecto</label>
                  {kind === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={defaultValue === 'true'}
                        onChange={e => setDefaultValue(e.target.checked ? 'true' : 'false')}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                      <span className="text-sm text-gray-600">{defaultValue === 'true' ? 'Activado' : 'Desactivado'}</span>
                    </div>
                  ) : kind === 'number' ? (
                    <input type="number" value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                  ) : kind === 'date' ? (
                    <input type="date" value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                  ) : isSelect ? (
                    <select value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                      <option value="">Sin valor por defecto</option>
                      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={defaultValue} onChange={e => setDefaultValue(e.target.value)}
                      placeholder="Valor por defecto..."
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                  )}
                  <div className="flex justify-end mt-1.5">
                    <button onClick={handleSaveDefault} disabled={savingDefault}
                      className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50">
                      {savingDefault ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Save general (name + kind) */}
              {!column.is_system && (
                <button
                  onClick={handleSaveGeneral}
                  disabled={savingGeneral || !name.trim()}
                  className="w-full px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {savingGeneral ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </div>
          )}

          {/* ── Fórmula ─────────────────────────────────────────────────── */}
          {tab === 'formula' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de fórmula</label>
                <select
                  value={formulaType}
                  onChange={e => setFormulaType(e.target.value as FormulaType)}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                >
                  <option value="arithmetic">Aritmética</option>
                  <option value="concat">Concatenar texto</option>
                  <option value="date_diff">Diferencia de fechas</option>
                  <option value="if">Condicional (si/entonces)</option>
                  <option value="count_if">Contar si</option>
                </select>
              </div>

              {formulaType === 'arithmetic' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Columna A</label>
                    <select
                      value={arithColA}
                      onChange={e => setArithColA(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">— elegir columna —</option>
                      {boardCols.filter(c => c.kind === 'number' || c.kind === 'formula').map(c => (
                        <option key={c.col_key} value={c.col_key}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Operación</label>
                    <select
                      value={arithOp}
                      onChange={e => setArithOp(e.target.value as ArithOp)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="multiply">× Multiplicar</option>
                      <option value="add">+ Sumar</option>
                      <option value="subtract">− Restar</option>
                      <option value="divide">÷ Dividir</option>
                      <option value="percent">% Porcentaje (A × B / 100)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Columna B</label>
                    <select
                      value={arithColB}
                      onChange={e => setArithColB(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">— elegir columna —</option>
                      {boardCols.filter(c => c.kind === 'number' || c.kind === 'formula').map(c => (
                        <option key={c.col_key} value={c.col_key}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {arithColA && arithColB && (
                    <div className="rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                      Vista previa: {boardCols.find(c => c.col_key === arithColA)?.name ?? arithColA}{' '}
                      {arithOp === 'multiply' ? '×' : arithOp === 'add' ? '+' : arithOp === 'subtract' ? '−' : arithOp === 'divide' ? '÷' : '%'}{' '}
                      {boardCols.find(c => c.col_key === arithColB)?.name ?? arithColB}
                    </div>
                  )}

                  <button
                    onClick={handleSaveFormula}
                    disabled={savingFormula || !arithColA || !arithColB}
                    className="w-full px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                  >
                    {savingFormula ? 'Guardando…' : 'Guardar fórmula'}
                  </button>
                </>
              )}

              {formulaType === 'if' && (
                <>
                  {/* Condition row */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">SI esta condición se cumple:</p>
                    <select value={ifCondCol} onChange={e => setIfCondCol(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                      <option value="">— elegir columna —</option>
                      {boardCols.map(c => <option key={c.col_key} value={c.col_key}>{c.name}</option>)}
                    </select>
                    <select value={ifCondOp} onChange={e => setIfCondOp(e.target.value as CondOp)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                      <option value="=">=  igual a</option>
                      <option value="!=">≠  no es igual a</option>
                      <option value=">">&gt;  mayor que</option>
                      <option value="<">&lt;  menor que</option>
                      <option value="empty">está vacío</option>
                      <option value="not_empty">no está vacío</option>
                      <option value="contains">contiene (texto / opción)</option>
                      <option value="not_contains">no contiene</option>
                    </select>
                    {ifCondOp !== 'empty' && ifCondOp !== 'not_empty' && (
                      <input type="text" value={ifCondValue} onChange={e => setIfCondValue(e.target.value)}
                        placeholder="Valor a comparar"
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                    )}
                  </div>

                  {/* True branch */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">ENTONCES retornar:</p>
                    <div className="flex gap-1">
                      {(['col', 'literal'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setIfTrueType(t)}
                          className={['flex-1 py-1 text-xs rounded border transition-colors', ifTrueType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'].join(' ')}>
                          {t === 'col' ? 'Columna' : 'Literal'}
                        </button>
                      ))}
                    </div>
                    {ifTrueType === 'col' ? (
                      <select value={ifTrueVal} onChange={e => setIfTrueVal(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                        <option value="">— elegir columna —</option>
                        {boardCols.map(c => <option key={c.col_key} value={c.col_key}>{c.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={ifTrueVal} onChange={e => setIfTrueVal(e.target.value)}
                        placeholder='Ej: "Aprobado" o 1'
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                    )}
                  </div>

                  {/* False branch */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">SI NO retornar:</p>
                    <div className="flex gap-1">
                      {(['col', 'literal'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setIfFalseType(t)}
                          className={['flex-1 py-1 text-xs rounded border transition-colors', ifFalseType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'].join(' ')}>
                          {t === 'col' ? 'Columna' : 'Literal'}
                        </button>
                      ))}
                    </div>
                    {ifFalseType === 'col' ? (
                      <select value={ifFalseVal} onChange={e => setIfFalseVal(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                        <option value="">— elegir columna —</option>
                        {boardCols.map(c => <option key={c.col_key} value={c.col_key}>{c.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={ifFalseVal} onChange={e => setIfFalseVal(e.target.value)}
                        placeholder='Ej: "Pendiente" o 0'
                        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                    )}
                  </div>

                  {/* Preview */}
                  {ifCondCol && (ifTrueVal || ifFalseVal) && (
                    <div className="rounded-md bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700 leading-relaxed">
                      SI &quot;{boardCols.find(c => c.col_key === ifCondCol)?.name ?? ifCondCol}&quot;{' '}
                      {ifCondOp === '=' ? '=' : ifCondOp === '!=' ? '≠' : ifCondOp === '>' ? '>' : ifCondOp === '<' ? '<' : ifCondOp === 'empty' ? 'está vacío' : ifCondOp === 'not_empty' ? 'no está vacío' : ifCondOp}{' '}
                      {ifCondOp !== 'empty' && ifCondOp !== 'not_empty' && `"${ifCondValue}" `}
                      → &quot;{ifTrueVal || '…'}&quot; SI NO → &quot;{ifFalseVal || '…'}&quot;
                    </div>
                  )}

                  <button onClick={handleSaveFormula} disabled={savingFormula || !ifCondCol}
                    className="w-full px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50">
                    {savingFormula ? 'Guardando…' : 'Guardar fórmula'}
                  </button>
                </>
              )}

              {formulaType !== 'arithmetic' && formulaType !== 'if' && (
                <p className="text-[12px] text-gray-400">
                  Este tipo de fórmula se configurará en una próxima versión.
                </p>
              )}
            </div>
          )}

          {/* ── Rollup ─────────────────────────────────────────────────── */}
          {tab === 'rollup' && isRollup && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Agrega valores de sub-items hacia arriba. Solo aplica a columnas en boards (L1 → Item).
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Agregar desde</label>
                <select
                  value={rollupSourceLevel}
                  onChange={e => setRollupSourceLevel(e.target.value as 'children' | 'descendants')}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                >
                  <option value="children">Sub-items L1 (directos)</option>
                  <option value="descendants">Todos los niveles</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Columna fuente</label>
                <select
                  value={rollupSourceColKey}
                  onChange={e => setRollupSourceColKey(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                >
                  <option value="">— elegir columna de sub-items —</option>
                  {subItemCols.map(c => (
                    <option key={c.col_key} value={c.col_key}>{c.name}</option>
                  ))}
                </select>
                {subItemCols.length === 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">No hay columnas numéricas en sub-items aún.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Función</label>
                <select
                  value={rollupAggregate}
                  onChange={e => setRollupAggregate(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                >
                  <option value="sum">Σ Suma</option>
                  <option value="avg">∅ Promedio</option>
                  <option value="count">N Contar filas</option>
                  <option value="count_not_empty">N+ Contar no vacíos</option>
                  <option value="min">↓ Mínimo</option>
                  <option value="max">↑ Máximo</option>
                </select>
              </div>

              {rollupSourceColKey && (
                <div className="rounded-md bg-teal-50 border border-teal-100 px-3 py-2 text-xs text-teal-700">
                  {rollupAggregate === 'sum' ? 'Suma' : rollupAggregate === 'avg' ? 'Promedio' : rollupAggregate === 'count' ? 'Conteo' : rollupAggregate === 'count_not_empty' ? 'Conteo no vacíos' : rollupAggregate === 'min' ? 'Mínimo' : 'Máximo'} de &quot;{subItemCols.find(c => c.col_key === rollupSourceColKey)?.name ?? rollupSourceColKey}&quot; de {rollupSourceLevel === 'children' ? 'sub-items L1' : 'todos los niveles'}
                </div>
              )}

              <button
                onClick={handleSaveRollup}
                disabled={savingRollup || !rollupSourceColKey}
                className="w-full px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {savingRollup ? 'Guardando…' : 'Guardar rollup'}
              </button>
            </div>
          )}

          {/* ── Reflejo ─────────────────────────────────────────────────── */}
          {tab === 'reflejo' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Columna de relación (este board)</label>
                <select
                  value={refSourceCol}
                  onChange={(e) => {
                    setRefSourceCol(e.target.value)
                    setRefFieldCol('')
                    setRefError(null)
                  }}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                >
                  <option value="">— Ninguna —</option>
                  {(allColumns ?? [])
                    .filter(c => c.kind === 'relation')
                    .map(c => (
                      <option key={c.col_key} value={c.col_key}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Elige una columna relation existente. El reflejo leerá del item relacionado.</p>
              </div>

              {refSourceCol && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Campo a reflejar (board destino)</label>
                  <select
                    value={refFieldCol}
                    onChange={(e) => {
                      setRefFieldCol(e.target.value)
                      setRefError(null)
                    }}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    <option value="">— Elegir campo —</option>
                    {refTargetCols.map(c => (
                      <option key={c.id} value={c.col_key}>
                        {c.name} · {c.kind}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Este valor se mostrará en la celda. Al editarlo se escribirá en el item fuente.</p>
                </div>
              )}

              {refError && <p className="text-xs text-red-600">{refError}</p>}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={handleSaveRef}
                  disabled={refSaving || !refSourceCol || !refFieldCol}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {refSaving ? 'Guardando…' : 'Guardar reflejo'}
                </button>
                {((column.settings as any)?.ref_source_col_key || (column.settings as any)?.ref_field_col_key) && (
                  <button
                    onClick={handleClearRef}
                    disabled={refSaving}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    No reflejar
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-2">
                Las celdas reflejo se muestran con tinte ámbar e icono <b>↪</b>. El valor real vive en el item relacionado.
              </div>
            </div>
          )}

          {/* ── Validación ──────────────────────────────────────────────── */}
          {tab === 'validacion' && (
            <div className="space-y-4">
              {isButton ? (
                /* Button: gates live on the Etapa column, not here */
                <p className="text-xs text-gray-500 py-2">
                  Los gates de este botón se configuran en la columna <strong>Etapa</strong> → pestaña Validación.
                  Selecciona qué condiciones deben cumplirse antes de avanzar a cada etapa.
                </p>
              ) : isStageCol ? (
                /* Stage column: all stages expanded with their gate checklists */
                <>
                  <p className="text-xs text-gray-500 mb-3">
                    Qué condiciones debe cumplir el item para avanzar a cada etapa.
                  </p>

                  {stages.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2 text-center">Cargando etapas…</p>
                  ) : (() => {
                    const validatedCols = allColumns.filter(
                      c => c.col_key !== 'stage' && c.settings?.validation
                    )

                    return (
                      <div className="space-y-4">
                        {stages.map(stage => {
                          const currentKeys: string[] = stageGates[stage.id] ?? []
                          return (
                            <div key={stage.id} className="border border-gray-100 rounded-lg overflow-hidden">
                              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">{stage.name}</span>
                                {currentKeys.length > 0 && (
                                  <span className="text-[10px] text-indigo-600 font-medium">{currentKeys.length} condición{currentKeys.length !== 1 ? 'es' : ''}</span>
                                )}
                              </div>
                              {validatedCols.length === 0 ? (
                                <p className="text-[11px] text-gray-400 px-3 py-2">Sin validaciones configuradas</p>
                              ) : (
                                <div className="px-3 py-2 space-y-2">
                                  {validatedCols.map(c => {
                                    const val = c.settings?.validation as { message?: string } | undefined
                                    const checked = currentKeys.includes(c.col_key)
                                    return (
                                      <label key={c.col_key} className="flex items-start gap-2.5 cursor-pointer group">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => setStageGates(prev => {
                                            const keys: string[] = prev[stage.id] ?? []
                                            return {
                                              ...prev,
                                              [stage.id]: checked
                                                ? keys.filter((k: string) => k !== c.col_key)
                                                : [...keys, c.col_key],
                                            }
                                          })}
                                          className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{c.name}</p>
                                          {val?.message && (
                                            <p className="text-[11px] text-gray-400 truncate">{val.message}</p>
                                          )}
                                        </div>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <button
                          onClick={handleSaveStageGates}
                          disabled={savingButton}
                          className="w-full px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50"
                        >
                          {savingButton ? 'Guardando…' : 'Guardar gates'}
                        </button>
                      </div>
                    )
                  })()}
                </>
              ) : (
                /* Standard columns: condition builder */
                <>
                  <p className="text-xs text-gray-500">
                    Define cuándo esta columna es válida. Las celdas inválidas se marcan en rojo con ❌.
                    Para sub-item aggregates, apunta a una columna rollup del mismo nivel.
                  </p>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={validationEnabled} onChange={e => setValidationEnabled(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                    <span className="text-xs font-medium text-gray-700">Activar validación</span>
                  </label>

                  {validationEnabled && (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600">La columna es válida si:</p>
                        <select value={validationCol} onChange={e => setValidationCol(e.target.value)}
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                          <option value="">— esta misma columna —</option>
                          {boardCols.map(c => <option key={c.col_key} value={c.col_key}>{c.name}</option>)}
                        </select>
                        <select value={validationOp} onChange={e => setValidationOp(e.target.value as CondOp)}
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20">
                          <option value="not_empty">no está vacío</option>
                          <option value="empty">está vacío</option>
                          <option value="=">=  igual a</option>
                          <option value="!=">≠  no es igual a</option>
                          <option value=">">&gt;  mayor que</option>
                          <option value="<">&lt;  menor que</option>
                          <option value="contains">contiene</option>
                          <option value="not_contains">no contiene</option>
                        </select>
                        {validationOp !== 'empty' && validationOp !== 'not_empty' && (
                          <input type="text" value={validationValue} onChange={e => setValidationValue(e.target.value)}
                            placeholder="Valor de referencia"
                            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje cuando falla</label>
                        <input type="text" value={validationMessage} onChange={e => setValidationMessage(e.target.value)}
                          placeholder="Ej: Cantidad debe ser mayor a 0"
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20" />
                      </div>

                      {(validationCol || validationOp) && (
                        <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
                          ❌ cuando &quot;{boardCols.find(c => c.col_key === validationCol)?.name ?? (validationCol || 'esta columna')}&quot;{' '}
                          {validationOp === '=' ? 'no es igual a' : validationOp === '!=' ? 'es igual a' : validationOp === '>' ? 'es ≤' : validationOp === '<' ? 'es ≥' : validationOp === 'empty' ? 'no está vacío' : validationOp === 'not_empty' ? 'está vacío' : validationOp === 'contains' ? 'no contiene' : 'contiene'}{' '}
                          {validationOp !== 'empty' && validationOp !== 'not_empty' && `"${validationValue}"`}
                        </div>
                      )}
                    </>
                  )}

                  <button onClick={handleSaveValidation} disabled={savingValidation || (validationEnabled && !validationCol && validationOp === '=')}
                    className="w-full px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 disabled:opacity-50">
                    {savingValidation ? 'Guardando…' : validationEnabled ? 'Guardar validación' : 'Quitar validación'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Opciones ────────────────────────────────────────────────── */}
          {tab === 'opciones' && isSelect && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Opciones disponibles para esta columna. Los cambios se guardan inmediatamente.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-purple-400 shrink-0">
                  <rect x="2" y="5" width="8" height="6" rx="1" strokeWidth="1.4"/>
                  <path d="M4 5V3.5a2 2 0 0 1 4 0V5" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>= estado final / cerrado (usado para % completado)</span>
              </div>

              {/* Option list */}
              <div className="space-y-1.5">
                {options.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Sin opciones todavía</p>
                ) : (
                  options.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2 py-1 group">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color ?? '#6b7280' }}
                      />
                      <span className="text-sm text-gray-700 flex-1 truncate">{opt.label}</span>
                      {/* Estado terminal toggle */}
                      <button
                        onClick={() => handleToggleClosed(opt.value)}
                        disabled={savingOpts}
                        title={opt.is_closed ? 'Estado terminal (click para quitar)' : 'Marcar como estado terminal'}
                        className={`shrink-0 transition-colors disabled:opacity-50 ${
                          opt.is_closed
                            ? 'text-purple-500 hover:text-gray-400'
                            : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-400'
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                          <rect x="2" y="5" width="8" height="6" rx="1" strokeWidth="1.4"/>
                          <path d="M4 5V3.5a2 2 0 0 1 4 0V5" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveOption(opt.value)}
                        disabled={savingOpts}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm leading-none shrink-0 transition-opacity disabled:opacity-50"
                      >×</button>
                    </div>
                  ))
                )}
              </div>

              {/* Add option form */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-xs font-medium text-gray-600">Nueva opción</p>
                <input
                  type="text"
                  value={newOptLabel}
                  onChange={e => setNewOptLabel(e.target.value)}
                  placeholder="Nombre de la opción"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddOption() }}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                />
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewOptColor(c)}
                      className={[
                        'w-5 h-5 rounded-full transition-all',
                        newOptColor === c
                          ? 'ring-2 ring-offset-1 ring-gray-900'
                          : 'hover:ring-1 hover:ring-offset-1 hover:ring-gray-400',
                      ].join(' ')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddOption}
                  disabled={savingOpts || !newOptLabel.trim()}
                  className="w-full px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {savingOpts ? '...' : '+ Agregar opción'}
                </button>
              </div>
            </div>
          )}

          {/* ── Permisos ─────────────────────────────────────────────────── */}
          {tab === 'permisos' && permissionsEndpoint && (
            <PermissionsTab
              column={column}
              boardId={boardId}
              users={users}
              patchEndpoint={patchEndpoint}
              permissionsEndpoint={permissionsEndpoint}
              isSubItemColumn={isSubItemColumn}
              onPatched={onPatched}
            />
          )}

        </div>

        {/* Delete footer — hidden for system columns */}
        {!column.is_system && onDeleted && (
          <div className="shrink-0 border-t border-gray-100 px-4 py-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12px] text-gray-600">¿Eliminar esta columna?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="px-2.5 py-1 text-[12px] text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2.5 py-1 text-[12px] text-white bg-red-500 hover:bg-red-600 rounded-md disabled:opacity-50"
                >
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left text-[12px] text-red-500 hover:text-red-700 transition-colors"
              >
                Eliminar columna
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
