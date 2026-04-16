'use client'

import { useState, useEffect } from 'react'
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

interface Territory {
  id: string
  sid: string
  name: string
  parent_id: string | null
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    const fetchTerritories = async () => {
      try {
        const res = await fetch('/api/territories')
        if (res.ok) {
          setTerritories(await res.json())
        }
      } catch (error) {
        console.error('Failed to fetch territories:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTerritories()
  }, [])

  const handleCreateTerritory = async (parentId: string | null = null) => {
    if (!newName.trim()) return

    try {
      const res = await fetch('/api/territories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          parent_id: parentId,
        }),
      })

      if (res.ok) {
        const newTerritory = await res.json()
        setTerritories((prev) => [...prev, newTerritory].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
        setCreatingParentId(null)
      }
    } catch (error) {
      console.error('Failed to create territory:', error)
    }
  }

  const handleUpdateName = async (id: string) => {
    if (!editingName.trim()) return

    try {
      const res = await fetch(`/api/territories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTerritories((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, name: updated.name } : t
          )
        )
        setEditingId(null)
        setEditingName('')
      }
    } catch (error) {
      console.error('Failed to update territory:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this territory?')) return

    try {
      const res = await fetch(`/api/territories/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setTerritories((prev) => prev.filter((t) => t.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete territory:', error)
    }
  }

  const getParent = (parentId: string | null) => {
    if (!parentId) return null
    return territories.find((t) => t.id === parentId)
  }

  const getChildren = (parentId: string | null) => {
    return territories.filter((t) => t.parent_id === parentId)
  }

  const TerritoryItem = ({ territory, isChild = false }: { territory: Territory; isChild?: boolean }) => {
    const children = getChildren(territory.id)

    return (
      <div key={territory.id}>
        <div
          className={`flex items-center justify-between py-3 border-b border-gray-100 ${
            isChild ? 'pl-5' : ''
          }`}
        >
          <div className="flex items-center gap-2 flex-1">
            {editingId === territory.id ? (
              <input
                autoFocus
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleUpdateName(territory.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateName(territory.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
              />
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditingId(territory.id)
                    setEditingName(territory.name)
                  }}
                  className="text-gray-900 font-medium hover:text-gray-700"
                >
                  {territory.name}
                </button>
                <span className="text-xs text-gray-400">
                  #{territory.sid}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isChild && (
              <button
                onClick={() => setCreatingParentId(territory.id)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-2"
              >
                <IconPlus />
              </button>
            )}
            <button
              onClick={() => handleDelete(territory.id)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none px-2"
            >
              ×
            </button>
          </div>
        </div>

        {creatingParentId === territory.id && (
          <div className={`flex items-center gap-2 py-3 border-b border-gray-100 ${isChild ? 'pl-5' : ''} pl-9`}>
            <input
              autoFocus
              type="text"
              placeholder="Territory name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                if (!newName.trim()) setCreatingParentId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTerritory(territory.id)
                if (e.key === 'Escape') {
                  setNewName('')
                  setCreatingParentId(null)
                }
              }}
              className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 flex-1"
            />
          </div>
        )}

        {children.map((child) => (
          <TerritoryItem key={child.id} territory={child} isChild={true} />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading territories...</div>
      </div>
    )
  }

  const parentTerritories = getChildren(null)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Zonas</h1>

      <div className="space-y-2">
        {parentTerritories.map((territory) => (
          <TerritoryItem key={territory.id} territory={territory} />
        ))}
      </div>

      {creatingParentId === null ? (
        <button
          onClick={() => setCreatingParentId('new')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 py-2"
        >
          <IconPlus />
          Nueva zona
        </button>
      ) : (
        <div className="flex items-center gap-2 py-3 border-b border-gray-100">
          <input
            autoFocus
            type="text"
            placeholder="Territory name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => {
              if (!newName.trim()) setCreatingParentId(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTerritory(null)
              if (e.key === 'Escape') {
                setNewName('')
                setCreatingParentId(null)
              }
            }}
            className="border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20 flex-1"
          />
        </div>
      )}
    </div>
  )
}
