'use client'

/**
 * TEST B — Client Component + API Route
 *
 * Demuestra auth en API routes:
 * - El cliente llama a /api/test con sus cookies
 * - El servidor valida JWT antes de responder
 * - Sin sesión → 401, el cliente muestra error
 * - Nadie puede llamar esta API sin sesión válida
 */
import { useState } from 'react'

type ApiResult =
  | { ok: true; userId: string; phone: string | null; timestamp: string }
  | { error: string }

export default function TestApiPage() {
  const [result, setResult] = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function callApi() {
    setLoading(true)
    const res = await fetch('/api/test')
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  async function callApiSinCookies() {
    setLoading(true)
    // Simula llamada sin credenciales (credentials: 'omit')
    const res = await fetch('/api/test', { credentials: 'omit' })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Test B — Client + API Route</h1>
        <p className="text-sm text-gray-500 mt-1">Auth validado en el API route handler</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={callApi}
          disabled={loading}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          Llamar /api/test
        </button>
        <button
          onClick={callApiSinCookies}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          Simular sin sesión → espera 401
        </button>
      </div>

      {result && (
        <div className={`border rounded-xl p-5 ${
          'error' in result
            ? 'bg-red-50 border-red-200'
            : 'bg-white border-gray-200'
        }`}>
          <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-medium text-green-800">Seguro porque:</p>
        <ul className="mt-2 text-sm text-green-700 space-y-1 list-disc list-inside">
          <li>API valida JWT en el servidor, no confía en el cliente</li>
          <li>Sin sesión válida → 401, nunca retorna datos</li>
          <li>proxy.ts bloquea rutas /api/* sin sesión antes del handler</li>
          <li>El handler valida de nuevo (defensa en profundidad)</li>
        </ul>
      </div>

      <a href="/app/test-server" className="block text-sm text-blue-600 hover:underline">
        ← Ver Test A (Server Component)
      </a>
    </div>
  )
}
