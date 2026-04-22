import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

type Workspace = {
  id:           string
  sid:          number
  name:         string
  created_at:   string
  user_count:   number
  board_count:  number
}

async function getWorkspaces(): Promise<Workspace[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('workspaces')
    .select('id, sid, name, created_at')
    .order('created_at', { ascending: false })

  if (!data) return []

  return Promise.all(data.map(async (w) => {
    const [{ count: users }, { count: boards }] = await Promise.all([
      supabase.from('workspace_users').select('*', { count: 'exact', head: true }).eq('workspace_id', w.id),
      supabase.from('boards').select('*', { count: 'exact', head: true }).eq('workspace_id', w.id),
    ])
    return { ...w, user_count: users ?? 0, board_count: boards ?? 0 }
  }))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'short' })
}

export default async function SuperadminPage() {
  const auth = await requireAuthApi()
  if (isAuthError(auth) || auth.role !== 'superadmin') redirect('/app')

  const workspaces = await getWorkspaces()
  const totalUsers = workspaces.reduce((s, w) => s + w.user_count, 0)
  const totalBoards = workspaces.reduce((s, w) => s + w.board_count, 0)

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-semibold text-gray-900">Superadmin</h1>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          SUPERADMIN
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Administra todos los workspaces de la plataforma
      </p>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
        <p className="text-sm text-amber-600">
          Acceso de superadministrador. Puedes ver y administrar todos los workspaces.
        </p>
      </div>

      {workspaces.length > 0 ? (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">SID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">Nombre</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">Usuarios</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-700">Boards</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-700">Creado</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workspaces.map((ws) => (
                <tr key={ws.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-900 font-medium">{ws.sid}</td>
                  <td className="py-3 px-4 text-sm text-gray-900">{ws.name}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 text-right">{ws.user_count}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 text-right">{ws.board_count}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{formatDate(ws.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      disabled
                      title="Acceso a workspace no implementado en demo"
                      className="text-sm font-medium text-gray-400 cursor-not-allowed"
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

      {workspaces.length > 0 && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Workspaces</p>
            <p className="text-2xl font-semibold text-gray-900">{workspaces.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Usuarios</p>
            <p className="text-2xl font-semibold text-gray-900">{totalUsers}</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-700 mb-1">Total Boards</p>
            <p className="text-2xl font-semibold text-gray-900">{totalBoards}</p>
          </div>
        </div>
      )}
    </div>
  )
}
