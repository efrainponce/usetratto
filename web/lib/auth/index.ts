import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { resolveUserProfile, checkSuperadminPhone } from './resolve-profile'

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
  let profile = await resolveUserProfile(service, user.id, user.phone)

  // handle_new_auth_user trigger may fail silently — auto-provision as fallback.
  if (!profile) {
    const saWorkspaceId = await checkSuperadminPhone(service, user.phone)

    const { data: newProfile } = await service
      .from('users')
      .upsert({
        id:           user.id,
        phone:        user.phone,
        role:         saWorkspaceId ? 'superadmin' : 'member',
        workspace_id: saWorkspaceId ?? null,
      }, { onConflict: 'id' })
      .select('id, sid, name, phone, email, role, workspace_id')
      .maybeSingle()

    profile = newProfile ? {
      id: newProfile.id,
      sid: newProfile.sid,
      name: newProfile.name,
      phone: newProfile.phone,
      email: newProfile.email,
      role: newProfile.role,
      workspace_id: newProfile.workspace_id,
    } : null
  }

  if (!profile) return null

  return {
    userId: user.id,
    userSid: profile.sid,
    phone: user.phone ?? null,
    name: profile.name,
    role: profile.role as UserRole,
    workspaceId: profile.workspace_id!,
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
