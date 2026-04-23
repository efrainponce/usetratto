'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GenericDataTable } from '@/components/data-table/GenericDataTable'
import { SubItemsView } from '@/components/SubItemsView'
import type { ColumnDef, Row, CellValue, CellKind, ColumnSettings } from '@/components/data-table/types'
import { applyFilters, applySort, groupRows } from '@/lib/view-engine'
import type { ViewConfig, ViewFilter, ViewSort, DateBucket, GroupedRows } from '@/components/data-table/types'
import { FilterPanel } from '@/components/view-config/FilterPanel'
import { SortPanel } from '@/components/view-config/SortPanel'
import { GroupPanel } from '@/components/view-config/GroupPanel'

const modalLoader = () => (
  <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
    <div className="bg-white rounded-lg px-4 py-3 text-sm text-gray-600 shadow-lg">Cargando…</div>
  </div>
)

const SubItemViewWizard  = dynamic(() => import('@/components/SubItemViewWizard').then(m => m.SubItemViewWizard),   { ssr: false, loading: modalLoader })
const SourceColumnMapper = dynamic(() => import('@/components/SourceColumnMapper').then(m => m.SourceColumnMapper), { ssr: false, loading: modalLoader })
const ImportWizard       = dynamic(() => import('@/components/import/ImportWizard').then(m => m.ImportWizard),      { ssr: false, loading: modalLoader })
const ColumnSettingsPanel = dynamic(() => import('@/components/ColumnSettingsPanel').then(m => m.ColumnSettingsPanel), { ssr: false, loading: modalLoader })
const ItemChannelsModal   = dynamic(() => import('@/components/ItemChannelsModal').then(m => m.ItemChannelsModal),    { ssr: false, loading: modalLoader })
import type { BoardStage, BoardColumn, WorkspaceUser, BoardItem, ItemValue, SubItemColumn, BoardView, SubItemView } from '@/lib/boards'
import type { ColPermission } from '@/lib/boards/types'
import { getPrimaryStageColKey, getOwnerColKey } from '@/lib/boards/helpers'
import { computeFormula, type FormulaConfig } from '@/lib/formula-engine'

// ─── View member type ─────────────────────────────────────────────────────────
type ViewMember = {
  id: string
  user_id: string | null
  team_id: string | null
  users?: { id: string; sid: number; name: string }
  teams?: { id: string; sid: number; name: string }
}

