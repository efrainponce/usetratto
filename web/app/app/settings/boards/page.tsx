'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Board = {
  id: string
  sid: number
  slug: string
  name: string
  type: string
  system_key: string | null
}

function BoardSvgIcon({ systemKey }: { systemKey: string | null }) {
  switch (systemKey) {
    case 'opportunities':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
        </svg>
      )
    case 'contacts':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'accounts':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M9 16h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        </svg>
      )
    case 'vendors':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 5v4h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'catalog':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
      )
  }
}

export default function BoardsSettingsPage() {
  const router = useRouter()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'pipeline' | 'table'>('pipeline')
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch boards on mount
  useEffect(() => {
    fetchBoards()
  }, [])

  async function fetchBoards() {
    try {
      const res = await fetch('/api/boards')
      const data = await res.json()
      if (res.ok) {
        setBoards(data)
      }
    } catch (error) {
      console.error('Error fetching boards:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault()

    if (!newName.trim()) {
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          type: newType,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setNewName('')
        setNewType('pipeline')
        setShowNewForm(false)
        router.push(`/app/settings/boards/${data.id}`)
      }
    } catch (error) {
      console.error('Error creating board:', error)
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDeleteBoard(boardId: string) {
    if (!confirm('¿Eliminar este board? Esta acción es irreversible.')) {
      return
    }

    setDeletingId(boardId)
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setBoards(boards.filter((b) => b.id !== boardId))
      }
    } catch (error) {
      console.error('Error deleting board:', error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Boards</h1>
          <p className="text-sm text-gray-500">Gestiona los boards de tu workspace</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          Nuevo board
        </button>
      </div>

      {/* New Board Form */}
      {showNewForm && (
        <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <form onSubmit={handleCreateBoard} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del board
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Proyectos"
                className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                disabled={isCreating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'pipeline' | 'table')}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                disabled={isCreating}
              >
                <option value="pipeline">Pipeline</option>
                <option value="table">Tabla</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isCreating || !newName.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Creando...' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Boards List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          No hay boards aún. Crea uno para empezar.
        </p>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600">
                  <BoardSvgIcon systemKey={board.system_key} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-medium text-gray-900">{board.name}</h3>
                    {board.system_key && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        Sistema
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {board.type === 'pipeline' ? 'Pipeline' : 'Tabla'} • SID: {board.sid}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/app/settings/boards/${board.id}`}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Configurar →
                </Link>

                {!board.system_key && (
                  <button
                    onClick={() => handleDeleteBoard(board.id)}
                    disabled={deletingId === board.id}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingId === board.id ? '...' : '✕'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
