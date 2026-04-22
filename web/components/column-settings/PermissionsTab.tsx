'use client'

import { useEffect, useState } from 'react'
import type { ColPermission } from '@/lib/boards/types'
import type { PanelColumn, PanelUser } from '../ColumnSettingsPanel'

type RemoteTeam = { id: string; name: string }

type Props = {
  column:              PanelColumn
  boardId:             string
  users:               PanelUser[]
  patchEndpoint?:      string
  permissionsEndpoint: string
  isSubItemColumn:     boolean
  onPatched?:          (col: PanelColumn) => void
}

export function PermissionsTab({
  column, boardId, users, patchEndpoint, permissionsEndpoint, isSubItemColumn, onPatched,
}: Props) {
  const [permissions,         setPermissions]         = useState<ColPermission[]>([])
  const [permsLoading,        setPermsLoading]        = useState(false)
  const [teams,               setTeams]               = useState<RemoteTeam[]>([])
  const [newPermId,           setNewPermId]           = useState('')
  const [newPermAccess,       setNewPermAccess]       = useState<'view' | 'edit'>('view')
  const [savingPerm,          setSavingPerm]          = useState(false)
  const [permissionMode,      setPermissionMode]      = useState<'public' | 'inherit' | 'custom'>(
    column.permission_mode ?? 'public'
  )
  const [savingMode,          setSavingMode]          = useState(false)
  const [defaultAccess,       setDefaultAccess]       = useState<'edit' | 'view' | 'restricted'>(
    (column.settings?.default_access as 'edit' | 'view' | 'restricted' | undefined) ?? 'edit'
  )
  const [savingDefaultAccess, setSavingDefaultAccess] = useState(false)

  useEffect(() => {
    setPermsLoading(true)
    Promise.all([
      fetch(permissionsEndpoint).then(r => r.ok ? r.json() : []),
      fetch('/api/teams').then(r => r.ok ? r.json() : []),
    ]).then(([perms, teamsData]: [ColPermission[], RemoteTeam[]]) => {
      setPermissions(perms)
      setTeams(teamsData)
    }).finally(() => setPermsLoading(false))
  }, [permissionsEndpoint])

  async function handleAddPermission() {
    if (!newPermId) return
    const isTeam   = newPermId.startsWith('t:')
    const entityId = newPermId.slice(2)
    setSavingPerm(true)
    try {
      const res = await fetch(permissionsEndpoint, {
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
      const res = await fetch(`${permissionsEndpoint}/${permId}`, { method: 'DELETE' })
      if (res.ok) setPermissions(prev => prev.filter(p => p.id !== permId))
    } finally {
      setSavingPerm(false)
    }
  }

  async function handleChangePermissionMode(newMode: 'public' | 'inherit' | 'custom') {
    if (!patchEndpoint || !isSubItemColumn) return
    setSavingMode(true)
    try {
      const res = await fetch(patchEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_mode: newMode }),
      })
      if (res.ok) {
        setPermissionMode(newMode)
        const updated = await res.json() as PanelColumn
        onPatched?.(updated)
      }
    } finally {
      setSavingMode(false)
    }
  }

  async function handleChangeDefaultAccess(newAccess: 'edit' | 'view' | 'restricted') {
    setSavingDefaultAccess(true)
    try {
      const endpoint = patchEndpoint ?? `/api/boards/${boardId}/columns/${column.id}`
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { ...column.settings, default_access: newAccess },
        }),
      })
      if (res.ok) {
        setDefaultAccess(newAccess)
        const updated = await res.json() as PanelColumn
        onPatched?.(updated)
      }
    } finally {
      setSavingDefaultAccess(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 pb-3 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-700">Acceso por defecto</p>
        <select
          value={defaultAccess}
          onChange={e => handleChangeDefaultAccess(e.target.value as 'edit' | 'view' | 'restricted')}
          disabled={savingDefaultAccess}
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-50"
        >
          <option value="edit">Editar (todos)</option>
          <option value="view">Ver (todos)</option>
          <option value="restricted">Restringido (solo listados)</option>
        </select>
        {savingDefaultAccess && <p className="text-[11px] text-gray-400">Guardando...</p>}
      </div>

      {isSubItemColumn && (
        <div className="space-y-3 pb-3 border-b border-gray-100">
          <p className="text-xs font-medium text-gray-700">Modo de permisos</p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="permissionMode"
              value="public"
              checked={permissionMode === 'public'}
              onChange={() => handleChangePermissionMode('public')}
              disabled={savingMode}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">Público</p>
              <p className="text-[11px] text-gray-500">Todos los miembros del board pueden ver</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="permissionMode"
              value="inherit"
              checked={permissionMode === 'inherit'}
              onChange={() => handleChangePermissionMode('inherit')}
              disabled={savingMode}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">Heredar del origen</p>
              <p className="text-[11px] text-gray-500">Usa los permisos de la columna fuente</p>
              {permissionMode === 'inherit' && !column.source_col_key && (
                <p className="text-[11px] text-red-500 mt-1">Esta columna no tiene origen configurado</p>
              )}
              {permissionMode === 'inherit' && column.source_col_key && (
                <p className="text-[11px] text-gray-600 mt-1">Heredando de la columna '{column.source_col_key}'</p>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="permissionMode"
              value="custom"
              checked={permissionMode === 'custom'}
              onChange={() => handleChangePermissionMode('custom')}
              disabled={savingMode}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">Personalizado</p>
              <p className="text-[11px] text-gray-500">Configurar manualmente abajo</p>
            </div>
          </label>

          {savingMode && <p className="text-[11px] text-gray-400">Guardando...</p>}
        </div>
      )}

      {permsLoading ? (
        <p className="text-xs text-gray-400">Cargando...</p>
      ) : isSubItemColumn && permissionMode === 'public' ? (
        <p className="text-xs text-gray-500">Esta columna es pública, los permisos no aplican.</p>
      ) : isSubItemColumn && permissionMode === 'inherit' ? (
        <p className="text-xs text-gray-500">Los permisos se heredan del origen.</p>
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
                      perm.access === 'edit' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600',
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
            <div>
              <p className="text-xs font-medium text-gray-600">
                {defaultAccess === 'edit'
                  ? 'Excepciones: restringir acceso'
                  : defaultAccess === 'view'
                  ? 'Permitir edición a'
                  : 'Permitir acceso a'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {defaultAccess === 'edit'
                  ? 'Usuarios listados con "Ver" no podrán editar'
                  : defaultAccess === 'view'
                  ? 'Usuarios listados con "Editar" podrán modificar'
                  : 'Solo los usuarios listados verán esta columna'}
              </p>
            </div>
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
                      <option key={t.id} value={`t:${t.id}`}>{t.name}</option>
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
  )
}
