'use client'

import React, { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ColumnSettingsPanel } from '@/components/ColumnSettingsPanel'

type Stage = {
  id: string
  sid: number
  name: string
  color: string
  position: number
  is_closed: boolean
}


type Column = {
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

type Member = {
  id: string
  access: 'view' | 'edit'
  restrict_to_own: boolean
  user_id: string | null
  team_id: string | null
  users?: { id: string; sid: number; name: string }
  teams?: { id: string; sid: number; name: string }
}

type WorkspaceUser = {
  id: string
  sid: number
  name: string
  phone?: string
  role: string
}

type Board = {
  id: string
  sid: number
  slug: string
  name: string
  type: string
  system_key: string | null
  description?: string
  stages?: Stage[]
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#6b7280', // gray
]


export default function BoardSettingsPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params)
  const router = useRouter()

  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([])
  const [workspaceTeams, setWorkspaceTeams] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<'etapas' | 'columnas' | 'acceso' | 'sub-items'>('etapas')
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingStageName, setEditingStageName] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [newStageColor, setNewStageColor] = useState('#3b82f6')
  const [showNewStageForm, setShowNewStageForm] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [selectedMemberAccess, setSelectedMemberAccess] = useState<'view' | 'edit'>('edit')
  const [selectedMemberId, setSelectedMemberId] = useState('')   // 'u:<uuid>' | 't:<uuid>'
  const [isSaving, setIsSaving] = useState(false)

  const [colSettingsId, setColSettingsId] = useState<string | null>(null)

  // ── Sub-item views state ─────────────────────────────────────────────
  type SubItemViewType = 'native' | 'board_items' | 'board_sub_items'
  type SubItemView = { id: string; sid: number; name: string; position: number; type: SubItemViewType; config: Record<string, unknown> }

  const [subItemViews,          setSubItemViews]          = useState<SubItemView[]>([])
  const [isAdmin,               setIsAdmin]               = useState(false)
  const [viewFormOpen,          setViewFormOpen]          = useState(false)
  const [viewFormName,          setViewFormName]          = useState('')
  const [viewFormType,          setViewFormType]          = useState<SubItemViewType>('native')
  const [viewFormSourceBoardId, setViewFormSourceBoardId] = useState('')
  const [viewFormRelColId,      setViewFormRelColId]      = useState('')
  const [allBoards,             setAllBoards]             = useState<Board[]>([])
  const [sourceBoardCols,       setSourceBoardCols]       = useState<Column[]>([])

  // Fetch columns of selected source board
  useEffect(() => {
    if (!viewFormSourceBoardId || viewFormType === 'native') { setSourceBoardCols([]); return }
    fetch(`/api/boards/${viewFormSourceBoardId}/columns`)
      .then(r => r.json())
      .then(data => setSourceBoardCols(Array.isArray(data) ? data : []))
      .catch(() => setSourceBoardCols([]))
  }, [viewFormSourceBoardId, viewFormType])

  async function handleCreateSubItemView(e: React.FormEvent) {
    e.preventDefault()
    if (!viewFormName.trim()) return
    const config: Record<string, unknown> = {}
    if (viewFormType !== 'native') {
      if (!viewFormSourceBoardId || !viewFormRelColId) return
      config.source_board_id = viewFormSourceBoardId
      config.relation_col_id = viewFormRelColId
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/sub-item-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: viewFormName.trim(), type: viewFormType, config }),
      })
      if (res.ok) {
        const view = await res.json()
        setSubItemViews(prev => [...prev, view])
        setViewFormOpen(false); setViewFormName(''); setViewFormType('native')
        setViewFormSourceBoardId(''); setViewFormRelColId('')
      }
    } finally { setIsSaving(false) }
  }

  async function handleDeleteSubItemView(viewId: string) {
    if (!confirm('¿Eliminar esta vista de sub-items?')) return
    const res = await fetch(`/api/boards/${boardId}/sub-item-views/${viewId}`, { method: 'DELETE' })
    if (res.ok) setSubItemViews(prev => prev.filter(v => v.id !== viewId))
    else if (res.status === 400) alert('No puedes eliminar la última vista')
  }

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [boardRes, colRes, membersRes, usersRes, teamsRes, viewsRes, allBoardsRes] = await Promise.all([
          fetch(`/api/boards/${boardId}`),
          fetch(`/api/boards/${boardId}/columns`),
          fetch(`/api/boards/${boardId}/members`),
          fetch('/api/workspace-users'),
          fetch('/api/teams'),
          fetch(`/api/boards/${boardId}/sub-item-views`),
          fetch('/api/boards'),
        ])

        const [boardData, colData, membersData, usersData, teamsData, viewsData, allBoardsData] = await Promise.all([
          boardRes.json(), colRes.json(), membersRes.json(),
          usersRes.json(), teamsRes.json(), viewsRes.json(), allBoardsRes.json(),
        ])

        if (boardRes.ok) setBoard(boardData)
        if (colRes.ok) setColumns(colData)
        if (membersRes.ok) { setMembers(membersData); setIsPublic(membersData.length === 0) }
        if (usersRes.ok) setWorkspaceUsers(usersData)
        if (teamsRes.ok) setWorkspaceTeams(teamsData)
        if (viewsRes.ok) setSubItemViews(Array.isArray(viewsData) ? viewsData : [])
        if (allBoardsRes.ok) setAllBoards(Array.isArray(allBoardsData) ? allBoardsData : [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    fetch('/api/users/me').then(r => r.ok ? r.json() : {}).then((d: { role?: string }) => {
      setIsAdmin(d.role === 'admin' || d.role === 'superadmin')
    })
  }, [boardId])

  // ─── Stage handlers ──────────────────────────────────────────────

  async function handleCreateStage(e: React.FormEvent) {
    e.preventDefault()

    if (!newStageName.trim()) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStageName,
          color: newStageColor,
        }),
      })

      if (res.ok) {
        const stage = await res.json()
        setBoard((prev) => (prev ? { ...prev, stages: [...(prev.stages ?? []), stage] } : null))
        setNewStageName('')
        setNewStageColor('#3b82f6')
        setShowNewStageForm(false)
      }
    } catch (error) {
      console.error('Error creating stage:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateStageName(stageId: string, newName: string) {
    if (!newName.trim()) {
      setEditingStageId(null)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/stages/${stageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })

      if (res.ok) {
        const updated = await res.json()
        setBoard((prev) =>
          prev
            ? {
                ...prev,
                stages: (prev.stages ?? []).map((s) => (s.id === stageId ? updated : s)),
              }
            : null
        )
        setEditingStageId(null)
      }
    } catch (error) {
      console.error('Error updating stage:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (!confirm('¿Eliminar esta etapa? Esta acción es irreversible.')) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/stages/${stageId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setBoard((prev) =>
          prev
            ? {
                ...prev,
                stages: (prev.stages ?? []).filter((s) => s.id !== stageId),
              }
            : null
        )
      }
    } catch (error) {
      console.error('Error deleting stage:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Column handlers ─────────────────────────────────────────────

  async function handleToggleColumnHidden(colId: string, isHidden: boolean) {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/columns/${colId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: !isHidden }),
      })

      if (res.ok) {
        const updated = await res.json()
        setColumns(columns.map((c) => (c.id === colId ? updated : c)))
      }
    } catch (error) {
      console.error('Error updating column:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteColumn(colId: string) {
    if (!confirm('¿Eliminar esta columna? Esta acción es irreversible.')) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/columns/${colId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setColumns(columns.filter((c) => c.id !== colId))
      }
    } catch (error) {
      console.error('Error deleting column:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Member handlers ────────────────────────────────────────────

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedMemberId) return

    const isTeam = selectedMemberId.startsWith('t:')
    const entityId = selectedMemberId.slice(2)

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isTeam ? { team_id: entityId } : { user_id: entityId }),
          access: selectedMemberAccess,
        }),
      })

      if (res.ok) {
        const member = await res.json()
        setMembers([...members, member])
        setSelectedMemberId('')
        setSelectedMemberAccess('edit')
        setIsPublic(false)
      }
    } catch (error) {
      console.error('Error adding member:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('¿Remover este miembro?')) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })

      if (res.ok) {
        const newMembers = members.filter((m) => m.id !== memberId)
        setMembers(newMembers)
        if (newMembers.length === 0) {
          setIsPublic(true)
        }
      }
    } catch (error) {
      console.error('Error removing member:', error)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateMember(
    memberId: string,
    patch: { access?: 'view' | 'edit'; restrict_to_own?: boolean }
  ) {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setMembers(members.map((m) => (m.id === memberId ? { ...m, ...updated } : m)))
      }
    } catch (error) {
      console.error('Error updating member:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Keep old name for backwards compat with existing call sites
  async function handleUpdateMemberAccess(memberId: string, newAccess: 'view' | 'edit') {
    return handleUpdateMember(memberId, { access: newAccess })
  }


  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="text-sm text-red-600">No se pudo cargar el board</div>
    )
  }

  const availableUsers = workspaceUsers.filter((u) => !members.some((m) => m.user_id === u.id))
  const availableTeams = workspaceTeams.filter((t) => !members.some((m) => m.team_id === t.id))
  const hasAvailable   = availableUsers.length > 0 || availableTeams.length > 0

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{board.name}</h1>
        <p className="text-sm text-gray-500">
          {board.type === 'pipeline' ? 'Pipeline' : 'Tabla'} • SID: {board.sid}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-8">
        {board.type === 'pipeline' && (
          <button
            onClick={() => setActiveTab('etapas')}
            className={[
              'pb-3 text-sm font-medium transition-colors',
              activeTab === 'etapas'
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            Etapas
          </button>
        )}

        <button
          onClick={() => setActiveTab('columnas')}
          className={[
            'pb-3 text-sm font-medium transition-colors',
            activeTab === 'columnas'
              ? 'border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          Columnas
        </button>

        <button
          onClick={() => setActiveTab('acceso')}
          className={[
            'pb-3 text-sm font-medium transition-colors',
            activeTab === 'acceso'
              ? 'border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          Acceso
        </button>

        <button
          onClick={() => setActiveTab('sub-items')}
          className={[
            'pb-3 text-sm font-medium transition-colors',
            activeTab === 'sub-items'
              ? 'border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          Sub-items
        </button>
      </div>

      {/* ─── Tab: Etapas ─────────────────────────────────────────────── */}
      {activeTab === 'etapas' && board.type === 'pipeline' && (
        <div>
          {/* Stages List */}
          <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden mb-6">
            {(board.stages ?? []).length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No hay etapas</p>
            ) : (
              (board.stages ?? []).map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0"
                >
                  {/* Color dot */}
                  <div
                    className="w-3 h-3 rounded-full flex-none cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300"
                    style={{ backgroundColor: stage.color }}
                    title="Click para cambiar color"
                  />

                  {/* Name */}
                  {editingStageId === stage.id ? (
                    <input
                      type="text"
                      value={editingStageName}
                      onChange={(e) => setEditingStageName(e.target.value)}
                      onBlur={() => handleUpdateStageName(stage.id, editingStageName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateStageName(stage.id, editingStageName)
                        } else if (e.key === 'Escape') {
                          setEditingStageId(null)
                        }
                      }}
                      autoFocus
                      className="flex-1 border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditingStageId(stage.id)
                        setEditingStageName(stage.name)
                      }}
                      className="flex-1 text-sm text-gray-900 cursor-pointer hover:text-gray-700"
                    >
                      {stage.name}
                    </span>
                  )}

                  {/* Badge */}
                  {stage.is_closed && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      Cerrada
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteStage(stage.id)}
                    disabled={isSaving}
                    className="text-gray-400 hover:text-red-600 text-lg leading-none disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* New Stage Form */}
          {showNewStageForm ? (
            <form onSubmit={handleCreateStage} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Ej. Negociación"
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  disabled={isSaving}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewStageColor(color)}
                      className={[
                        'w-6 h-6 rounded-full transition-all',
                        newStageColor === color
                          ? 'ring-2 ring-offset-2 ring-gray-900'
                          : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-400',
                      ].join(' ')}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving || !newStageName.trim()}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewStageForm(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowNewStageForm(true)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Nueva etapa
            </button>
          )}
        </div>
      )}

      {/* ─── Tab: Columnas ──────────────────────────────────────────── */}
      {activeTab === 'columnas' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {columns.length === 0 ? (
            <p className="text-sm text-gray-500 p-4">No hay columnas</p>
          ) : (
            columns.map((col) => (
              <div
                key={col.id}
                className="group flex items-center justify-between gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{col.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{col.col_key}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                    {col.kind}
                  </span>

                  {!col.is_system && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.is_hidden}
                        onChange={() => handleToggleColumnHidden(col.id, col.is_hidden)}
                        disabled={isSaving}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600">Oculta</span>
                    </label>
                  )}

                  {col.is_system ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      Sistema
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteColumn(col.id)}
                      disabled={isSaving}
                      className="text-gray-400 hover:text-red-600 text-lg leading-none disabled:opacity-50"
                    >×</button>
                  )}

                  <button
                    onClick={() => setColSettingsId(col.id)}
                    className="text-gray-300 hover:text-indigo-500 transition-colors px-1.5 py-1 rounded hover:bg-gray-100 text-[16px] leading-none"
                    title="Configurar columna"
                  >⋯</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ColumnSettingsPanel drawer */}
      {colSettingsId && (() => {
        const col = columns.find(c => c.id === colSettingsId)
        if (!col) return null
        return (
          <ColumnSettingsPanel
            column={col}
            boardId={boardId}
            allColumns={columns.map(c => ({ col_key: c.col_key, name: c.name, kind: c.kind }))}
            users={workspaceUsers}
            onClose={() => setColSettingsId(null)}
            onUpdated={updated => {
              setColumns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
              setColSettingsId(null)
            }}
          />
        )
      })()}

      {/* ─── Tab: Acceso ────────────────────────────────────────────── */}
      {/* ─── Tab: Sub-items ────────────────────────────────────────────── */}
      {activeTab === 'sub-items' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Configura las vistas del panel de sub-items. Cada vista puede ser <strong>nativa</strong> (snapshot —
            sub-items propios), <strong>items de otro board</strong> (referencia viva), o <strong>sub-items de
            otro board</strong> (referencia viva).
          </p>

          {/* View list */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {subItemViews.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">Sin vistas configuradas</p>
            ) : (
              subItemViews.map(view => {
                const typeLabel = view.type === 'native' ? 'Nativo · snapshot' : view.type === 'board_items' ? 'Items de board · ref' : 'Sub-items de board · ref'
                const typeCls   = view.type === 'native' ? 'bg-gray-100 text-gray-600' : view.type === 'board_items' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                return (
                  <div key={view.id} className="flex items-center justify-between gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{view.name}</p>
                      {view.type !== 'native' && (view.config.source_board_id as string) && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                          board: {view.config.source_board_id as string}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${typeCls}`}>{typeLabel}</span>
                      {subItemViews.length > 1 && isAdmin && (
                        <button
                          onClick={() => handleDeleteSubItemView(view.id)}
                          disabled={isSaving}
                          className="text-gray-400 hover:text-red-600 text-lg leading-none disabled:opacity-50"
                        >×</button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Add form */}
          {viewFormOpen ? (
            <form onSubmit={handleCreateSubItemView} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              <p className="text-sm font-medium text-gray-700">Nueva vista de sub-items</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input
                    type="text" value={viewFormName} onChange={e => setViewFormName(e.target.value)}
                    placeholder="Ej. Cotizaciones" autoFocus
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                  <select
                    value={viewFormType}
                    onChange={e => { setViewFormType(e.target.value as SubItemViewType); setViewFormSourceBoardId(''); setViewFormRelColId('') }}
                    className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    <option value="native">Nativo — snapshot</option>
                    <option value="board_items">Items de otro board — referencia</option>
                    <option value="board_sub_items">Sub-items de otro board — referencia</option>
                  </select>
                </div>
              </div>

              {viewFormType !== 'native' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Board fuente</label>
                    <select
                      value={viewFormSourceBoardId}
                      onChange={e => { setViewFormSourceBoardId(e.target.value); setViewFormRelColId('') }}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">Seleccionar board...</option>
                      {allBoards.filter(b => b.id !== boardId).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Columna de relación (en el board fuente)</label>
                    <select
                      value={viewFormRelColId} onChange={e => setViewFormRelColId(e.target.value)}
                      disabled={!viewFormSourceBoardId || sourceBoardCols.length === 0}
                      className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-50"
                    >
                      <option value="">Seleccionar columna...</option>
                      {sourceBoardCols.filter(c => c.kind === 'relation').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {viewFormSourceBoardId && sourceBoardCols.filter(c => c.kind === 'relation').length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">Ese board no tiene columnas de tipo relación</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving || !viewFormName.trim() || (viewFormType !== 'native' && (!viewFormSourceBoardId || !viewFormRelColId))}
                  className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Creando...' : 'Crear vista'}
                </button>
                <button type="button" onClick={() => setViewFormOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setViewFormOpen(true)} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              + Nueva vista
            </button>
          )}
        </div>
      )}

      {activeTab === 'acceso' && (
        <div className="space-y-6">
          {/* Privacy Toggle */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {isPublic
                    ? 'Público — todos en el workspace pueden ver'
                    : 'Privado — solo miembros agregados'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {isPublic
                    ? 'Este board es visible para todos'
                    : 'Este board solo es visible para los miembros agregados'}
                </p>
              </div>

              <button
                onClick={() => {
                  if (!isPublic && members.length > 0) {
                    if (confirm('¿Cambiar a público? Se eliminarán todos los miembros.')) {
                      members.forEach((m) => handleRemoveMember(m.id))
                      setIsPublic(true)
                    }
                  } else {
                    setIsPublic(!isPublic)
                  }
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                {isPublic ? 'Cambiar a privado' : 'Cambiar a público'}
              </button>
            </div>
          </div>

          {/* Members Section */}
          {!isPublic && (
            <>
              {/* Members List */}
              {members.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {members.map((member) => {
                    const name = member.users?.name ?? member.teams?.name ?? 'Desconocido'
                    const isTeamMember = !!member.team_id

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {isTeamMember && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0 border border-blue-100">Equipo</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <select
                            value={member.access}
                            onChange={(e) =>
                              handleUpdateMemberAccess(
                                member.id,
                                e.target.value as 'view' | 'edit'
                              )
                            }
                            disabled={isSaving}
                            className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                          >
                            <option value="edit">Puede editar</option>
                            <option value="view">Solo lectura</option>
                          </select>

                          {/* restrict_to_own toggle — only for user members (not teams) */}
                          {member.user_id && (
                            <button
                              type="button"
                              title={member.restrict_to_own ? 'Solo ve sus propios items — click para quitar restricción' : 'Ve todos los items — click para restringir a solo los suyos'}
                              onClick={() => handleUpdateMember(member.id, { restrict_to_own: !member.restrict_to_own })}
                              disabled={isSaving}
                              className={[
                                'flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors',
                                member.restrict_to_own
                                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
                              ].join(' ')}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                                {member.restrict_to_own && <line x1="1" y1="1" x2="23" y2="23"/>}
                              </svg>
                              {member.restrict_to_own ? 'Solo suyos' : 'Todos'}
                            </button>
                          )}

                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={isSaving}
                            className="text-gray-400 hover:text-red-600 text-lg leading-none disabled:opacity-50"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add Member Form */}
              {hasAvailable && (
                <form onSubmit={handleAddMember} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                  <p className="text-sm font-medium text-gray-700">Agregar miembro o equipo</p>

                  <div className="flex gap-3">
                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      disabled={isSaving}
                      className="flex-1 border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="">Seleccionar...</option>
                      {availableUsers.length > 0 && (
                        <optgroup label="Miembros">
                          {availableUsers.map((user) => (
                            <option key={user.id} value={`u:${user.id}`}>
                              {user.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {availableTeams.length > 0 && (
                        <optgroup label="Equipos">
                          {availableTeams.map((team) => (
                            <option key={team.id} value={`t:${team.id}`}>
                              {team.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    <select
                      value={selectedMemberAccess}
                      onChange={(e) => setSelectedMemberAccess(e.target.value as 'view' | 'edit')}
                      disabled={isSaving}
                      className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    >
                      <option value="edit">Puede editar</option>
                      <option value="view">Solo lectura</option>
                    </select>

                    <button
                      type="submit"
                      disabled={isSaving || !selectedMemberId}
                      className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? '...' : '+'}
                    </button>
                  </div>
                </form>
              )}

              {!hasAvailable && members.length > 0 && (
                <p className="text-xs text-gray-500">
                  Todos los miembros y equipos del workspace ya tienen acceso
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
