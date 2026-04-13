'use client'

import { useEffect, useState } from 'react'

type Workspace = {
  id: string
  sid: number
  name: string
  created_at: string
  user_count: number
  board_count: number
}

const MOCK_WORKSPACES: Workspace[] = [
  {
    id: '1',
    sid: 10000001,
    name: 'CMP',
    created_at: '2026-04-01',
    user_count: 21,
    board_count: 5,
  },
]

export default function SuperadminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const res = await fetch('/api/superadmin/workspaces')
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }
        const data = await res.json()
        setWorkspaces(data)
      } catch (err) {
        console.error('Error fetching workspaces:', err)
        // Show mock data on error
        setWorkspaces(MOCK_WORKSPACES)
        setError('Usando datos de demostración')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkspaces()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })
  }

  return (
    <div className="w-full max-w-4xl">
      {/* Header with Badge */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-semibold text-gray-900">Superadmin</h1>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          SUPERADMIN
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Administra todos los workspaces de la plataforma
      </p>

      {/* Warning Card */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
        <p className="text-sm text-amber-600">
          Acceso de superadministrador. Puedes ver y administrar todos los workspaces.
        </p>
      </div>

      {/* Workspaces Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-6">
          <p className="text-sm text-yellow-700">{error}</p>
        </div>
      ) : null}

      {workspaces.length > 0 ? (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">SID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">Nombre</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">
                  Usuarios
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">Boards</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">Creado</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-700">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workspaces.map((ws) => (
                <tr key={ws.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium">{ws.sid}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{ws.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 text-right">{ws.user_count}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 text-right">{ws.board_count}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(ws.created_at)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      disabled
                      title="Acceso a workspace no implementado en demo"
                      className="text-sm font-medium text-gray-400 cursor-not-allowed hover:text-gray-400"
                    >
                      Acceder →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-500">No hay workspaces disponibles</p>
        </div>
      )}

      {/* Stats Summary */}
      {workspaces.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Workspaces</p>
            <p className="text-2xl font-semibold text-gray-900">{workspaces.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Usuarios</p>
            <p className="text-2xl font-semibold text-gray-900">
              {workspaces.reduce((sum, ws) => sum + ws.user_count, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Boards</p>
            <p className="text-2xl font-semibold text-gray-900">
              {workspaces.reduce((sum, ws) => sum + ws.board_count, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
