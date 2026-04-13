import { requireAuth } from '@/lib/auth'

export default async function AppPage() {
  const user = await requireAuth()

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tratto</h1>
        <p className="text-sm text-gray-500 mt-1">Sesión activa: {user.phone}</p>
      </div>

      <div className="space-y-2">
        <a href="/app/test-server" className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-400 transition-colors">
          <p className="text-sm font-medium text-gray-900">Test A — Server Component</p>
          <p className="text-xs text-gray-500 mt-0.5">Auth en el servidor, sin roundtrip al cliente</p>
        </a>
        <a href="/app/test-api" className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-400 transition-colors">
          <p className="text-sm font-medium text-gray-900">Test B — Client + API Route</p>
          <p className="text-xs text-gray-500 mt-0.5">Auth en API routes, prueba el 401</p>
        </a>
      </div>
    </div>
  )
}
