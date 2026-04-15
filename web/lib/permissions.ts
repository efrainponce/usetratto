import { createServiceClient } from '@/lib/supabase/service'

// Module-level cache for user team IDs to reduce repeated lookups
const userTeamsCache = new Map<string, string[]>()

/**
 * Internal helper: fetch user's team IDs with module-level caching
 */
async function getUserTeamIds(userId: string): Promise<string[]> {
  if (userTeamsCache.has(userId)) {
    return userTeamsCache.get(userId)!
  }

  try {
    const supabase = createServiceClient()
    const { data: userTeams, error: teamsErr } = await supabase
      .from('user_teams')
      .select('team_id')
      .eq('user_id', userId)

    if (teamsErr || !userTeams) {
      userTeamsCache.set(userId, [])
      return []
    }

    const teamIds = userTeams.map(t => t.team_id)
    userTeamsCache.set(userId, teamIds)
    return teamIds
  } catch {
    userTeamsCache.set(userId, [])
    return []
  }
}

/**
 * Get the effective access level for a user on a column.
 * Returns 'edit' | 'view' | null:
 * - 'edit': user can view and edit
 * - 'view': user can view but not edit
 * - null: user has no access (restricted column without override)
 *
 * @param columnRef - { type: 'board' | 'sub_item', id: string }
 * @param userId - uuid of the user
 * @param workspaceId - uuid of the workspace
 * @param role - optional user role (if 'admin' or 'superadmin', returns 'edit' immediately)
 */
export async function getColumnUserAccess(
  columnRef: { type: 'board' | 'sub_item'; id: string },
  userId: string,
  workspaceId: string,
  role?: string
): Promise<'edit' | 'view' | null> {
  try {
    // Admin/superadmin bypass
    if (role === 'admin' || role === 'superadmin') {
      return 'edit'
    }

    const supabase = createServiceClient()
    let columnId = columnRef.id
    let columnType: 'board' | 'sub_item' = columnRef.type

    // For sub_item_columns, resolve inheritance if needed
    if (columnRef.type === 'sub_item') {
      const { data: subItemCol, error: subItemColErr } = await supabase
        .from('sub_item_columns')
        .select('id, permission_mode, source_col_key, board_id, settings')
        .eq('id', columnRef.id)
        .maybeSingle()

      if (subItemColErr || !subItemCol) {
        return null
      }

      // permission_mode='public' → always edit access
      if (subItemCol.permission_mode === 'public') {
        return 'edit'
      }

      // permission_mode='inherit' → resolve to source board_column
      if (subItemCol.permission_mode === 'inherit') {
        const inherited = await resolveInheritedPermissions(columnRef.id)
        if (!inherited) {
          return 'edit' // Nothing to inherit → public
        }
        columnId = inherited.targetBoardColumnId
        columnType = 'board'
      }
      // else permission_mode='custom' → continue with this sub_item_column
    }

    // Fetch column with settings.default_access
    const table = columnType === 'board' ? 'board_columns' : 'sub_item_columns'
    const { data: column, error: columnErr } = await supabase
      .from(table)
      .select('id, settings')
      .eq('id', columnId)
      .maybeSingle()

    if (columnErr || !column) {
      return null
    }

    const defaultAccess = column.settings?.default_access ?? 'edit'

    // Check for override in column_permissions
    const fieldName = columnType === 'board' ? 'column_id' : 'sub_item_column_id'
    const { data: permissions, error: permErr } = await supabase
      .from('column_permissions')
      .select('access, user_id, team_id')
      .eq(fieldName, columnId)

    if (!permErr && permissions && permissions.length > 0) {
      // Check for direct user override
      const directOverride = permissions.find(p => p.user_id === userId)
      if (directOverride) {
        return directOverride.access as 'edit' | 'view'
      }

      // Check for team override
      const userTeamIds = await getUserTeamIds(userId)
      const teamOverride = permissions.find(
        p => p.team_id && userTeamIds.includes(p.team_id)
      )
      if (teamOverride) {
        return teamOverride.access as 'edit' | 'view'
      }
    }

    // No override → use default access
    if (defaultAccess === 'restricted') {
      return null // Restricted without override = no access
    }

    return defaultAccess as 'edit' | 'view'
  } catch {
    return null
  }
}

