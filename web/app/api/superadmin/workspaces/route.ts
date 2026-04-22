import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/api-helpers'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  // Check if user is superadmin
  if (auth.role !== 'superadmin') {
    return jsonError('Solo superadministradores pueden acceder a esto', 403)
  }

  const supabase = createServiceClient()

  // Fetch all workspaces
  const { data: workspacesData, error: workspacesError } = await supabase
    .from('workspaces')
    .select('id, sid, name, created_at')
    .order('created_at', { ascending: false })

  if (workspacesError) {
    return jsonError(workspacesError.message, 500)
  }

  if (!workspacesData || workspacesData.length === 0) {
    return NextResponse.json([])
  }

  // For each workspace, count users and boards
  const workspacesWithCounts = await Promise.all(
    workspacesData.map(async (workspace) => {
      // Count users in this workspace
      const { count: userCount, error: userCountError } = await supabase
        .from('workspace_users')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)

      // Count boards in this workspace
      const { count: boardCount, error: boardCountError } = await supabase
        .from('boards')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)

      return {
        id: workspace.id,
        sid: workspace.sid,
        name: workspace.name,
        created_at: workspace.created_at,
        user_count: userCount || 0,
        board_count: boardCount || 0,
      }
    })
  )

  return NextResponse.json(workspacesWithCounts)
}
