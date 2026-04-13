import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type AuthUser = {
  userId: string
  phone: string | null
}

/**
 * requireAuthApi — usa en TODOS los API route handlers.
 * Valida JWT contra Supabase (no solo cookie). Retorna NextResponse 401
 * si no hay sesión — el caller hace `if (auth instanceof NextResponse) return auth`
 */
export async function requireAuthApi(): Promise<AuthUser | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return {
    userId: user.id,
    phone: user.phone ?? null,
  }
}

export function isAuthError(result: AuthUser | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
