'use client'

import { useState, useEffect } from 'react'
function IconChevronDown() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg> }
function IconChevronRight() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg> }
function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }

interface User {
  id: string
  sid: string
  name: string
  role: string
}

interface Team {
  id: string
  sid: string
  name: string
  member_count: number
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Record<string, User[]>>({})
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set())
  const [addingMember, setAddingMember] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsRes, usersRes] = await Promise.all([
          fetch('/api/teams'),
          fetch('/api/workspace-users'),
        ])

        if (teamsRes.ok) setTeams(await teamsRes.json())
        if (usersRes.ok) setWorkspaceUsers(await usersRes.json())
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const fetchTeamMembers = async (teamId: string) => {
    if (teamMembers[teamId]) return

    setLoadingMembers((prev) => new Set(prev).add(teamId))
    try {
      const res = await fetch(`/api/teams/${teamId}/members`)
      if (res.ok) {
        const data = await res.json()
        setTeamMembers((prev) => ({ ...prev, [teamId]: data }))
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error)
    } finally {
      setLoadingMembers((prev) => {
        const next = new Set(prev)
        next.delete(teamId)
        return next
      })
    }
  }

  const handleToggleTeam = (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null)
    } else {
      setExpandedTeam(teamId)
      fetchTeamMembers(teamId)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() }),
      })

      if (res.ok) {
        const newTeam = await res.json()
        setTeams((prev) => [...prev, { ...newTeam, member_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)))
        setNewTeamName('')
        setCreatingTeam(false)
      }
    } catch (error) {
      console.error('Failed to create team:', error)
    }
  }

  const handleUpdateTeamName = async (teamId: string) => {
    if (!editingTeamName.trim()) return

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTeamName.trim() }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId ? { ...t, name: updated.name } : t
          )
        )
        setEditingTeamId(null)
        setEditingTeamName('')
      }
    } catch (error) {
      console.error('Failed to update team:', error)
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team?')) return

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTeams((prev) => prev.filter((t) => t.id !== teamId))
        setExpandedTeam(null)
        setTeamMembers((prev) => {
          const next = { ...prev }
          delete next[teamId]
          return next
        })
      }
    } catch (error) {
      console.error('Failed to delete team:', error)
    }
  }

  const handleAddMember = async (teamId: string, userId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (res.ok) {
        const newMember = await res.json()
        setTeamMembers((prev) => ({
          ...prev,
          [teamId]: [...(prev[teamId] || []), newMember],
        }))
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId ? { ...t, member_count: t.member_count + 1 } : t
          )
        )
        setAddingMember(null)
      }
    } catch (error) {
      console.error('Failed to add member:', error)
    }
  }

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (res.ok) {
        setTeamMembers((prev) => ({
          ...prev,
          [teamId]: (prev[teamId] || []).filter((m) => m.id !== userId),
        }))
        setTeams((prev) =>
          prev.map((t) =>
            t.id === teamId ? { ...t, member_count: Math.max(0, t.member_count - 1) } : t
          )
        )
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const getAvailableMembersForTeam = (teamId: string) => {
    const currentMembers = teamMembers[teamId] || []
    return workspaceUsers.filter(
      (u) => !currentMembers.some((m) => m.id === u.id)
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading teams...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Equipos</h1>

      <div className="space-y-2">
        {teams.map((team) => (
          <div key={team.id}>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => handleToggleTeam(team.id)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  {expandedTeam === team.id ? (
                    <IconChevronDown />
                  ) : (
                    <IconChevronRight />
                  )}
                </button>

                {editingTeamId === team.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingTeamName}
                    onChange={(e) => setEditingTeamName(e.target.value)}
                    onBlur={() => handleUpdateTeamName(team.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateTeamName(team.id)
                      if (e.key === 'Escape') setEditingTeamId(null)
                    }}
                    className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingTeamId(team.id)
                      setEditingTeamName(team.name)
                    }}
                    className="text-gray-900 font-medium hover:text-gray-700"
                  >
                    {team.name}
                  </button>
                )}

                <span className="rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
                  {team.member_count} miembro{team.member_count !== 1 ? 's' : ''}
                </span>
              </div>

              <button
                onClick={() => handleDeleteTeam(team.id)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none p-1"
              >
                ×
              </button>
            </div>

            {expandedTeam === team.id && (
              <div className="pl-10 py-3 border-b border-gray-100 space-y-3">
                {loadingMembers.has(team.id) ? (
                  <div className="text-sm text-gray-500">Loading members...</div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {(teamMembers[team.id] || []).map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5">
                            {member.name}
                          </span>
                          <button
                            onClick={() => handleRemoveMember(team.id, member.id)}
                            className="text-gray-400 hover:text-red-500 text-lg leading-none"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {addingMember === team.id ? (
                      <div className="space-y-2 pt-2">
                        {getAvailableMembersForTeam(team.id).map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleAddMember(team.id, user.id)}
                            className="w-full text-left text-sm py-2 px-3 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700"
                          >
                            {user.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingMember(team.id)}
                        className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 py-2"
                      >
                        <IconPlus />
                        Agregar miembro
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {creatingTeam ? (
        <div className="flex items-center gap-2 py-3 border-b border-gray-100 pl-9">
          <input
            autoFocus
            type="text"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onBlur={() => {
              if (!newTeamName.trim()) setCreatingTeam(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTeam()
              if (e.key === 'Escape') {
                setNewTeamName('')
                setCreatingTeam(false)
              }
            }}
            className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 flex-1"
          />
        </div>
      ) : (
        <button
          onClick={() => setCreatingTeam(true)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 py-2"
        >
          <IconPlus />
          Nuevo equipo
        </button>
      )}
    </div>
  )
}
