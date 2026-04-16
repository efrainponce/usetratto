'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  token: string
  code: string | null
  email: string
  role: string
  workspaceName: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Solo lectura',
}

export function InviteLanding({ token, code, email, role, workspaceName }: Props) {
  const [status, setStatus] = useState<'exchanging' | 'ready' | 'accepting' | 'error'>(
    code ? 'exchanging' : 'ready'
  )
  const [error, setError] = useState<string | null>(null)

  // On mount: establish session from the invite magic link.
  // Supabase may use PKCE (?code=) or implicit (#access_token=) flow.
  useEffect(() => {
    const supabase = createClient()

    async function establishSession() {
      // 1. PKCE flow: ?code= in query string (passed from server component)
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          setError('No pudimos validar tu enlace. Pide una nueva invitación.')
          return
        }
        window.history.replaceState({}, '', `/invite/${token}`)
        setStatus('ready')
        return
      }

      // 2. Implicit flow: #access_token= in URL hash (fragment, client-only)
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            setStatus('error')
            setError('No pudimos validar tu enlace. Pide una nueva invitación.')
            return
          }
          // Clear hash from URL
          window.history.replaceState({}, '', `/invite/${token}`)
          setStatus('ready')
          return
        }
      }

      // 3. No auth params — user may already have a session or link was opened manually
      setStatus('ready')
    }

    setStatus('exchanging')
    establishSession()
  }, [code, token])

  async function handleAccept() {
    setStatus('accepting')
    setError(null)
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setError(data.error ?? 'No se pudo aceptar la invitación.')
        return
      }
      // Hard reload so middleware picks up new workspace_id
      window.location.href = '/app'
    } catch (e) {
      setStatus('error')
      setError('Error de red. Intenta de nuevo.')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wide text-gray-500">Invitación</div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            Bienvenido a {workspaceName}
          </h1>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Rol</dt>
            <dd className="font-medium text-gray-900">{ROLE_LABELS[role] ?? role}</dd>
          </div>
        </dl>

        {status === 'exchanging' && (
          <p className="mt-6 text-sm text-gray-500">Validando tu enlace...</p>
        )}

        {status === 'ready' && (
          <button
            onClick={handleAccept}
            className="mt-6 w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition"
          >
            Aceptar invitación
          </button>
        )}

        {status === 'accepting' && (
          <button
            disabled
            className="mt-6 w-full px-4 py-2.5 rounded-lg bg-indigo-400 text-white text-sm font-medium cursor-wait"
          >
            Aceptando...
          </button>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}
