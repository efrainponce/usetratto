'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GenericDataTable } from '@/components/data-table/GenericDataTable'
import { SubItemsView } from '@/components/SubItemsView'
import { SourceColumnMapper } from '@/components/SourceColumnMapper'
import { ImportWizard } from '@/components/import/ImportWizard'
import { ColumnSettingsPanel } from '@/components/ColumnSettingsPanel'
import type { ColumnDef, Row, CellValue, CellKind, ColumnSettings } from '@/components/data-table/types'
import { SubItemViewWizard } from '@/components/SubItemViewWizard'
import type { BoardStage, BoardColumn, WorkspaceUser, BoardItem, ItemValue, SubItemColumn, BoardView, SubItemView } from '@/lib/boards'
import { getPrimaryStageColKey, getOwnerColKey } from '@/lib/boards/helpers'
import { computeFormula, type FormulaConfig } from '@/lib/formula-engine'

// ─── Column permission type ───────────────────────────────────────────────────
type ColPermission = {
  id: string
  user_id: string | null
  team_id: string | null
  access: 'view' | 'edit'
  users?: { id: string; sid: number; name: string }
  teams?: { id: string; sid: number; name: string }
}

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
    name:     'name',
    [stageColKey]: 'stage_id',
    [ownerColKey]: 'owner_id',
    deadline: 'deadline',
  }
}

