'use client'

import { useState, useEffect } from 'react'

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
  settings: Record<string, unknown>
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

type ColPermission = {
  id: string
  user_id: string | null
  team_id: string | null
  access: 'view' | 'edit'
  users?: { id: string; name: string }
  teams?: { id: string; name: string }
}

type RemoteBoard = { id: string; name: string }
type RemoteTeam  = { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#6b7280',
]

const KIND_OPTIONS = [
  { value: 'text',        label: 'Texto' },
  { value: 'number',      label: 'Número' },
  { value: 'date',        label: 'Fecha' },
  { value: 'select',      label: 'Selección simple' },
  { value: 'multiselect', label: 'Selección múltiple' },
  { value: 'people',      label: 'Persona' },
  { value: 'boolean',     label: 'Checkbox' },
  { value: 'relation',    label: 'Relación' },
  { value: 'phone',       label: 'Teléfono' },
  { value: 'email',       label: 'Email' },
  { value: 'url',         label: 'URL' },
  { value: 'file',        label: 'Archivo(s)' },
  { value: 'button',      label: 'Botón' },
  { value: 'signature',   label: 'Firma' },
  { value: 'formula',     label: 'Fórmula' },
  { value: 'rollup',      label: 'Rollup (agrega sub-items)' },
]

const NUMBER_FORMATS = [
  { value: 'integer',  label: 'Entero' },
  { value: 'decimal',  label: 'Decimal' },
  { value: 'currency', label: 'Moneda ($)' },
  { value: 'percent',  label: 'Porcentaje (%)' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  column: PanelColumn
  boardId: string
  allColumns: { col_key: string; name: string; kind: string }[]
  users: PanelUser[]
  onClose: () => void
  onUpdated: (col: PanelColumn) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ColumnSettingsPanel({ column, boardId, allColumns, users, onClose, onUpdated }: Props) {
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

  // ── Relation state ────────────────────────────────────────────────────────
  const [boards,         setBoards]         = useState<RemoteBoard[]>([])
  const [targetBoardId,  setTargetBoardId]  = useState<string>(
    (column.settings?.target_board_id as string) ?? ''
  )
  const [savingRelation, setSavingRelation] = useState(false)

  // ── Permissions state ─────────────────────────────────────────────────────
  const [permissions,   setPermissions]   = useState<ColPermission[]>([])
  const [permsLoading,  setPermsLoading]  = useState(false)
  const [teams,         setTeams]         = useState<RemoteTeam[]>([])
  const [newPermId,     setNewPermId]     = useState('')   // 'u:<uuid>' | 't:<uuid>'
  const [newPermAccess, setNewPermAccess] = useState<'view' | 'edit'>('view')
  const [savingPerm,    setSavingPerm]    = useState(false)

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

  // ── Active tab ────────────────────────────────────────────────────────────
  const isSelect    = kind === 'select' || kind === 'multiselect'
  const isNumber    = kind === 'number'
  const isRelation  = kind === 'relation'
  const isSignature = kind === 'signature'
  const isFormula   = kind === 'formula'
  const isRollup    = kind === 'rollup'

  type TabId = 'general' | 'opciones' | 'formula' | 'rollup' | 'permisos'
  const [tab, setTab] = useState<TabId>('general')

  // ── Load permissions + teams ──────────────────────────────────────────────
  useEffect(() => {
    setPermsLoading(true)
    Promise.all([
      fetch(`/api/boards/${boardId}/columns/${column.id}/permissions`).then(r => r.ok ? r.json() : []),
      fetch('/api/teams').then(r => r.ok ? r.json() : []),
    ]).then(([perms, teamsData]: [ColPermission[], RemoteTeam[]]) => {
      setPermissions(perms)
      setTeams(teamsData)
    }).finally(() => setPermsLoading(false))
  }, [boardId, column.id])

  // ── Load boards for relation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isRelation) return
    fetch('/api/boards')
      .then(r => (r.ok ? r.json() : []))
      .then((data: RemoteBoard[]) => setBoards(data))
  }, [isRelation])

  // ── Load sub-item columns for rollup ─────────────────────────────────────
  useEffect(() => {
    if (!isRollup) return
    fetch(`/api/boards/${boardId}/sub-item-columns`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SubItemCol[]) => setSubItemCols(data.filter(c => c.kind === 'number' || c.kind === 'formula')))
  }, [isRollup, boardId])

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function patchColumn(patch: Record<string, unknown>): Promise<PanelColumn | null> {
    const res = await fetch(`/api/boards/${boardId}/columns/${column.id}`, {
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
      if (updated) onUpdated(updated)
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
    if (!arithColA || !arithColB) return
    setSavingFormula(true)
    try {
      const formula_config = formulaType === 'arithmetic'
        ? { type: 'arithmetic', op: arithOp, col_a: arithColA, col_b: arithColB }
        : null
      if (!formula_config) return
      const updated = await patchColumn({
        settings: { ...column.settings, formula_config },
      })
      if (updated) onUpdated(updated)
    } finally {
      setSavingFormula(false)
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

  async function handleAddPermission() {
    if (!newPermId) return
    const isTeam = newPermId.startsWith('t:')
    const entityId = newPermId.slice(2)
    setSavingPerm(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/columns/${column.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isTeam ? { team_id: entityId } : { user_id: entityId }),
          access: newPermAccess,
        }),
      })
      if (res.ok) {
        const perm = await res.json() as ColPermission
        setPermissions(prev => [...prev, perm])
        setNewPermId('')
      }
    } finally {
      setSavingPerm(false)
    }
  }

  async function handleRemovePermission(permId: string) {
    setSavingPerm(true)
    try {
      const res = await fetch(
        `/api/boards/${boardId}/columns/${column.id}/permissions/${permId}`,
        { method: 'DELETE' }
      )
      if (res.ok) setPermissions(prev => prev.filter(p => p.id !== permId))
    } finally {
      setSavingPerm(false)
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general',  label: 'General' },
    ...(isSelect  ? [{ id: 'opciones' as TabId, label: 'Opciones' }] : []),
    ...(isFormula ? [{ id: 'formula'  as TabId, label: 'Fórmula'  }] : []),
    ...(isRollup  ? [{ id: 'rollup'   as TabId, label: 'Rollup'   }] : []),
    { id: 'permisos', label: 'Permisos' },
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
      <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">

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

              {formulaType !== 'arithmetic' && (
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

          {/* ── Opciones ────────────────────────────────────────────────── */}
          {tab === 'opciones' && isSelect && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Opciones disponibles para esta columna. Los cambios se guardan inmediatamente.
              </p>

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
          {tab === 'permisos' && (
            <div className="space-y-3">
              {permsLoading ? (
                <p className="text-xs text-gray-400">Cargando...</p>
              ) : (
                <>
                  {permissions.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      Sin restricciones — todos los miembros del board pueden ver esta columna.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {permissions.map(perm => {
                        const label = perm.users?.name ?? perm.teams?.name ?? 'Desconocido'
                        return (
                          <div key={perm.id} className="flex items-center gap-2 py-1 group">
                            <span className="text-sm text-gray-700 flex-1 truncate">{label}</span>
                            <span className={[
                              'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                              perm.access === 'edit'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-gray-100 text-gray-600',
                            ].join(' ')}>
                              {perm.access === 'edit' ? 'Editar' : 'Ver'}
                            </span>
                            <button
                              onClick={() => handleRemovePermission(perm.id)}
                              disabled={savingPerm}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-sm leading-none shrink-0 transition-opacity"
                            >×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-medium text-gray-600">Agregar restricción</p>
                    <select
                      value={newPermId}
                      onChange={e => setNewPermId(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">Seleccionar miembro o equipo...</option>
                      {users.filter(u => !permissions.some(p => p.user_id === u.id)).length > 0 && (
                        <optgroup label="Miembros">
                          {users
                            .filter(u => !permissions.some(p => p.user_id === u.id))
                            .map(u => (
                              <option key={u.id} value={`u:${u.id}`}>
                                {u.name ?? u.phone ?? 'Usuario'}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {teams.filter(t => !permissions.some(p => p.team_id === t.id)).length > 0 && (
                        <optgroup label="Equipos">
                          {teams
                            .filter(t => !permissions.some(p => p.team_id === t.id))
                            .map(t => (
                              <option key={t.id} value={`t:${t.id}`}>
                                {t.name}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="flex gap-2">
                      <select
                        value={newPermAccess}
                        onChange={e => setNewPermAccess(e.target.value as 'view' | 'edit')}
                        className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                      >
                        <option value="view">Solo ver</option>
                        <option value="edit">Editar</option>
                      </select>
                      <button
                        onClick={handleAddPermission}
                        disabled={savingPerm || !newPermId}
                        className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50"
                      >
                        {savingPerm ? '...' : '+'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