/**
 * Returns true if the user can VIEW a given column (board_column or sub_item_column).
 *
 * Rules:
 * - Admin/superadmin role → true
 * - Calls getColumnUserAccess internally; returns true if access level is not null
 * - For sub_item_columns with permission_mode='inherit': resolves to the source board_column
 * - For sub_item_columns with permission_mode='public': always true
 * - settings.default_access controls visibility ('edit' and 'view' → visible, 'restricted' → not visible unless overridden)
 *
 * @param columnRef - { type: 'board' | 'sub_item', id: string }
 * @param userId - uuid of the user
 * @param workspaceId - uuid of the workspace
 * @param role - optional user role (if 'admin' or 'superadmin', returns true immediately)
 */
export async function userCanViewColumn(
  columnRef: { type: 'board' | 'sub_item'; id: string },
  userId: string,
  workspaceId: string,
  role?: string
): Promise<boolean> {
  const accessLevel = await getColumnUserAccess(columnRef, userId, workspaceId, role)
  return accessLevel !== null
}

/**
 * Returns true if the user can EDIT a given column (board_column or sub_item_column).
 *
 * Rules:
 * - Admin/superadmin role → true
 * - Calls getColumnUserAccess internally; returns true only if access level is 'edit'
 * - For sub_item_columns with permission_mode='inherit': resolves to the source board_column
 * - For sub_item_columns with permission_mode='public': always true
 * - settings.default_access controls edit ability ('edit' → editable, others require override)
 *
 * @param columnRef - { type: 'board' | 'sub_item', id: string }
 * @param userId - uuid of the user
 * @param workspaceId - uuid of the workspace
 * @param role - optional user role (if 'admin' or 'superadmin', returns true immediately)
 */
export async function userCanEditColumn(
  columnRef: { type: 'board' | 'sub_item'; id: string },
  userId: string,
  workspaceId: string,
  role?: string
): Promise<boolean> {
  const accessLevel = await getColumnUserAccess(columnRef, userId, workspaceId, role)
  return accessLevel === 'edit'
}

/**
 * For a sub_item_column with permission_mode='inherit', resolves the target board_column.id
 * from its source_col_key by looking up the board's sub_items_source_board_id in boards.settings
 * and finding the board_column with matching col_key.
 *
 * Returns null if:
 * - sub_item_column has no source_col_key
 * - parent board has no sub_items_source_board_id
 * - no matching board_column found
 */
export async function resolveInheritedPermissions(
  subItemColId: string
): Promise<{ targetBoardColumnId: string } | null> {
  try {
    const supabase = createServiceClient()

    // Fetch sub_item_column with source_col_key and board_id
    const { data: subItemCol, error: subItemColErr } = await supabase
      .from('sub_item_columns')
      .select('source_col_key, board_id')
      .eq('id', subItemColId)
      .maybeSingle()

    if (subItemColErr || !subItemCol || !subItemCol.source_col_key) {
      return null
    }

    // Fetch board with sub_items_source_board_id
    const { data: board, error: boardErr } = await supabase
      .from('boards')
      .select('sub_items_source_board_id')
      .eq('id', subItemCol.board_id)
      .maybeSingle()

    if (boardErr || !board || !board.sub_items_source_board_id) {
      return null
    }

    // Find the source board_column by col_key
    const { data: sourceCol, error: sourcColErr } = await supabase
      .from('board_columns')
      .select('id')
      .eq('board_id', board.sub_items_source_board_id)
      .eq('col_key', subItemCol.source_col_key)
      .maybeSingle()

    if (sourcColErr || !sourceCol) {
      return null
    }

    return { targetBoardColumnId: sourceCol.id }
  } catch {
    return null
  }
}

/**
 * Returns true if the user can access the item.
 * Rules (OR):
 * - user role is admin/superadmin → true
 * - item.workspace_id mismatch → false
 * - user is owner → true
 * - board has NO board_members (public) → true
 * - user is direct member of board via board_members (OR via team)
 * - if membership has restrict_to_own=true → also require item.owner_id === userId
 *
 * NOTE: Takes the role as an explicit param since caller already has it from requireAuthApi().
 * If role omitted, defaults to 'member'.
 */