// Virtual sid column (prepended, not in board_columns)
const SID_COL: ColumnDef = {
  key:      '__sid',
  label:    'ID',
  kind:     'autonumber',
  editable: false,
  sortable: false,
  settings: {},
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
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
  boardId, boardSid, boardName,
  initialStages, initialColumns, initialUsers, initialItems,
  initialSubItemColumns, initialSourceBoardId, initialViews, initialSubItemViews,
  boardSettings, subitemView, userRole, isBoardAdmin,
}: Props) {
  const router = useRouter()
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'

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

  // col_key → column UUID  (for item_values lookups)
  const colIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    rawCols.forEach(c => { map[c.col_key] = c.id })
    return map
  }, [rawCols])

  // Active view lookup
  const activeView = views.find(v => v.id === activeViewId) ?? null

  // ColumnDef[] — virtual __sid first, then board columns
  const columns = useMemo((): ColumnDef[] => {
    const dataCols: ColumnDef[] = rawCols
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
        editable: c.kind !== 'autonumber' && c.kind !== 'button' && c.kind !== 'formula' && c.kind !== 'rollup',
        sortable: true,
        settings: augmentSettings(c, stageColKey, ownerColKey, stages, users),
      }))
    return [SID_COL, ...dataCols]
  }, [rawCols, stages, users, activeView, stageColKey, ownerColKey])

  // Row[] — derived from rawItems + columns
  const rows = useMemo((): Row[] => {
    return rawItems.map(item => toRow(item, colIdMap, columns, ITEMS_FIELD, refColsMeta, refMap))
  }, [rawItems, colIdMap, columns, ITEMS_FIELD, refColsMeta, refMap])

  // ── Cell change ────────────────────────────────────────────────────────────
  const handleCellChange = useCallback(async (rowId: string, colKey: string, value: CellValue) => {
    if (colKey === '__sid') return

    // Ref column: write to source item instead of this item
    const refMeta = refColsMeta.find(m => m.col_key === colKey)
    if (refMeta) {
      const row = rows.find(r => r.id === rowId)
      const relVal = row?.cells[refMeta.relation_col_key]
      if (typeof relVal !== 'string') {
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
  }, [colIdMap, refColsMeta, refTargetCols, rows])

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleAddColumn = useCallback(async (name: string, kind: string) => {
    const res = await fetch(`/api/boards/${boardId}/columns`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, kind }),
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

  const handleExpandSubItems = useCallback((rowId: string) => {
    setExpandedItemId(prev => prev === rowId ? null : rowId)
  }, [])

  // Update sub_items_count when inline panel changes it
  const handleSubItemCountChange = useCallback((itemId: string, count: number) => {
    setRawItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, sub_items_count: count } : i
    ))
  }, [])

  // ── Open item detail ───────────────────────────────────────────────────────
  const handleOpenItem = useCallback((rowId: string) => {
    const item = rawItems.find(i => i.id === rowId)
    if (!item?.sid) return
    router.push(`/app/b/${boardSid}/${item.sid}`)
  }, [rawItems, boardSid, router])

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

    // Fetch per target board
    const fetches = Object.entries(idsByBoard).map(async ([bid, idsSet]) => {
      const ids = [...idsSet]
      if (ids.length === 0) return { boardId: bid, items: [] as any[], cols: {} as Record<string, string> }
      const res = await fetch(`/api/items?boardId=${bid}&ids=${ids.join(',')}&format=col_keys`)
      if (!res.ok) return { boardId: bid, items: [] as any[], cols: {} as Record<string, string> }
      const items = await res.json()
      // Also fetch board columns for col_key → column_id map (for PUT on edit)
      const colsRes = await fetch(`/api/boards/${bid}/columns`)
      const cols = colsRes.ok ? await colsRes.json() : []
      const colMap: Record<string, string> = {}
      for (const c of cols) colMap[c.col_key] = c.id
      return { boardId: bid, items, cols: colMap }
    })

    Promise.all(fetches).then(results => {
      const map: Record<string, Record<string, unknown>> = {}
      const targetColsByBoard: Record<string, Record<string, string>> = {}
      for (const { boardId: bid, items, cols } of results) {
        targetColsByBoard[bid] = cols
        for (const item of items) {
          map[item.id] = item.col_values ?? {}
        }
      }
      setRefMap(map)
      setRefTargetCols(targetColsByBoard)
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

  const handleDeleteView = async (viewId: string) => {
    await fetch(`/api/boards/${boardId}/views/${viewId}`, { method: 'DELETE' })
    setViews(prev => prev.filter(v => v.id !== viewId))
    if (activeViewId === viewId) {
      setActiveViewId(views.find(v => v.id !== viewId)?.id ?? null)
    }
  }

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

  const handleToggleColumn = async (columnId: string, currentlyVisible: boolean) => {
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
  }

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
    const supabase = createClient()
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
  }, [boardId])

  // ── Supabase Realtime — live column + stage updates ───────────────────────
  useEffect(() => {
    const supabase = createClient()

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
  }, [boardId])

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 flex-none">
        <h1 className="text-[14px] font-semibold text-gray-800">{boardName}</h1>
        <div className="flex-1" />
        <button
          onClick={() => setShowViewWizard(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current flex-none">
            <rect x="1" y="1" width="10" height="10" rx="1.5" strokeWidth="1.3"/>
            <path d="M1 4.5h10M4.5 4.5v6.5" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Sub-items
          {subItemViews.length > 0 && (
            <span className="flex items-center gap-1 ml-0.5">
              {subItemViews.slice(0, 3).map(v => (
                <span key={v.id} className="px-1.5 py-0 rounded bg-gray-100 text-gray-500 text-[10px] font-medium">
                  {v.name}
                </span>
              ))}
              {subItemViews.length > 3 && (
                <span className="px-1.5 py-0 rounded bg-gray-100 text-gray-400 text-[10px]">
                  +{subItemViews.length - 3}
                </span>
              )}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
            <path d="M6 1v7M3 5l3 3 3-3M1 10h10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Importar
        </button>
        {isBoardAdmin && (
          <a
            href={`/app/settings/boards/${boardId}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            title="Configuración del board"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <circle cx="6" cy="6" r="2" strokeWidth="1.3"/>
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.4 2.4l1.1 1.1M8.5 8.5l1.1 1.1M2.4 9.6l1.1-1.1M8.5 3.5l1.1-1.1" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Configurar
          </a>
        )}

        {/* Permissions — link to board access settings */}
        {isBoardAdmin && (
          <a
            href={`/app/settings/boards/${boardId}?tab=acceso`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <rect x="2.5" y="5.5" width="7" height="5" rx="1" strokeWidth="1.3"/>
              <path d="M4 5.5V3.5a2 2 0 0 1 4 0v2" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Permisos
          </a>
        )}

        <span className="text-[12px] text-gray-400">
          {rows.length} registro{rows.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-medium rounded-md hover:bg-indigo-700 transition-colors"
        >
          <span className="text-[15px] leading-none">+</span> Nuevo
        </button>
      </div>

      {/* View tab strip */}
      <div className="relative flex items-center gap-0 px-4 border-b border-gray-100 flex-none bg-white">
        {views.map(view => (
          <button
            key={view.id}
            onClick={() => setActiveViewId(view.id)}
            onDoubleClick={() => { setRenamingViewId(view.id); setRenameValue(view.name) }}
            className={`group relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium transition-colors ${
              activeViewId === view.id
                ? 'text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
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
                className="text-[12px] border border-indigo-300 rounded px-1 py-0 w-24 outline-none"
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
              className="ml-0.5 text-gray-300 hover:text-indigo-500 transition-colors text-[14px] leading-none"
              title="Quién puede ver esta vista"
            >⋯</span>

            {/* Delete button — not on default, board admin only */}
            {!view.is_default && isBoardAdmin && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); handleDeleteView(view.id) }}
                className="ml-0.5 text-gray-300 hover:text-red-500 transition-colors text-[13px] leading-none"
              >×</span>
            )}

            {/* Active underline */}
            {activeViewId === view.id && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-indigo-500 rounded-t" />
            )}
          </button>
        ))}

        {/* View members popup */}
        {viewMembersOpen && (
          <div
            ref={viewMembersPanelRef}
            className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-3"
            style={{ left: '8px' }}
          >
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Acceso a esta vista
            </p>
            {viewMembersLoading[viewMembersOpen] ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : (viewMembers[viewMembersOpen] ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 mb-3">Sin restricción — todos los miembros del board pueden ver esta vista</p>
            ) : (
              <div className="space-y-1.5 mb-3">
                {(viewMembers[viewMembersOpen] ?? []).map(m => {
                  const name = m.users?.name ?? m.teams?.name ?? 'Desconocido'
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="flex-1 text-[12px] text-gray-700">{name}</span>
                      <button
                        onClick={() => handleRemoveViewMember(viewMembersOpen, m.id)}
                        className="text-gray-300 hover:text-red-500 text-[13px] leading-none"
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
                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
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
                className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
              className="text-[12px] border border-indigo-300 rounded px-2 py-0.5 w-32 outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </div>
        ) : isBoardAdmin ? (
          <button
            onClick={() => setAddingView(true)}
            className="flex items-center gap-1 px-2.5 py-2 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="stroke-current">
              <path d="M5 1v8M1 5h8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Nueva vista</span>
          </button>
        ) : null}

        <div className="flex-1" />

        {/* Column picker */}
        <div className="relative py-1" ref={colPickerRef}>
          <button
            onClick={() => setShowColPicker(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] rounded-md transition-colors ${
              showColPicker ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="stroke-current">
              <path d="M1 3h10M1 6h10M1 9h10" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4" cy="3" r="1.5" fill="white" strokeWidth="1.2"/>
              <circle cx="8" cy="6" r="1.5" fill="white" strokeWidth="1.2"/>
              <circle cx="4" cy="9" r="1.5" fill="white" strokeWidth="1.2"/>
            </svg>
            Columnas
          </button>

          {showColPicker && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-96 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 mb-1">
                Columnas visibles
              </div>
              {rawCols.filter(c => !c.is_hidden).map(col => {
                const vc = activeView?.columns.find(vc => vc.column_id === col.id)
                const isVisible = vc ? vc.is_visible : true
                return (
                  <div key={col.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleToggleColumn(col.id, isVisible)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 shrink-0"
                    />
                    <span
                      className="text-[12px] text-gray-700 flex-1 truncate cursor-pointer"
                      onClick={() => handleToggleColumn(col.id, isVisible)}
                    >{col.name}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">{col.kind.slice(0,4)}</span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setColSettingsCol(col)
                        setShowColPicker(false)
                      }}
                      className="shrink-0 text-[14px] leading-none transition-colors text-gray-300 hover:text-indigo-500"
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
          rows={rows}
          storageKey={`${boardId}-${activeViewId ?? 'default'}`}
          onCellChange={handleCellChange}
          onExpandSubItems={handleExpandSubItems}
          expandedSubItemId={expandedItemId}
          renderRowExpansion={(rowId) => (
            <div className="max-h-56 overflow-y-auto">
              <SubItemsView
                itemId={rowId}
                boardId={boardId}
                views={subItemViews}
                users={users}
                compact
                columnsVersion={columnsVersion}
                onCountChange={(count) => handleSubItemCountChange(rowId, count)}
                onAddView={() => setShowViewWizard(true)}
                onDeleteView={isBoardAdmin ? async (viewId) => {
                  if (!confirm('¿Eliminar esta vista?')) return
                  const res = await fetch(`/api/boards/${boardId}/sub-item-views/${viewId}`, { method: 'DELETE' })
                  if (res.ok) setSubItemViews(prev => prev.filter(v => v.id !== viewId))
                } : undefined}
                onConfigureColumns={(vId) => { setMapperViewId(vId); setShowMapper(true) }}
                onBoardColumnCreated={() => refreshAll()}
                boardSettings={boardSettings}
                subitemView={subitemView}
                isBoardAdmin={isBoardAdmin}
              />
            </div>
          )}
          onOpenItem={handleOpenItem}
          onBulkDelete={handleBulkDelete}
          onColumnSettings={colKey => {
            const col = rawCols.find(c => c.col_key === colKey)
            if (col) setColSettingsCol(col)
          }}
          onAddColumn={isBoardAdmin ? handleAddColumn : undefined}
          loading={false}
        />
      </div>

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
          currentSourceBoardId={sourceBoardId}
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
  refMap: Record<string, Record<string, unknown>>
): Row {
  const cells: Record<string, CellValue> = {}
  for (const col of cols) {
    if (col.key === '__sid') {
      cells[col.key] = item.sid
    } else {
      // Ref column: read from refMap based on relation
      const refMeta = refColsMeta.find(m => m.col_key === col.key)
      if (refMeta) {
        const relVal = item.item_values?.find(iv => iv.column_id === refMeta.relation_col_id)?.value_text
        cells[col.key] = ((relVal && refMap[relVal]?.[refMeta.ref_field_col_key]) ?? null) as CellValue
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