// Get dynamic ITEMS_FIELD map based on stage/owner col_keys
function getItemsFieldMap(stageColKey: string, ownerColKey: string): Record<string, keyof BoardItem> {
  return {
    name:          'name',
    [stageColKey]: 'stage_id',
    [ownerColKey]: 'owner_id',
    deadline:      'deadline',
    created_by:    'created_by',
    created_at:    'created_at',
    updated_at:    'updated_at',
    folio:         'folio_number',
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  workspaceSid:          number
  boardId:               string
  boardSid:              number
  boardName:             string
  initialStages:         BoardStage[]
  initialColumns:        BoardColumn[]
  initialUsers:          WorkspaceUser[]
  initialItems:          BoardItem[]
  initialSubItemColumns: SubItemColumn[]
  initialSourceBoardId:  string | null
  initialViews:          BoardView[]
  initialSubItemViews:   SubItemView[]
  boardSettings:         Record<string, unknown>
  subitemView:           'L1_only' | 'L1_L2' | 'L2_only'
  userRole:              string
  isBoardAdmin:          boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardView({
  workspaceSid, boardId, boardSid, boardName,
  initialStages, initialColumns, initialUsers, initialItems,
  initialSubItemColumns, initialSourceBoardId, initialViews, initialSubItemViews,
  boardSettings, subitemView, userRole, isBoardAdmin,
}: Props) {
  const router = useRouter()
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'

  // Singleton Supabase client for realtime subscriptions
  const supabase = useMemo(() => createClient(), [])

  // All data pre-fetched by server — no loading state, no useEffect
  const [rawCols,  setRawCols]  = useState<BoardColumn[]>(initialColumns)

  // Compute stage/owner col_keys from column metadata
  const stageColKey = useMemo(() => getPrimaryStageColKey(rawCols) ?? 'stage', [rawCols])
  const ownerColKey = useMemo(() => getOwnerColKey(rawCols) ?? 'owner', [rawCols])

  // Dynamic ITEMS_FIELD map
  const ITEMS_FIELD = useMemo(() => getItemsFieldMap(stageColKey, ownerColKey), [stageColKey, ownerColKey])

  // Compute ref columns metadata
  const refColsMeta = useMemo<RefColMeta[]>(() => {
    const metas: RefColMeta[] = []
    for (const col of rawCols) {
      const s = col.settings as any
      if (!s?.ref_source_col_key || !s?.ref_field_col_key) continue
      const relCol = rawCols.find(c => c.col_key === s.ref_source_col_key && c.kind === 'relation')
      const targetBoardId = (relCol?.settings as any)?.target_board_id
      if (!relCol || !targetBoardId) continue
      metas.push({
        col_key: col.col_key,
        relation_col_key: relCol.col_key,
        relation_col_id: relCol.id,
        target_board_id: targetBoardId,
        ref_field_col_key: s.ref_field_col_key,
      })
    }
    return metas
  }, [rawCols])

  const [stages,   setStages]   = useState<BoardStage[]>(initialStages)
  const [users,    setUsers]    = useState<WorkspaceUser[]>(initialUsers)
  const [rawItems, setRawItems] = useState<BoardItem[]>(initialItems)
  const [subItemColumns, setSubItemColumns] = useState<SubItemColumn[]>(initialSubItemColumns)
  const [sourceBoardId, setSourceBoardId]   = useState<string | null>(initialSourceBoardId)
  const [showMapper,    setShowMapper]       = useState(false)
  const [mapperViewId,  setMapperViewId]     = useState<string>('')
  const [showImport,    setShowImport]       = useState(false)
  const [subItemViews,  setSubItemViews]     = useState<SubItemView[]>(initialSubItemViews)
  const [showViewWizard, setShowViewWizard]  = useState(false)
  const [columnsVersion, setColumnsVersion]  = useState(0)

  // View management
  const [views,        setViews]        = useState<BoardView[]>(initialViews)
  const [activeViewId, setActiveViewId] = useState<string | null>(initialViews[0]?.id ?? null)
  const [addingView,   setAddingView]   = useState(false)
  const [newViewName,  setNewViewName]  = useState('')
  const [renamingViewId, setRenamingViewId] = useState<string | null>(null)
  const [renameValue,    setRenameValue]    = useState('')
  const [showColPicker,  setShowColPicker]  = useState(false)
  const [viewMembersOpen, setViewMembersOpen] = useState<string | null>(null)
  const [viewMembers, setViewMembers] = useState<Record<string, ViewMember[]>>({})
  const [viewMembersLoading, setViewMembersLoading] = useState<Record<string, boolean>>({})
  const [newViewMemberId, setNewViewMemberId] = useState('')
  const [viewMemberTeams, setViewMemberTeams] = useState<{ id: string; name: string }[]>([])
  const [viewMemberTeamsLoaded, setViewMemberTeamsLoaded] = useState(false)
  // Column settings panel
  const [colSettingsCol, setColSettingsCol] = useState<BoardColumn | null>(null)

  // Fase 19 — filter/sort/group popovers
  const [showFilter, setShowFilter] = useState(false)
  const [showSort,   setShowSort]   = useState(false)
  const [showGroup,  setShowGroup]  = useState(false)
  const filterBtnRef = useRef<HTMLDivElement>(null)
  const sortBtnRef   = useRef<HTMLDivElement>(null)
  const groupBtnRef  = useRef<HTMLDivElement>(null)

  // Channels modal + summary
  const [channelsItemId, setChannelsItemId] = useState<string | null>(null)
  const [channelSummary, setChannelSummary] = useState<Record<string, { message_count: number; unread_count: number }>>({})

  const newViewInputRef    = useRef<HTMLInputElement>(null)
  const colPickerRef       = useRef<HTMLDivElement>(null)
  const viewMembersPanelRef = useRef<HTMLDivElement>(null)
  const viewSubmittingRef  = useRef(false)

  // ─── Ref columns: mirror/lookup support ────────────────────────────────────
  type RefColMeta = {
    col_key: string            // THIS board's ref col key
    relation_col_key: string    // col_key of the relation col in THIS board
    relation_col_id: string     // column_id of relation col (for item_values lookup)
    target_board_id: string     // board_id of the target board
    ref_field_col_key: string   // col_key in the target board to mirror
  }
  const [refMap, setRefMap] = useState<Record<string, Record<string, unknown>>>({})  // source_item_id → col_key → value
  const [refTargetCols, setRefTargetCols] = useState<Record<string, Record<string, string>>>({})  // target_board_id → col_key → column_id
  const [refNestedBoardId, setRefNestedBoardId] = useState<Record<string, string>>({})  // col_key of ref col → target_board_id of the nested relation

  // col_key → column UUID  (for item_values lookups)
  const colIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    rawCols.forEach(c => { map[c.col_key] = c.id })
    return map
  }, [rawCols])

  // Keep rawItems in a ref to avoid recreating handleCellChange on every row change
  const rawItemsRef = useRef(rawItems)
  useEffect(() => {
    rawItemsRef.current = rawItems
  }, [rawItems])

  // Relation label map: target_board_id → item_id → name (for relation cell display)
  const [relationLabelMap, setRelationLabelMap] = useState<Record<string, Record<string, string>>>({})

  // Memo for unique target board IDs from relation columns (direct + nested via ref)
  const relationTargetBoards = useMemo(() => {
    const set = new Set<string>()
    for (const col of rawCols) {
      if (col.kind === 'relation') {
        const tb = (col.settings as any)?.target_board_id
        if (tb) set.add(tb)
      }
    }
    // Also include nested target boards from ref columns that mirror relation fields
    for (const nbid of Object.values(refNestedBoardId)) {
      set.add(nbid)
    }
    return [...set]
  }, [rawCols, refNestedBoardId])

  // Effect to preload relation label maps
  useEffect(() => {
    if (relationTargetBoards.length === 0) return
    Promise.all(
      relationTargetBoards.map(async bid => {
        try {
          const res = await fetch(`/api/items?boardId=${bid}`)
          if (!res.ok) return { bid, items: [] as Array<{ id: string; name: string }> }
          const data = await res.json()
          return { bid, items: data }
        } catch {
          return { bid, items: [] }
        }
      })
    ).then(results => {
      const map: Record<string, Record<string, string>> = {}
      for (const { bid, items } of results) {
        map[bid] = {}
        for (const item of items) {
          if (item?.id && item?.name) map[bid][item.id] = item.name
        }
      }
      setRelationLabelMap(map)
    })
  }, [relationTargetBoards])

  // Active view lookup
  const activeView = views.find(v => v.id === activeViewId) ?? null

  // Fase 19 — local draft config
  const [localConfig, setLocalConfig] = useState<ViewConfig | null>(null)

  // Reset local draft when activeViewId changes
  useEffect(() => {
    setLocalConfig(null)
  }, [activeViewId])

  // Fase 19 — derive saved config and effective config
  const savedConfig: ViewConfig = activeView?.config ?? {}
  const effectiveConfig: ViewConfig = localConfig ?? savedConfig

  // Check if there are unsaved local changes
  const hasLocalChanges = localConfig !== null && JSON.stringify(localConfig) !== JSON.stringify(savedConfig)

  // Fase 19 — local config updater (no server call)
  const updateLocalConfig = useCallback((patch: Partial<ViewConfig>) => {
    setLocalConfig(prev => {
      const base = prev ?? savedConfig
      return { ...base, ...patch }
    })
  }, [savedConfig])

  // Fase 19 — filter/sort/group handlers
  const handleFiltersChange = useCallback((filters: ViewFilter[]) => {
    if (!activeViewId) return
    updateLocalConfig({ filters })
  }, [activeViewId, updateLocalConfig])

  const handleSortsChange = useCallback((sort: ViewSort[]) => {
    if (!activeViewId) return
    updateLocalConfig({ sort })
  }, [activeViewId, updateLocalConfig])

  const handleGroupChange = useCallback((group_by: string | null, group_bucket?: DateBucket) => {
    if (!activeViewId) return
    updateLocalConfig({ group_by, group_bucket: group_by ? group_bucket : undefined })
    setShowGroup(false)
  }, [activeViewId, updateLocalConfig])

  // Fase 19 — save to view handler
  const handleSaveToView = useCallback(async () => {
    if (!activeViewId || !hasLocalChanges || !localConfig) return
    // Optimistic local merge into saved
    setViews(prev => prev.map(v => v.id === activeViewId ? { ...v, config: localConfig } : v))
    setLocalConfig(null)
    const res = await fetch(`/api/boards/${boardId}/views/${activeViewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: localConfig }),
    })
    if (!res.ok) {
      // Revert on failure
      console.error('[view config] save failed')
    }
  }, [activeViewId, hasLocalChanges, localConfig, boardId])

  // Fase 19 — discard local changes handler
  const handleDiscardLocal = useCallback(() => {
    setLocalConfig(null)
  }, [])

  // ColumnDef[] — board columns (folio is_system lives en board_columns con pos -1, aparece primero)
  const columns = useMemo((): ColumnDef[] => {
    return rawCols
      .filter(c => !c.is_hidden)
      .filter(c => {
        if (!activeView || activeView.columns.length === 0) return true
        const vc = activeView.columns.find(vc => vc.column_id === c.id)
        return vc ? vc.is_visible : true
      })
      .map(c => ({
        id:       c.id,
        key:      c.col_key,
        label:    c.name,
        kind:     c.kind as CellKind,
        sticky:   c.col_key === 'name',
        editable: c.kind !== 'autonumber' && c.kind !== 'button' && c.kind !== 'formula' && c.kind !== 'rollup' && c.kind !== 'reflejo',
        sortable: true,
        settings: augmentSettings(c, stageColKey, ownerColKey, stages, users),
      }))
  }, [rawCols, stages, users, activeView, stageColKey, ownerColKey])

  // Row[] — derived from rawItems + columns
  const rows = useMemo((): Row[] => {
    return rawItems.map(item => toRow(item, colIdMap, columns, ITEMS_FIELD, refColsMeta, refMap, relationLabelMap, refNestedBoardId))
  }, [rawItems, colIdMap, columns, ITEMS_FIELD, refColsMeta, refMap, relationLabelMap, refNestedBoardId])

  // Fase 19 — filter + sort pipeline (uses effectiveConfig)
  const processedRows = useMemo((): Row[] => {
    const filtered = applyFilters(rows, effectiveConfig.filters, columns)
    const sorted   = applySort(filtered, effectiveConfig.sort)
    return sorted
  }, [rows, effectiveConfig.filters, effectiveConfig.sort, columns])

  // Fase 19 — grouping (undefined → flat mode, uses effectiveConfig)
  const groupedRows = useMemo((): GroupedRows[] | undefined => {
    if (!effectiveConfig.group_by) return undefined
    return groupRows(processedRows, effectiveConfig.group_by, columns, effectiveConfig.group_bucket as DateBucket | undefined)
  }, [processedRows, effectiveConfig.group_by, effectiveConfig.group_bucket, columns])

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback(async (rowId: string, colKey: string, value: CellValue) => {
    // Ref column: write to source item instead of this item
    // NOTE: ref cells are rendered read-only in UI (see RelationCell), so this path
    // is rarely hit. Defensive logic here reads the source item_id from raw item_values
    // (NOT from row.cells which holds the display name after relationLabelMap resolution).
    const refMeta = refColsMeta.find(m => m.col_key === colKey)
    if (refMeta) {
      const currentItem = rawItemsRef.current.find(it => it.id === rowId)
      const relVal = currentItem?.item_values?.find(iv => iv.column_id === refMeta.relation_col_id)?.value_text
      if (typeof relVal !== 'string' || !relVal) {
        console.warn('[ref edit] no source item, skipping')
        return
      }
      const targetColId = refTargetCols[refMeta.target_board_id]?.[refMeta.ref_field_col_key]
      if (!targetColId) {
        console.warn('[ref edit] no target col id')
        return
      }
      // Optimistic update local refMap
      setRefMap(prev => ({
        ...prev,
        [relVal]: { ...(prev[relVal] ?? {}), [refMeta.ref_field_col_key]: value }
      }))
      // PUT to source item
      const res = await fetch(`/api/items/${relVal}/values`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [targetColId]: value }),
      })
      if (!res.ok) {
        console.error('[ref edit] PUT failed')
        // Revert optimistic
        setRefMap(prev => {
          const prev2 = { ...(prev[relVal] ?? {}) }
          delete prev2[refMeta.ref_field_col_key]
          return { ...prev, [relVal]: prev2 }
        })
      }
      return
    }

    // Optimistic update
    setRawItems(prev => prev.map(item => {
      if (item.id !== rowId) return item
      if (colKey in ITEMS_FIELD) {
        return { ...item, [ITEMS_FIELD[colKey]]: value }
      }
      const colId = colIdMap[colKey]
      if (!colId) return item
      const updated: ItemValue = {
        column_id:    colId,
        value_text:   typeof value === 'string' ? value : null,
        value_number: typeof value === 'number' ? value : null,
        value_date:   null,
        value_json:   Array.isArray(value) || typeof value === 'boolean' ? value : null,
      }
      const existing = item.item_values.find(v => v.column_id === colId)
      return {
        ...item,
        item_values: existing
          ? item.item_values.map(v => v.column_id === colId ? updated : v)
          : [...item.item_values, updated],
      }
    }))

    // Persist
    if (colKey in ITEMS_FIELD) {
      const field = ITEMS_FIELD[colKey]
      await fetch(`/api/items/${rowId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: value }),
      })
    } else {
      const colId = colIdMap[colKey]
      if (!colId) return
      await fetch(`/api/items/${rowId}/values`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ column_id: colId, value }),
      })
    }

    // Auto-fill: after saving a relation col, propagate values from source item to empty target fields
    const col = rawCols.find(c => c.col_key === colKey)
    const autoFillTargets = (col?.settings as any)?.auto_fill_targets as Array<{source_col_key: string; target_col_key: string}> | undefined
    const targetBoardIdForAutoFill = (col?.settings as any)?.target_board_id as string | undefined
    if (col?.kind === 'relation' && autoFillTargets?.length && targetBoardIdForAutoFill && value && typeof value === 'string') {
      try {
        const res = await fetch(`/api/items?boardId=${targetBoardIdForAutoFill}&ids=${value}&format=col_keys`)
        if (res.ok) {
          const srcItems = await res.json()
          const srcItem = Array.isArray(srcItems) ? srcItems[0] : null
          const srcValues = srcItem?.col_values ?? {}

          // Get current row state AFTER optimistic update
          const currentRowItem = rawItemsRef.current.find(it => it.id === rowId)
          if (!currentRowItem) return

          for (const { source_col_key, target_col_key } of autoFillTargets) {
            // Find current value of target in this item
            const targetColObj = rawCols.find(c => c.col_key === target_col_key)
            if (!targetColObj) continue
            const targetColId = targetColObj.id
            const currentVal = currentRowItem.item_values?.find(iv => iv.column_id === targetColId)?.value_text
            if (currentVal != null && currentVal !== '') continue  // don't overwrite

            const nextVal = srcValues[source_col_key]
            if (nextVal == null || nextVal === '') continue

            // PUT the auto-filled value
            await fetch(`/api/items/${rowId}/values`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [targetColId]: nextVal }),
            })

            // Optimistic local update
            setRawItems(prev => prev.map(it => {
              if (it.id !== rowId) return it
              const others = (it.item_values ?? []).filter(iv => iv.column_id !== targetColId)
              return {
                ...it,
                item_values: [...others, {
                  column_id: targetColId,
                  value_text: String(nextVal),
                  value_number: null,
                  value_date: null,
                  value_json: null,
                }]
              }
            }))
          }
        }
      } catch (err) {
        console.error('[auto-fill]', err)
      }
    }
  }, [colIdMap, refColsMeta, refTargetCols, rawCols, ITEMS_FIELD])

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleAddColumn = useCallback(async (name: string, kind: string, settings?: Record<string, unknown>) => {
    const res = await fetch(`/api/boards/${boardId}/columns`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, kind, settings: settings ?? {} }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }
    const col = await res.json() as BoardColumn
    setRawCols(prev => [...prev, col])
  }, [boardId])

  const handleNew = async () => {
    const res = await fetch('/api/items', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ board_id: boardId, name: 'Nuevo registro' }),
    })
    if (!res.ok) return
    const item = await res.json() as BoardItem
    setRawItems(prev => [...prev, { ...item, item_values: [] }])
  }

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleBulkDelete = async (ids: string[]) => {
    setRawItems(prev => prev.filter(i => !ids.includes(i.id)))
    await fetch('/api/items/bulk', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids }),
    })
  }

  // ── Inline sub-items expansion ────────────────────────────────────────────
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  const renderRowExpansion = useCallback((rowId: string) => {
    const onDeleteSubItemView = isBoardAdmin ? async (viewId: string) => {
      if (!confirm('¿Eliminar esta vista?')) return
      const res = await fetch(`/api/boards/${boardId}/sub-item-views/${viewId}`, { method: 'DELETE' })
      if (res.ok) setSubItemViews(prev => prev.filter(v => v.id !== viewId))
    } : undefined

    return (
      <div className="max-h-[32rem] overflow-y-auto">
        <SubItemsView
          workspaceSid={workspaceSid}
          itemId={rowId}
          boardId={boardId}
          views={subItemViews}
          users={users}
          compact
          columnsVersion={columnsVersion}
          onCountChange={(count) => handleSubItemCountChange(rowId, count)}
          onAddView={() => setShowViewWizard(true)}
          onDeleteView={onDeleteSubItemView}
          onConfigureColumns={(vId) => { setMapperViewId(vId); setShowMapper(true) }}
          onBoardColumnCreated={() => refreshAll()}
          boardSettings={boardSettings}
          subitemView={subitemView}
          isBoardAdmin={isBoardAdmin}
        />
      </div>
    )
  }, [boardId, subItemViews, users, columnsVersion, isBoardAdmin, boardSettings, subitemView])

  const handleExpandSubItems = useCallback((rowId: string) => {
    setExpandedItemId(prev => prev === rowId ? null : rowId)
  }, [])

  // Update sub_items_count when inline panel changes it
  const handleSubItemCountChange = useCallback((itemId: string, count: number) => {
    setRawItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, sub_items_count: count } : i
    ))
  }, [])

  // Callback to configure sub-item view columns
  const onConfigureColumns = useCallback((vId: string) => {
    setMapperViewId(vId)
    setShowMapper(true)
  }, [])

  // ── Open item detail ───────────────────────────────────────────────────────
  const handleOpenItem = useCallback((rowId: string) => {
    const item = rawItems.find(i => i.id === rowId)
    if (!item?.sid) return
    router.push(`/app/w/${workspaceSid}/b/${boardSid}/${item.sid}`)
  }, [rawItems, boardSid, workspaceSid, router])

  const handleOpenChannels = useCallback((rowId: string) => {
    setChannelsItemId(rowId)
  }, [])

  // ── Channel summary (message count per item) ──────────────────────────────
  const refreshChannelSummary = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}/channel-summary`)
    if (!res.ok) return
    const data = await res.json() as { items: Record<string, { message_count: number; unread_count: number }> }
    setChannelSummary(data.items ?? {})
  }, [boardId])

  useEffect(() => { refreshChannelSummary() }, [refreshChannelSummary])

  // Fetch source items for ref columns
  useEffect(() => {
    if (refColsMeta.length === 0) return
    // Group source ids by target board
    const idsByBoard: Record<string, Set<string>> = {}
    for (const meta of refColsMeta) {
      for (const item of rawItems) {
        const relVal = item.item_values?.find(iv => iv.column_id === meta.relation_col_id)?.value_text
        if (relVal) {
          if (!idsByBoard[meta.target_board_id]) idsByBoard[meta.target_board_id] = new Set()
          idsByBoard[meta.target_board_id].add(relVal)
        }
      }
    }

    // Fetch per target board — parallel requests for items and columns
    const fetches = Object.entries(idsByBoard).map(async ([bid, idsSet]) => {
      const ids = [...idsSet]
      if (ids.length === 0) return { boardId: bid, items: [] as any[], cols: {} as Record<string, string>, targetColsByKey: {} }

      // Parallel fetch: items AND columns at the same time
      const [itemsRes, colsRes] = await Promise.all([
        fetch(`/api/items?boardId=${bid}&ids=${ids.join(',')}&format=col_keys`),
        fetch(`/api/boards/${bid}/columns`),
      ])

      if (!itemsRes.ok) return { boardId: bid, items: [] as any[], cols: {} as Record<string, string>, targetColsByKey: {} }
      const items = await itemsRes.json()
      const cols = colsRes.ok ? await colsRes.json() : []

      const colMap: Record<string, string> = {}
      const targetColsByKey: Record<string, any> = {}
      for (const c of cols) {
        colMap[c.col_key] = c.id
        targetColsByKey[c.col_key] = c
      }
      return { boardId: bid, items, cols: colMap, targetColsByKey }
    })

    Promise.all(fetches).then(results => {
      const map: Record<string, Record<string, unknown>> = {}
      const targetColsByBoard: Record<string, Record<string, string>> = {}
      const nestedMap: Record<string, string> = {}
      for (const { boardId: bid, items, cols, targetColsByKey } of results) {
        targetColsByBoard[bid] = cols
        for (const item of items) {
          map[item.id] = item.col_values ?? {}
        }
      }
      // For each ref col in THIS board, check if its mirrored field is a relation
      for (const meta of refColsMeta) {
        const targetCols = results.find(r => r.boardId === meta.target_board_id)?.targetColsByKey
        const mirroredCol = targetCols?.[meta.ref_field_col_key]
        if (mirroredCol?.kind === 'relation') {
          const nestedBoardId = (mirroredCol.settings as any)?.target_board_id
          if (nestedBoardId) nestedMap[meta.col_key] = nestedBoardId
        }
      }
      setRefMap(map)
      setRefTargetCols(targetColsByBoard)
      setRefNestedBoardId(nestedMap)
    }).catch(err => console.error('[ref fetch]', err))
  }, [rawItems, refColsMeta])

  // ── Refresh items + columns after import (new columns may have been created) ─
  const refreshAll = useCallback(async () => {
    const [itemsRes, colsRes] = await Promise.all([
      fetch(`/api/items?boardId=${boardId}`),
      fetch(`/api/boards/${boardId}/columns`),
    ])
    if (itemsRes.ok) setRawItems(await itemsRes.json() as BoardItem[])
    if (colsRes.ok)  setRawCols(await colsRes.json() as BoardColumn[])
  }, [boardId])


  // ── View handlers ──────────────────────────────────────────────────────────
  const handleCreateView = async () => {
    if (viewSubmittingRef.current) return
    viewSubmittingRef.current = true
    const name = newViewName.trim()
    if (!name) { setAddingView(false); setNewViewName(''); viewSubmittingRef.current = false; return }
    const res = await fetch(`/api/boards/${boardId}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    viewSubmittingRef.current = false
    if (!res.ok) { setAddingView(false); setNewViewName(''); return }
    const view = await res.json() as BoardView
    setViews(prev => [...prev, { ...view, columns: [] }])
    setActiveViewId(view.id)
    setAddingView(false)
    setNewViewName('')
  }

  const handleDeleteView = useCallback(async (viewId: string) => {
    await fetch(`/api/boards/${boardId}/views/${viewId}`, { method: 'DELETE' })
    setViews(prev => prev.filter(v => v.id !== viewId))
    if (activeViewId === viewId) {
      setActiveViewId(prev => views.find(v => v.id !== viewId)?.id ?? null)
    }
  }, [boardId, activeViewId, views])

  const handleRenameView = async (viewId: string) => {
    const name = renameValue.trim()
    if (!name) { setRenamingViewId(null); return }
    await fetch(`/api/boards/${boardId}/views/${viewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setViews(prev => prev.map(v => v.id === viewId ? { ...v, name } : v))
    setRenamingViewId(null)
  }

  const handleToggleColumn = useCallback(async (columnId: string, currentlyVisible: boolean) => {
    if (!activeViewId) return
    const newVisible = !currentlyVisible
    // Optimistic update
    setViews(prev => prev.map(v => {
      if (v.id !== activeViewId) return v
      const existing = v.columns.find(c => c.column_id === columnId)
      if (existing) {
        return { ...v, columns: v.columns.map(c => c.column_id === columnId ? { ...c, is_visible: newVisible } : c) }
      }
      return { ...v, columns: [...v.columns, { id: '', column_id: columnId, is_visible: newVisible, position: 0, width: 200 }] }
    }))
    await fetch(`/api/boards/${boardId}/views/${activeViewId}/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible: newVisible }),
    })
  }, [activeViewId, boardId])

  const loadViewMembers = async (viewId: string) => {
    const membersPromise = viewMembers[viewId] !== undefined
      ? Promise.resolve(null)
      : (async () => {
          setViewMembersLoading(p => ({ ...p, [viewId]: true }))
          try {
            const res = await fetch(`/api/boards/${boardId}/views/${viewId}/members`)
            if (res.ok) { const data = await res.json(); setViewMembers(p => ({ ...p, [viewId]: data })) }
          } finally {
            setViewMembersLoading(p => ({ ...p, [viewId]: false }))
          }
        })()
    const teamsPromise = viewMemberTeamsLoaded
      ? Promise.resolve(null)
      : fetch('/api/teams').then(r => r.ok ? r.json() : []).then(data => {
          setViewMemberTeams(data)
          setViewMemberTeamsLoaded(true)
        })
    await Promise.all([membersPromise, teamsPromise])
  }

  const handleAddViewMember = async (viewId: string) => {
    if (!newViewMemberId) return
    const isTeam = newViewMemberId.startsWith('t:')
    const entityId = newViewMemberId.slice(2)
    const res = await fetch(`/api/boards/${boardId}/views/${viewId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isTeam ? { team_id: entityId } : { user_id: entityId }),
    })
    if (res.ok) {
      const member = await res.json()
      setViewMembers(p => ({ ...p, [viewId]: [...(p[viewId] ?? []), member] }))
      setNewViewMemberId('')
    }
  }

  const handleRemoveViewMember = async (viewId: string, memberId: string) => {
    const res = await fetch(`/api/boards/${boardId}/views/${viewId}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setViewMembers(p => ({ ...p, [viewId]: (p[viewId] ?? []).filter(m => m.id !== memberId) }))
    }
  }

  // ── Supabase Realtime — live item updates for all users on this board ────────
  useEffect(() => {
    const channel = supabase
      .channel(`board-items-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `board_id=eq.${boardId}` },
        async (payload: { eventType: string; old: { id?: string }; new: { id?: string } }) => {
          if (payload.eventType === 'DELETE') {
            setRawItems(prev => prev.filter(i => i.id !== payload.old.id))
            return
          }
          const id = payload.new.id
          if (!id) return
          const res = await fetch(`/api/items/${id}`)
          if (!res.ok) return
          const item = await res.json() as BoardItem
          setRawItems(prev => {
            const exists = prev.some(i => i.id === item.id)
            if (exists) return prev.map(i => i.id === item.id ? item : i)
            return [...prev, item]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [boardId, supabase])

  // ── Supabase Realtime — live column + stage updates ───────────────────────
  useEffect(() => {
    const reloadCols = async () => {
      const res = await fetch(`/api/boards/${boardId}/columns`)
      if (res.ok) setRawCols(await res.json() as BoardColumn[])
    }

    const reloadStages = async () => {
      const res = await fetch(`/api/boards/${boardId}/stages`)
      if (res.ok) setStages(await res.json() as BoardStage[])
    }

    const channel = supabase
      .channel(`board-schema-${boardId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'board_columns', filter: `board_id=eq.${boardId}` },
        () => reloadCols()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'board_stages', filter: `board_id=eq.${boardId}` },
        () => reloadStages()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [boardId, supabase])

  // Close column picker on click outside
  useEffect(() => {
    if (!showColPicker) return
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColPicker])

  // Close view members panel on click outside
  useEffect(() => {
    if (!viewMembersOpen) return
    const handler = (e: MouseEvent) => {
      if (viewMembersPanelRef.current && !viewMembersPanelRef.current.contains(e.target as Node)) {
        setViewMembersOpen(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [viewMembersOpen])

  // Fase 19 — close filter popover on click outside
  useEffect(() => {
    if (!showFilter) return
    const handler = (e: MouseEvent) => {
      if (filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node)) {
        setShowFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFilter])

  // Fase 19 — close sort popover on click outside
  useEffect(() => {
    if (!showSort) return
    const handler = (e: MouseEvent) => {
      if (sortBtnRef.current && !sortBtnRef.current.contains(e.target as Node)) {
        setShowSort(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSort])

  // Fase 19 — close group popover on click outside
  useEffect(() => {
    if (!showGroup) return
    const handler = (e: MouseEvent) => {
      if (groupBtnRef.current && !groupBtnRef.current.contains(e.target as Node)) {
        setShowGroup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showGroup])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Board Header with Stats */}
      <div className="px-8 pt-6 pb-0 border-b border-[var(--border)] bg-[var(--bg)] flex-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 font-[family-name:var(--font-geist-mono)] text-[22px] font-semibold uppercase tracking-wide text-[var(--ink)]">
              {boardName}
            </h1>
            <span className="mt-1 block text-[13px] text-[var(--ink-3)]">
              <b className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--ink)]">{processedRows.length}</b> registros
              {stages.length > 0 && (
                <> · pipeline con <b className="font-[family-name:var(--font-geist-mono)] font-semibold text-[var(--ink)]">{stages.length}</b> etapas</>
              )}
            </span>
          </div>
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => setShowViewWizard(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] rounded-sm border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
                <rect x="1" y="1" width="10" height="10" rx="1.5" strokeWidth="1.3"/>
                <path d="M1 4.5h10M4.5 4.5v6.5" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Sub-items
            </button>

            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] rounded-sm border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                <path d="M6 1v7M3 5l3 3 3-3M1 10h10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Importar
            </button>
            {isBoardAdmin && (
              <a
                href={`/app/w/${workspaceSid}/settings/boards/${boardId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] rounded-sm border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                title="Configuración del board"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
                  <circle cx="6" cy="6" r="2" strokeWidth="1.3"/>
                  <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.4 2.4l1.1 1.1M8.5 8.5l1.1 1.1M2.4 9.6l1.1-1.1M8.5 3.5l1.1-1.1" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Configurar
              </a>
            )}
            {isBoardAdmin && (
              <a
                href={`/app/w/${workspaceSid}/settings/boards/${boardId}?tab=acceso`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] rounded-sm border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
                  <rect x="2.5" y="5.5" width="7" height="5" rx="1" strokeWidth="1.3"/>
                  <path d="M4 5.5V3.5a2 2 0 0 1 4 0v2" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Permisos
              </a>
            )}
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--brand-ink)] bg-[var(--brand)] rounded-sm hover:bg-[var(--brand-deep)]"
            >
              <span className="text-[15px] leading-none">+</span> Nuevo
            </button>
          </div>
        </div>

      </div>

      {/* View tab strip */}
      <div className="flex items-center justify-between gap-3 px-8 py-2.5 border-b border-[var(--border)] bg-[var(--bg)] sticky top-0 z-[5] flex-none">
        {/* left: view tabs */}
        <div className="flex items-center gap-1">
          {views.map(view => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              onDoubleClick={() => { setRenamingViewId(view.id); setRenameValue(view.name) }}
              className={`group relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
                activeViewId === view.id
                  ? 'text-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              } rounded-sm`}
            >
              {/* Grid icon */}
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none opacity-60">
                <rect x="1" y="1" width="4" height="4" rx="0.5" strokeWidth="1.2"/>
                <rect x="7" y="1" width="4" height="4" rx="0.5" strokeWidth="1.2"/>
                <rect x="1" y="7" width="4" height="4" rx="0.5" strokeWidth="1.2"/>
                <rect x="7" y="7" width="4" height="4" rx="0.5" strokeWidth="1.2"/>
              </svg>

              {renamingViewId === view.id ? (
                <input
                  className="text-[12px] border border-[var(--brand-soft)] rounded px-1 py-0 w-24 outline-none bg-[var(--surface)] focus:border-[var(--brand)]"
                  value={renameValue}
                  autoFocus
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameView(view.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameView(view.id)
                    if (e.key === 'Escape') setRenamingViewId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span>{view.name}</span>
              )}

              {/* View members button */}
              <span
                role="button"
                onClick={e => {
                  e.stopPropagation()
                  const next = viewMembersOpen === view.id ? null : view.id
                  setViewMembersOpen(next)
                  if (next) loadViewMembers(view.id)
                }}
                className="ml-0.5 text-[var(--ink-4)] hover:text-[var(--brand)] transition-colors text-[14px] leading-none"
                title="Quién puede ver esta vista"
              >⋯</span>

              {/* Delete button — not on default, board admin only */}
              {!view.is_default && isBoardAdmin && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); handleDeleteView(view.id) }}
                  className="ml-0.5 text-[var(--ink-4)] hover:text-[var(--stage-lost)] transition-colors text-[13px] leading-none"
                >×</span>
              )}
            </button>
          ))}
        </div>

        {/* View members popup */}
        {viewMembersOpen && (
          <div
            ref={viewMembersPanelRef}
            className="absolute top-full left-0 mt-1 w-72 bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-30 p-3"
            style={{ left: '8px' }}
          >
            <p className="text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide mb-2">
              Acceso a esta vista
            </p>
            {viewMembersLoading[viewMembersOpen] ? (
              <p className="text-xs text-[var(--ink-3)]">Cargando...</p>
            ) : (viewMembers[viewMembersOpen] ?? []).length === 0 ? (
              <p className="text-xs text-[var(--ink-3)] mb-3">Sin restricción — todos los miembros del board pueden ver esta vista</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {(viewMembers[viewMembersOpen] ?? []).map(m => {
                  const name = m.users?.name ?? m.teams?.name ?? 'Desconocido'
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-[var(--ink)]">{name}</span>
                      <button
                        onClick={() => handleRemoveViewMember(viewMembersOpen, m.id)}
                        className="text-[var(--ink-4)] hover:text-[var(--stage-lost)] text-[13px] leading-none"
                      >×</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={newViewMemberId}
                onChange={e => setNewViewMemberId(e.target.value)}
                className="flex-1 border border-[var(--border)] rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--brand-soft)] bg-[var(--surface)] text-[var(--ink)]"
              >
                <option value="">Miembro o equipo...</option>
                {users.filter(u => !(viewMembers[viewMembersOpen] ?? []).some(m => m.user_id === u.id)).length > 0 && (
                  <optgroup label="Miembros">
                    {users
                      .filter(u => !(viewMembers[viewMembersOpen] ?? []).some(m => m.user_id === u.id))
                      .map(u => <option key={u.id} value={`u:${u.id}`}>{u.name ?? u.phone ?? 'Usuario'}</option>)
                    }
                  </optgroup>
                )}
                {viewMemberTeams.filter(t => !(viewMembers[viewMembersOpen] ?? []).some(m => m.team_id === t.id)).length > 0 && (
                  <optgroup label="Equipos">
                    {viewMemberTeams
                      .filter(t => !(viewMembers[viewMembersOpen] ?? []).some(m => m.team_id === t.id))
                      .map(t => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)
                    }
                  </optgroup>
                )}
              </select>
              <button
                onClick={() => handleAddViewMember(viewMembersOpen)}
                disabled={!newViewMemberId}
                className="px-2.5 py-1 bg-[var(--brand)] text-[var(--brand-ink)] text-xs rounded-sm hover:bg-[var(--brand-deep)] disabled:opacity-50"
              >+</button>
            </div>
          </div>
        )}

        {/* New view input or button */}
        {addingView ? (
          <div className="flex items-center px-2 py-1">
            <input
              ref={newViewInputRef}
              value={newViewName}
              autoFocus
              onChange={e => setNewViewName(e.target.value)}
              onBlur={handleCreateView}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateView()
                if (e.key === 'Escape') { setAddingView(false); setNewViewName('') }
              }}
              placeholder="Nombre de vista"
              className="text-[12px] border border-[var(--brand-soft)] rounded-sm px-2 py-0.5 w-32 outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
            />
          </div>
        ) : isBoardAdmin ? (
          <button
            onClick={() => setAddingView(true)}
            className="flex items-center gap-1 px-2.5 py-2 text-[12px] text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
              <path d="M5 1v8M1 5h8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Nueva vista</span>
          </button>
        ) : null}

        <div className="flex-1" />

        {/* Fase 19 — Filter button (subheader style) */}
        <div className="relative py-1" ref={filterBtnRef}>
          <button
            onClick={() => setShowFilter(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-sm transition-colors ${showFilter || (effectiveConfig.filters?.length ?? 0) > 0 ? 'text-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
              <path d="M1 2h10l-3.5 4.5V11L4.5 9.5V6.5L1 2z" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
            Filtrar
            {(effectiveConfig.filters?.length ?? 0) > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-[var(--brand)] text-[var(--brand-ink)] rounded-full px-1.5 leading-none py-0.5">{effectiveConfig.filters?.length}</span>
            )}
          </button>
          {showFilter && activeView && (
            <div className="absolute top-full left-0 mt-1 z-40">
              <FilterPanel
                columns={columns}
                filters={effectiveConfig.filters ?? []}
                onChange={handleFiltersChange}
                onClose={() => setShowFilter(false)}
              />
            </div>
          )}
        </div>

        {/* Fase 19 — Sort button (subheader style) */}
        <div className="relative py-1" ref={sortBtnRef}>
          <button
            onClick={() => setShowSort(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-sm transition-colors ${showSort || (effectiveConfig.sort?.length ?? 0) > 0 ? 'text-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
              <path d="M3 2v8M1 8l2 2 2-2M9 10V2M7 4l2-2 2 2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ordenar
            {(effectiveConfig.sort?.length ?? 0) > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-[var(--brand)] text-[var(--brand-ink)] rounded-full px-1.5 leading-none py-0.5">{effectiveConfig.sort?.length}</span>
            )}
          </button>
          {showSort && activeView && (
            <div className="absolute top-full left-0 mt-1 z-40">
              <SortPanel
                columns={columns}
                sorts={effectiveConfig.sort ?? []}
                onChange={handleSortsChange}
                onClose={() => setShowSort(false)}
              />
            </div>
          )}
        </div>

        {/* Fase 19 — Group button (subheader style) */}
        <div className="relative py-1" ref={groupBtnRef}>
          <button
            onClick={() => setShowGroup(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-sm transition-colors ${showGroup || effectiveConfig.group_by ? 'text-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
              <path d="M1 2h4M1 5h4M1 8h4M7 2h4M7 5h4M7 8h4" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Agrupar
            {effectiveConfig.group_by && (
              <span className="ml-1 text-[10px] font-bold bg-[var(--brand)] text-[var(--brand-ink)] rounded-full px-1.5 leading-none py-0.5">1</span>
            )}
          </button>
          {showGroup && activeView && (
            <div className="absolute top-full left-0 mt-1 z-40">
              <GroupPanel
                columns={columns}
                groupBy={effectiveConfig.group_by ?? null}
                groupBucket={effectiveConfig.group_bucket as DateBucket | undefined}
                onChange={handleGroupChange}
                onClose={() => setShowGroup(false)}
              />
            </div>
          )}
        </div>

        {/* Fase 19 — local changes indicator and save/discard buttons */}
        {hasLocalChanges && (
          <>
            <span className="mx-1 text-[var(--ink-4)] text-[12px]">·</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[var(--brand-deep)] bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface)_90%)] rounded-sm"
              title="Estos cambios solo aplican para ti. Guárdalos en la vista para que todos los vean."
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
              Aplicado solo para ti
            </span>
            {isBoardAdmin && (
              <button
                onClick={handleSaveToView}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-[var(--brand-ink)] bg-[var(--brand)] rounded-sm hover:bg-[var(--brand-deep)] transition-colors"
                title="Persistir en la vista — todos los miembros del board lo verán"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
                  <path d="M2 3v7h8V5L8 3H2z M4 3v2h3V3 M4 8h4" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
                </svg>
                Guardar en vista
              </button>
            )}
            <button
              onClick={handleDiscardLocal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] rounded-sm hover:bg-[var(--surface-2)] transition-colors"
              title="Volver a lo guardado en la vista"
            >
              Descartar
            </button>
          </>
        )}

        {/* Column picker */}
        <div className="relative py-1" ref={colPickerRef}>
          <button
            onClick={() => setShowColPicker(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-sm transition-colors ${
              showColPicker ? 'text-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface)_92%)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M1 3h10M1 6h10M1 9h10" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4" cy="3" r="1.5" fill="currentColor" strokeWidth="1.2" opacity="0.3"/>
              <circle cx="8" cy="6" r="1.5" fill="currentColor" strokeWidth="1.2" opacity="0.3"/>
              <circle cx="4" cy="9" r="1.5" fill="currentColor" strokeWidth="1.2" opacity="0.3"/>
            </svg>
            Columnas
          </button>

          {showColPicker && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--bg)] border border-[var(--border)] rounded-sm shadow-lg z-20 py-1 max-h-96 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-4)] uppercase tracking-wide border-b border-[var(--border)] mb-1">
                Columnas visibles
              </div>
              {rawCols.filter(c => !c.is_hidden).map(col => {
                const vc = activeView?.columns.find(vc => vc.column_id === col.id)
                const isVisible = vc ? vc.is_visible : true
                return (
                  <div key={col.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface-2)]">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleToggleColumn(col.id, isVisible)}
                      className="rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand-soft)] w-3.5 h-3.5 shrink-0 accent-[var(--brand)]"
                    />
                    <span
                      className="text-[12px] text-[var(--ink)] flex-1 truncate cursor-pointer"
                      onClick={() => handleToggleColumn(col.id, isVisible)}
                    >{col.name}</span>
                    <span className="text-[10px] text-[var(--ink-4)] uppercase tracking-wide shrink-0">{col.kind.slice(0,4)}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setColSettingsCol(col)
                        setShowColPicker(false)
                      }}
                      className="shrink-0 text-[14px] leading-none transition-colors text-[var(--ink-4)] hover:text-[var(--brand)]"
                      title="Configurar columna"
                    >⋯</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table with inline expansion */}
      <div className="flex-1 overflow-hidden">
        <GenericDataTable
          columns={columns}
          rows={processedRows}
          groups={groupedRows}
          groupedStorageKey={`${boardId}-${activeViewId ?? 'default'}`}
          storageKey={`${boardId}-${activeViewId ?? 'default'}`}
          onCellChange={handleCellChange}
          onExpandSubItems={handleExpandSubItems}
          expandedSubItemId={expandedItemId}
          renderRowExpansion={renderRowExpansion}
          onOpenItem={handleOpenItem}
          onOpenChannels={handleOpenChannels}
          channelSummary={channelSummary}
          onBulkDelete={handleBulkDelete}
          onColumnSettings={colKey => {
            const col = rawCols.find(c => c.col_key === colKey)
            if (col) setColSettingsCol(col)
          }}
          onAddColumn={isBoardAdmin ? handleAddColumn : undefined}
          loading={false}
        />
      </div>

      {/* Channels modal */}
      {channelsItemId && (
        <ItemChannelsModal
          itemId={channelsItemId}
          itemName={rawItems.find(i => i.id === channelsItemId)?.name}
          workspaceUsers={users}
          onClose={() => { setChannelsItemId(null); refreshChannelSummary() }}
        />
      )}

      {/* SubItemViewWizard modal */}
      {showViewWizard && (
        <SubItemViewWizard
          boardId={boardId}
          existingViews={subItemViews}
          onClose={() => setShowViewWizard(false)}
          onCreated={(newView, snapshotBoardId) => {
            setSubItemViews(prev => [...prev, newView])
            if (snapshotBoardId) setSourceBoardId(snapshotBoardId)
            setShowViewWizard(false)
          }}
        />
      )}

      {/* SourceColumnMapper modal */}
      {showMapper && (
        <SourceColumnMapper
          boardId={boardId}
          viewId={mapperViewId}
          currentSourceBoardId={
            (subItemViews.find(v => v.id === mapperViewId)?.config?.source_board_id as string | undefined)
              ?? sourceBoardId
          }
          currentColumns={subItemColumns}
          onClose={() => setShowMapper(false)}
          onSaved={(newSourceId, newCols) => {
            setSourceBoardId(newSourceId)
            setSubItemColumns(prev => [...prev, ...newCols])
            setColumnsVersion(v => v + 1)
            setShowMapper(false)
          }}
        />
      )}

      {/* ImportWizard modal */}
      {showImport && (
        <ImportWizard
          boardId={boardId}
          boardColumns={rawCols}
          onClose={() => setShowImport(false)}
          onImported={async (_count) => {
            setShowImport(false)
            await refreshAll()
          }}
        />
      )}

      {/* ColumnSettingsPanel drawer */}
      {colSettingsCol && (
        <ColumnSettingsPanel
          column={{
            ...colSettingsCol,
            // Merge augmented settings (e.g. stage options from board_stages, owner options from users)
            settings: columns.find(c => c.id === colSettingsCol.id)?.settings ?? colSettingsCol.settings,
          }}
          boardId={boardId}
          allColumns={rawCols.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind, settings: c.settings ?? {} }))}
          users={users}
          permissionsEndpoint={`/api/boards/${boardId}/columns/${colSettingsCol.id}/permissions`}
          onClose={() => setColSettingsCol(null)}
          onPatched={updated => { setRawCols(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)) }}
          onUpdated={updated => {
            setRawCols(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
            setColSettingsCol(null)
          }}
          onDeleted={colId => setRawCols(prev => prev.filter(c => c.id !== colId))}
        />
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function augmentSettings(col: BoardColumn, stageColKey: string, ownerColKey: string, stages: BoardStage[], users: WorkspaceUser[]): ColumnSettings {
  const base = (col.settings ?? {}) as ColumnSettings
  if (col.col_key === stageColKey) {
    return {
      ...base,
      options: stages
        .slice().sort((a, b) => a.position - b.position)
        .map(s => ({ value: s.id, label: s.name, color: s.color ?? '#94a3b8' })),
    }
  }
  if (col.col_key === ownerColKey) {
    return {
      ...base,
      options: users.map(u => ({ value: u.id, label: u.name ?? u.phone ?? 'Usuario' })),
    }
  }
  return base
}

function toRow(
  item: BoardItem,
  colIdMap: Record<string, string>,
  cols: ColumnDef[],
  itemsField: Record<string, keyof BoardItem>,
  refColsMeta: any[],
  refMap: Record<string, Record<string, unknown>>,
  relationLabelMap: Record<string, Record<string, string>>,
  refNestedBoardId: Record<string, string>
): Row {
  const cells: Record<string, CellValue> = {}
  for (const col of cols) {
    {
      // Autonumber con source='sid' → leer de items.sid (col custom "ID del sistema")
      if (col.kind === 'autonumber' && (col.settings as any)?.source === 'sid') {
        cells[col.key] = item.sid
        continue
      }

      // Relation column: resolve id → name from label map (fallback to null to avoid UUID flash)
      if (col.kind === 'relation') {
        const colId = colIdMap[col.key]
        const v = item.item_values?.find(iv => iv.column_id === colId)
        const targetId = (v?.value_text ?? null) as string | null
        const targetBoardId = (col as any).settings?.target_board_id as string | undefined
        if (targetId && targetBoardId) {
          const resolved = relationLabelMap[targetBoardId]?.[targetId]
          cells[col.key] = (resolved ?? null) as any
        } else {
          cells[col.key] = null
        }
        continue
      }

      // Ref column: read from refMap based on relation
      const refMeta = refColsMeta.find(m => m.col_key === col.key)
      if (refMeta) {
        const relVal = item.item_values?.find(iv => iv.column_id === refMeta.relation_col_id)?.value_text
        const rawValue = (relVal && refMap[relVal]?.[refMeta.ref_field_col_key]) ?? null
        // If the mirrored field is itself a relation, resolve item_id → name (fallback null, no UUID leak)
        const nestedBoardId = refNestedBoardId[col.key]
        if (nestedBoardId && rawValue && typeof rawValue === 'string') {
          const resolved = relationLabelMap[nestedBoardId]?.[rawValue]
          cells[col.key] = (resolved ?? null) as CellValue
        } else {
          cells[col.key] = rawValue as CellValue
        }
        continue
      }

      if (col.key in itemsField) {
        cells[col.key] = (item[itemsField[col.key]] ?? null) as CellValue
      } else {
        const colId = colIdMap[col.key]
        const v = item.item_values?.find(iv => iv.column_id === colId)
        cells[col.key] = v
          ? (v.value_text ?? v.value_number ?? v.value_date ?? (v.value_json !== null ? v.value_json as CellValue : null))
          : null
      }
    }
  }

  // Post-process rollup columns first (so formulas can reference them)
  for (const col of cols) {
    if (col.kind === 'rollup') {
      cells[col.key] = (item as typeof item & { sub_items_rollup?: Record<string, number | null> }).sub_items_rollup?.[col.key] ?? null
    }
  }

  // Post-process formula columns — compute values from other cells (rollups already in cells)
  for (const col of cols) {
    if (col.kind === 'formula' && col.settings.formula_config) {
      const result = computeFormula(
        col.settings.formula_config as FormulaConfig,
        cells as Record<string, unknown>
      )
      cells[col.key] = result
    }
  }

  const count = item.sub_items_count ?? 0
  return { id: item.id, sid: item.sid, cells, hasSubItems: count > 0, subItemsCount: count }
}
