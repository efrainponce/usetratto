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
  let { data: profile } = await service
    .from('users')
    .select('sid, name, role, workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  // handle_new_auth_user trigger may fail silently — auto-provision as fallback.
  // Supabase stores phone without '+', superadmin_phones stores it with '+'.
  if (!profile) {
    const withPlus    = user.phone ? (user.phone.startsWith('+') ? user.phone : `+${user.phone}`) : null
    const withoutPlus = user.phone ? (user.phone.startsWith('+') ? user.phone.slice(1) : user.phone) : null
    const phoneCandidates = [withPlus, withoutPlus].filter(Boolean) as string[]

    const { data: saRow } = phoneCandidates.length
      ? await service.from('superadmin_phones').select('workspace_id').in('phone', phoneCandidates).maybeSingle()
      : { data: null }

    const { data: newProfile } = await service
      .from('users')
      .upsert({
        id:           user.id,
        phone:        user.phone,
        role:         saRow ? 'superadmin' : 'member',
        workspace_id: saRow?.workspace_id ?? null,
      }, { onConflict: 'id' })
      .select('sid, name, role, workspace_id')
      .maybeSingle()

    profile = newProfile
  }

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
