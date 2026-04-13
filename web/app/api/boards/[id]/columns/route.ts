import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: columns, error } = await supabase
    .from('board_columns')
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .eq('board_id', id)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Skip permission filtering for admins
  if (auth.role === 'admin' || auth.role === 'superadmin') {
    const columnsWithAccess = (columns ?? []).map(col => ({
      ...col,
      user_access: 'edit',
    }))
    return NextResponse.json(columnsWithAccess)
  }

  // Fetch column permissions for all columns
  const columnIds = (columns ?? []).map(c => c.id)
  if (columnIds.length === 0) {
    return NextResponse.json([])
  }

  const { data: columnPerms, error: permsError } = await supabase
    .from('column_permissions')
    .select('column_id, user_id, team_id, access')
    .in('column_id', columnIds)

  if (permsError) {
    return NextResponse.json({ error: permsError.message }, { status: 500 })
  }

  // Fetch user's team memberships
  const { data: userTeams, error: teamsError } = await supabase
    .from('user_teams')
    .select('team_id')
    .eq('user_id', auth.userId)

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 })
  }

  // Build set of team IDs the user belongs to
  const userTeamSet = new Set((userTeams ?? []).map(t => t.team_id))

  // Group permissions by column_id
  const permsMap = new Map<string, typeof columnPerms>()
  ;(columnPerms ?? []).forEach(perm => {
    if (!permsMap.has(perm.column_id)) {
      permsMap.set(perm.column_id, [])
    }
    permsMap.get(perm.column_id)!.push(perm)
  })

  // Filter columns and add user_access
  const filteredColumns = (columns ?? [])
    .filter(col => {
      const perms = permsMap.get(col.id)

      // No restrictions if no perms for this column
      if (!perms || perms.length === 0) {
        return true
      }

      // Check if user has direct access (user_id match)
      if (perms.some(p => p.user_id === auth.userId)) {
        return true
      }

      // Check if user's team has access
      if (perms.some(p => p.team_id && userTeamSet.has(p.team_id))) {
        return true
      }

      // User doesn't have access to this column
      return false
    })
    .map(col => {
      const perms = permsMap.get(col.id)

      // Determine user_access level
      let userAccess = 'edit'
      if (perms && perms.length > 0) {
        // Check direct user permission
        const userPerm = perms.find(p => p.user_id === auth.userId)
        if (userPerm) {
          userAccess = userPerm.access
        } else {
          // Check team permission
          const teamPerm = perms.find(p => p.team_id && userTeamSet.has(p.team_id))
          if (teamPerm) {
            userAccess = teamPerm.access
          }
        }
      }

      return {
        ...col,
        user_access: userAccess,
      }
    })

  return NextResponse.json(filteredColumns)
}

export async function POST(req: Request, { params }: Context) {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const { id } = await params
  const supabase = await createClient()

  // Verify board belongs to workspace
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle()

  if (!board) return NextResponse.json({ error: 'Board no encontrado' }, { status: 404 })

  const body = await req.json() as {
    col_key?: string
    name?:    string
    kind?:    string
    settings?: Record<string, unknown>
  }

  const { name, kind } = body
  if (!name || !kind) {
    return NextResponse.json({ error: 'name and kind required' }, { status: 400 })
  }

  // Generate col_key from name if not provided; ensure uniqueness per board
  const baseKey = (body.col_key ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  let col_key   = baseKey
  let attempt   = 0
  while (true) {
    const { data: existing } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', id)
      .eq('col_key', col_key)
      .maybeSingle()
    if (!existing) break
    attempt++
    col_key = `${baseKey}_${attempt}`
  }

  // Get next position
  const { data: last } = await supabase
    .from('board_columns')
    .select('position')
    .eq('board_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (last?.position ?? -1) + 1

  const { data: column, error } = await supabase
    .from('board_columns')
    .insert({
      board_id:  id,
      col_key,
      name,
      kind,
      position,
      is_system: false,
      is_hidden: false,
      required:  false,
      settings:  body.settings ?? {},
    })
    .select('id, col_key, name, kind, position, is_system, is_hidden, required, settings')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(column, { status: 201 })
}