export async function userCanAccessItem(
  itemId: string,
  userId: string,
  workspaceId: string,
  role?: string
): Promise<boolean> {
  try {
    const userRole = role || 'member'

    // Admin/superadmin bypass
    if (userRole === 'admin' || userRole === 'superadmin') {
      return true
    }

    const supabase = createServiceClient()

    // Fetch item
    const { data: item, error: itemErr } = await supabase
      .from('items')
      .select('id, board_id, workspace_id, owner_id')
      .eq('id', itemId)
      .maybeSingle()

    if (itemErr || !item) {
      return false
    }

    // Workspace mismatch
    if (item.workspace_id !== workspaceId) {
      return false
    }

    // User is owner
    if (item.owner_id === userId) {
      return true
    }

    // Check if board has any members (if no members, board is public)
    const { count: memberCount, error: countErr } = await supabase
      .from('board_members')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', item.board_id)

    if (countErr) {
      return false
    }

    if (memberCount === 0) {
      return true // Board is public
    }

    // Check if user is a member (directly or via team)
    const membership = await checkBoardMembership(item.board_id, userId)

    if (!membership) {
      return false
    }

    // If restrict_to_own is true, require user to be owner
    if (membership.restrict_to_own) {
      return item.owner_id === userId
    }

    return true
  } catch {
    return false
  }
}

/**
 * Internal helper: checks if user is a member of a board (directly or via team).
 * Returns membership info (access, restrict_to_own) or null.
 */
async function checkBoardMembership(
  boardId: string,
  userId: string
): Promise<{ access: string; restrict_to_own: boolean } | null> {
  try {
    const supabase = createServiceClient()

    // Check direct membership
    const { data: directMember, error: directErr } = await supabase
      .from('board_members')
      .select('access, restrict_to_own')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!directErr && directMember) {
      return { access: directMember.access, restrict_to_own: directMember.restrict_to_own }
    }

    // Check team membership
    const { data: userTeams, error: teamsErr } = await supabase
      .from('user_teams')
      .select('team_id')
      .eq('user_id', userId)

    if (teamsErr || !userTeams || userTeams.length === 0) {
      return null
    }

    const userTeamIds = userTeams.map(t => t.team_id)

    const { data: teamMembers, error: teamErr } = await supabase
      .from('board_members')
      .select('access, restrict_to_own')
      .eq('board_id', boardId)
      .in('team_id', userTeamIds)
      .maybeSingle()

    if (teamErr || !teamMembers) {
      return null
    }

    return { access: teamMembers.access, restrict_to_own: teamMembers.restrict_to_own }
  } catch {
    return null
  }
}

/**
 * Returns true if the user is a board admin for the given board.
 *
 * Rules (OR):
 * - role === 'admin' || 'superadmin' → true (workspace admin bypass)
 * - user has board_members row for this board with access='admin' (direct or via team)
 *
 * Used to gate schema operations (columns, stages, permissions, members) in API routes.
 */
export async function requireBoardAdmin(
  boardId: string,
  userId: string,
  workspaceId: string,
  role?: string
): Promise<boolean> {
  try {
    // Admin/superadmin bypass
    if (role === 'admin' || role === 'superadmin') {
      return true
    }

    const supabase = createServiceClient()

    // Check direct membership
    const { data: directMember, error: directErr } = await supabase
      .from('board_members')
      .select('access')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!directErr && directMember && directMember.access === 'admin') {
      return true
    }

    // Check team membership
    const userTeamIds = await getUserTeamIds(userId)
    if (userTeamIds.length === 0) {
      return false
    }

    const { data: teamMembers, error: teamErr } = await supabase
      .from('board_members')
      .select('access')
      .eq('board_id', boardId)
      .in('team_id', userTeamIds)

    if (teamErr || !teamMembers) {
      return false
    }

    // Check if any team membership has access='admin'
    return teamMembers.some(m => m.access === 'admin')
  } catch {
    return false
  }
}

/**
 * Returns the board_id for a given sub_item_column, or null if not found.
 */
export async function getBoardIdForSubItemColumn(subItemColId: string): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const { data: subItemCol, error } = await supabase
      .from('sub_item_columns')
      .select('board_id')
      .eq('id', subItemColId)
      .maybeSingle()

    if (error || !subItemCol) {
      return null
    }

    return subItemCol.board_id
  } catch {
    return null
  }
}
