import 'server-only'
import { SupabaseClient } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  sid: number
  name: string | null
  phone: string | null
  email: string | null
  role: string
  workspace_id: string | null
}

/**
 * Normalize phone number for lookup (handles +/- prefix inconsistency).
 * Supabase auth stores phone without '+', but seeds may have '+'.
 */
function getNormalizedPhoneCandidates(phone: string | null | undefined): string[] {
  if (!phone) return []
  const withPlus = phone.startsWith('+') ? phone : `+${phone}`
  const withoutPlus = phone.startsWith('+') ? phone.slice(1) : phone
  return [withPlus, withoutPlus].filter(Boolean)
}

/**
 * Resolve a user profile from the database with fallback phone lookup.
 * Used by both server and API routes to avoid duplication.
 *
 * @param supabase - SupabaseClient (service client recommended)
 * @param userId - Auth user ID
 * @param phone - Optional phone from auth.user.phone for fallback lookup
 * @returns UserProfile or null if not found
 */
export async function resolveUserProfile(
  supabase: SupabaseClient,
  userId: string,
  phone?: string | null
): Promise<UserProfile | null> {
  // Direct lookup by user ID first
  const { data: user } = await supabase
    .from('users')
    .select('id, sid, name, phone, email, role, workspace_id')
    .eq('id', userId)
    .maybeSingle()

  if (user) {
    return mapToProfile(user)
  }

  // Fallback: try phone lookup with normalization
  if (phone) {
    const phoneCandidates = getNormalizedPhoneCandidates(phone)
    if (phoneCandidates.length > 0) {
      const { data: phoneUser } = await supabase
        .from('users')
        .select('id, sid, name, phone, email, role, workspace_id')
        .in('phone', phoneCandidates)
        .maybeSingle()

      if (phoneUser) {
        return mapToProfile(phoneUser)
      }
    }
  }

  return null
}

/**
 * Map a database user row to the UserProfile type.
 */
function mapToProfile(user: any): UserProfile {
  return {
    id: user.id,
    sid: user.sid,
    name: user.name ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    role: user.role,
    workspace_id: user.workspace_id ?? null,
  }
}

/**
 * Check if a user is a superadmin by phone.
 * Returns workspace_id if found, null otherwise.
 */
export async function checkSuperadminPhone(
  supabase: SupabaseClient,
  phone?: string | null
): Promise<string | null> {
  if (!phone) return null

  const phoneCandidates = getNormalizedPhoneCandidates(phone)
  if (phoneCandidates.length === 0) return null

  const { data: saRow } = await supabase
    .from('superadmin_phones')
    .select('workspace_id')
    .in('phone', phoneCandidates)
    .maybeSingle()

  return saRow?.workspace_id ?? null
}
