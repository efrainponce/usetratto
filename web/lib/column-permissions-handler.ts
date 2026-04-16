import { NextResponse } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { jsonError, jsonOk } from './api-helpers'

export type PermissionFK = 'column_id' | 'sub_item_column_id'

/**
 * Handler for column permission GET/POST/DELETE operations.
 * Parameterized by the FK field to support both board_columns and sub_item_columns.
 */
export function createPermissionHandlers(fkField: PermissionFK) {
  return {
    /**
     * GET: Fetch all permissions for a column/sub_item_column
     */
    async GET(
      supabase: SupabaseClient,
      columnId: string,
      _workspaceId: string
    ): Promise<NextResponse> {
      const selectFields = `
        id,
        ${fkField},
        user_id,
        team_id,
        access,
        created_at,
        users(id, sid, name),
        teams(id, sid, name)
      `

      const { data: permissions, error } = await supabase
        .from('column_permissions')
        .select(selectFields)
        .eq(fkField, columnId)

      if (error) return jsonError(error.message, 500)
      return jsonOk(permissions ?? [])
    },

    /**
     * POST: Create a new permission for a column/sub_item_column
     */
    async POST(
      supabase: SupabaseClient,
      columnId: string,
      _workspaceId: string,
      body: {
        user_id?: string
        team_id?: string
        access?: string
      }
    ): Promise<NextResponse> {
      const hasUserId = body.user_id && body.user_id.trim()
      const hasTeamId = body.team_id && body.team_id.trim()

      if ((hasUserId && hasTeamId) || (!hasUserId && !hasTeamId)) {
        return jsonError('Must specify exactly one of user_id or team_id', 400)
      }

      if (!body.access || !['view', 'edit'].includes(body.access)) {
        return jsonError("Access must be 'view' or 'edit'", 400)
      }

      const selectFields = `
        id,
        ${fkField},
        user_id,
        team_id,
        access,
        created_at,
        users(id, sid, name),
        teams(id, sid, name)
      `

      const insertData: Record<string, any> = {
        [fkField]: columnId,
        user_id: hasUserId ? body.user_id : null,
        team_id: hasTeamId ? body.team_id : null,
        access: body.access,
      }

      const { data: permission, error } = await supabase
        .from('column_permissions')
        .insert(insertData)
        .select(selectFields)
        .single()

      if (error) return jsonError(error.message, 500)
      return jsonOk(permission, 201)
    },

    /**
     * DELETE: Remove a permission by ID
     */
    async DELETE(
      supabase: SupabaseClient,
      columnId: string,
      _workspaceId: string,
      permissionId: string
    ): Promise<NextResponse> {
      if (!permissionId?.trim()) {
        return jsonError('Permission ID is required', 400)
      }

      const { error } = await supabase
        .from('column_permissions')
        .delete()
        .eq('id', permissionId)
        .eq(fkField, columnId)

      if (error) return jsonError(error.message, 500)
      return jsonOk({ success: true })
    },
  }
}
