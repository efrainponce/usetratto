'use client'

import { useEffect, useState, useMemo } from 'react'

type WorkspaceUser = {
  id: string
  sid: number
  name: string | null
  phone: string | null
  role: 'admin' | 'member' | 'viewer' | 'superadmin'
}

type Invitation = {
  id: string
  sid: number
  email: string
  role: 'admin' | 'member' | 'viewer'
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export default function MembersSettingsPage() {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Fetch users on mount
  useEffect(() => {
    async function fetchUsers() {
      try {
        const [usersRes, meRes, invitesRes] = await Promise.all([
          fetch('/api/workspace-users'),
          fetch('/api/users/me'),
          fetch('/api/invitations'),
        ])
        const usersData = await usersRes.json()
        const meData = await meRes.json()
        if (usersRes.ok) setUsers(usersData)
        if (meRes.ok) {
          setIsAdmin(meData.role === 'admin' || meData.role === 'superadmin')
          setCurrentUserId(meData.id)
        }
        if (invitesRes.ok) {
          const invitesData = await invitesRes.json()
          setInvitations(invitesData.invitations ?? [])
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

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSubmitting(true)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error ?? 'No se pudo enviar la invitación')
        return
      }
      setInvitations(prev => [data, ...prev])
      setInviteEmail('')
      setInviteRole('member')
      setInviteModalOpen(false)
    } catch {
      setInviteError('Error de red. Intenta de nuevo.')
    } finally {
      setInviteSubmitting(false)
    }
  }

  async function handleRevokeInvite(id: string) {
    if (!confirm('¿Revocar esta invitación?')) return
    const res = await fetch(`/api/invitations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setInvitations(prev => prev.filter(i => i.id !== id))
    }
  }

  function handleCopyLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">({filteredUsers.length})</span>
          {isAdmin && (
            <button
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              <span>+</span> Invitar por email
            </button>
          )}
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

      {/* Pending invitations */}
      {!loading && invitations.filter(i => !i.accepted_at).length > 0 && (
        <div className="mt-10">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Invitaciones pendientes</h2>
            <p className="text-xs text-gray-500">Enviadas por email, esperando aceptación</p>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Email</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Rol</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Expira</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invitations.filter(i => !i.accepted_at).map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900">{inv.email}</td>
                    <td className="px-6 py-3 text-gray-600">{getRoleLabel(inv.role)}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {new Date(inv.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyLink(inv.token)}
                          className="text-xs text-gray-600 hover:text-gray-900"
                          title="Copiar link"
                        >
                          Copiar link
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Invitar a un miembro</h3>
            <p className="text-sm text-gray-500 mt-1">Enviaremos un email con el enlace de acceso.</p>
            <form onSubmit={handleSendInvite} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="persona@empresa.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="member">Miembro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {inviteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {inviteError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setInviteModalOpen(false); setInviteError(null) }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting || !inviteEmail.trim()}
                  className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteSubmitting ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
