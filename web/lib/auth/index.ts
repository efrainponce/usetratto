import 'server-only' // Garantiza que este módulo NUNCA se ejecute en el cliente
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AuthUser = {
  userId: string
  phone: string | null
  // workspace_id y role se agregarán en Fase 0 cuando exista la tabla users
}

/**
 * getCurrentUser — cached por request.
 * Llama a supabase.auth.getUser() que valida el JWT contra los servidores
 * de Supabase (NO solo lee cookies). Esto previene tokens forjados.
 * cache() evita múltiples network calls en el mismo render.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  return {
    userId: user.id,
    phone: user.phone ?? null,
  }
})

/**
 * requireAuth — usa en layouts y pages que requieren sesión.
 * Redirige a /login si no hay sesión válida.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/**
 * requireAdmin — para páginas de settings/admin.
 * Se completará en Fase 0 cuando exista la tabla users con roles.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  // TODO Fase 0: verificar role === 'admin' || 'superadmin' contra tabla users
  return user
}
