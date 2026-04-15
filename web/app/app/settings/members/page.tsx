'use client'

import { useEffect, useState, useMemo } from 'react'

type WorkspaceUser = {
  id: string
  sid: number
  name: string | null
  phone: string | null
  role: 'admin' | 'member' | 'viewer' | 'superadmin'
}

export default function MembersSettingsPage() {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)

  // Fetch users on mount
  useEffect(() => {
    async function fetchUsers() {
      try {
        const [usersRes, meRes] = await Promise.all([
          fetch('/api/workspace-users'),
          fetch('/api/users/me'),
        ])
        const usersData = await usersRes.json()
        const meData = await meRes.json()
        if (usersRes.ok) setUsers(usersData)
        if (meRes.ok) {
          setIsAdmin(meData.role === 'admin' || meData.role === 'superadmin')
          setCurrentUserId(meData.id)
        }
      } catch (error) {
        console.error('Error fetching users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  async function handleRoleChange(userId: string, newRole: string) {
    setSavingRole(userId)
    try {
      const res = await fetch(`/api/workspace-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: updated.role } : u))
      }
    } finally {
      setSavingRole(null)
    }
  }

  // Client-side filter by name/phone
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users
    const lower = searchTerm.toLowerCase()
    return users.filter(
      (u) =>
        (u.name?.toLowerCase().includes(lower) || false) ||
        (u.phone?.toLowerCase().includes(lower) || false)
    )
  }, [users, searchTerm])

  // Avatar color determinism based on name
  const getAvatarColor = (fullName: string | null) => {
    const colors = [
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-rose-100 text-rose-700',
      'bg-amber-100 text-amber-700',
      'bg-teal-100 text-teal-700',
      'bg-sky-100 text-sky-700',
    ]
    if (!fullName || fullName.length === 0) return colors[0]
    return colors[fullName.charCodeAt(0) % colors.length]
  }

  // Get avatar initial
  const getInitial = (fullName: string | null) => {
    return fullName ? fullName.charAt(0).toUpperCase() : 'U'
  }

  // Role label in Spanish
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'member':
        return 'Miembro'
      case 'viewer':
        return 'Visualizador'
      default:
        return role
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Miembros</h1>
          <p className="text-sm text-gray-500">Gestiona los miembros de tu workspace</p>
        </div>
        <div className="text-sm text-gray-600 font-medium">
          ({filteredUsers.length})
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">
            {searchTerm ? 'No se encontraron miembros' : 'No hay miembros aún'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Nombre</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Teléfono</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">SID</th>
                <th className="text-left px-6 py-3 font-medium text-gray-700">Rol</th>
                <th className="text-right px-6 py-3 font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  {/* Avatar + Nombre */}
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-none ${getAvatarColor(
                          user.name
                        )}`}
                      >
                        {getInitial(user.name)}
                      </div>
                      <span className="text-sm text-gray-900">{user.name || '—'}</span>
                    </div>
                  </td>

                  {/* Teléfono */}
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {user.phone || '—'}
                  </td>

                  {/* SID */}
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {user.sid}
                  </td>

                  {/* Rol */}
                  <td className="px-6 py-3">
                    {user.role === 'superadmin' ? (
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 font-medium">Superadmin</span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={(!isAdmin && user.id !== currentUserId) || savingRole === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="viewer">Visualizador</option>
                        <option value="member">Miembro</option>
                        <option value="admin">Administrador</option>
                      </select>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-3 text-right">
                    <button
                      disabled
                      className="text-xs text-gray-400 cursor-not-allowed"
                      title="Próximamente"
                    >
                      —
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Section (Placeholder) */}
      {!loading && filteredUsers.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Invitar por teléfono — próximamente
          </p>
        </div>
      )}
    </div>
  )
}
