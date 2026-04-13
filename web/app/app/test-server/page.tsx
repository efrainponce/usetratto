/**
 * TEST A — Server Component
 *
 * Demuestra auth en el servidor:
 * - requireAuth() valida JWT contra Supabase antes de renderizar
 * - Si no hay sesión → redirect /login automático
 * - El usuario solo ve SUS datos (userId, phone)
 * - Ningún dato sensible llega al cliente (server-only)
 */
import { requireAuth } from '@/lib/auth'

export default async function TestServerPage() {
  const user = await requireAuth()

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Test A — Server Component</h1>
        <p className="text-sm text-gray-500 mt-1">Auth validado en el servidor antes de renderizar</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <Row label="userId" value={user.userId} />
        <Row label="phone" value={user.phone ?? '—'} />
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-medium text-green-800">Seguro porque:</p>
        <ul className="mt-2 text-sm text-green-700 space-y-1 list-disc list-inside">
          <li>JWT validado contra servidores de Supabase (no solo cookie)</li>
          <li><code>server-only</code> — este módulo no puede importarse en el cliente</li>
          <li><code>cache()</code> — una sola llamada a Supabase por request</li>
          <li>Sin sesión → redirect inmediato, nunca ve la página</li>
        </ul>
      </div>

      <a href="/app/test-api" className="block text-sm text-blue-600 hover:underline">
        → Ver Test B (Client + API Route)
      </a>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-mono text-gray-400 w-20 pt-0.5 shrink-0">{label}</span>
      <span className="text-sm font-mono text-gray-800 break-all">{value}</span>
    </div>
  )
}
