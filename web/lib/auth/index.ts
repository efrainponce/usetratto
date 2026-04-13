import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export type UserRole = 'superadmin' | 'admin' | 'member' | 'viewer'

export type AuthUser = {
  userId: string
  userSid: number
  phone: string | null
  name: string | null
  role: UserRole
  workspaceId: string
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) return null

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('sid, name, role, workspace_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    userId: user.id,
    userSid: profile.sid,
    phone: user.phone ?? null,
    name: profile.name,
    role: profile.role as UserRole,
    workspaceId: profile.workspace_id,
  }
})

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    redirect('/app')
  }
  return user
}
