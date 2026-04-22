import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { WorkspaceNameForm } from './WorkspaceNameForm'

export default async function WorkspaceSettingsPage() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) redirect('/login')

  const supabase = createServiceClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, sid, name')
    .eq('id', auth.workspaceId)
    .single()

  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Workspace</h1>
      <p className="text-sm text-gray-500 mb-8">Gestiona la configuración de tu workspace</p>

      {workspace ? (
        <>
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">General</h2>
            <WorkspaceNameForm initialName={workspace.name ?? ''} />
          </div>

          <div className="mt-12">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">Zona de peligro</h2>
            <div className="border border-red-100 rounded-lg p-6 bg-red-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Eliminar workspace</p>
                  <p className="text-xs text-red-600 mt-0.5">Esta acción es irreversible</p>
                </div>
                <button
                  disabled
                  className="px-4 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 cursor-not-allowed disabled:opacity-50"
                  title="Contacta soporte para eliminar el workspace"
                >
                  Eliminar
                </button>
              </div>
              <p className="text-xs text-red-600 mt-3">
                Contacta soporte para eliminar el workspace
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-red-600">No se pudo cargar el workspace</p>
      )}
    </div>
  )
}
