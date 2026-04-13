-- =============================================================================
-- 003_rls_policies.sql
-- Tratto — Row Level Security
-- Regla: workspace_isolation en todas las tablas
--        items: admin/owner/board_member(user o via team)/territorio
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPERS — funciones reutilizables para RLS
-- ---------------------------------------------------------------------------

-- ¿El usuario autenticado es del workspace?
CREATE OR REPLACE FUNCTION auth_in_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND workspace_id = p_workspace_id
  );
$$;

-- ¿El usuario es admin o superadmin?
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('admin','superadmin')
  );
$$;

-- workspace_id del usuario autenticado
CREATE OR REPLACE FUNCTION auth_workspace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT workspace_id FROM users WHERE id = auth.uid();
$$;

-- ¿El usuario tiene acceso a un board (directo o via team)?
CREATE OR REPLACE FUNCTION user_has_board_access(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Si el board no tiene board_members → público para el workspace
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM board_members WHERE board_id = p_board_id)
        THEN auth_in_workspace((SELECT workspace_id FROM boards WHERE id = p_board_id))
      ELSE
        EXISTS (
          SELECT 1 FROM board_members bm
          WHERE bm.board_id = p_board_id
            AND (
              bm.user_id = auth.uid()
              OR bm.team_id IN (
                SELECT team_id FROM user_teams WHERE user_id = auth.uid()
              )
            )
        )
    END;
$$;

-- ¿El usuario puede editar un board?
CREATE OR REPLACE FUNCTION user_can_edit_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    auth_is_admin()
    OR EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = p_board_id
        AND bm.access = 'edit'
        AND (
          bm.user_id = auth.uid()
          OR bm.team_id IN (
            SELECT team_id FROM user_teams WHERE user_id = auth.uid()
          )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- ENABLE RLS en todas las tablas
-- ---------------------------------------------------------------------------
ALTER TABLE workspaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_stages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_columns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_values     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_item_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_item_views  ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_channels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_activity   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- WORKSPACES
-- ---------------------------------------------------------------------------
CREATE POLICY workspaces_select ON workspaces FOR SELECT
  USING (
    auth_is_admin()
    OR id = auth_workspace_id()
  );

CREATE POLICY workspaces_insert ON workspaces FOR INSERT
  WITH CHECK (auth_is_admin());

CREATE POLICY workspaces_update ON workspaces FOR UPDATE
  USING (auth_is_admin() OR id = auth_workspace_id());

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE POLICY users_select ON users FOR SELECT
  USING (
    id = auth.uid()
    OR auth_is_admin()
    OR workspace_id = auth_workspace_id()
  );

CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (id = auth.uid() OR auth_is_admin());

CREATE POLICY users_update ON users FOR UPDATE
  USING (id = auth.uid() OR auth_is_admin());

-- ---------------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------------
CREATE POLICY teams_select ON teams FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY teams_modify ON teams FOR ALL
  USING (workspace_id = auth_workspace_id() AND auth_is_admin());

-- ---------------------------------------------------------------------------
-- USER_TEAMS
-- ---------------------------------------------------------------------------
CREATE POLICY user_teams_select ON user_teams FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY user_teams_modify ON user_teams FOR ALL
  USING (auth_is_admin());

-- ---------------------------------------------------------------------------
-- TERRITORIES
-- ---------------------------------------------------------------------------
CREATE POLICY territories_select ON territories FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY territories_modify ON territories FOR ALL
  USING (workspace_id = auth_workspace_id() AND auth_is_admin());

-- ---------------------------------------------------------------------------
-- USER_TERRITORIES
-- ---------------------------------------------------------------------------
CREATE POLICY user_territories_select ON user_territories FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth_is_admin()
  );

CREATE POLICY user_territories_modify ON user_territories FOR ALL
  USING (auth_is_admin());

-- ---------------------------------------------------------------------------
-- BOARDS
-- ---------------------------------------------------------------------------
CREATE POLICY boards_select ON boards FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND user_has_board_access(id)
  );

CREATE POLICY boards_insert ON boards FOR INSERT
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND auth_is_admin()
  );

CREATE POLICY boards_update ON boards FOR UPDATE
  USING (workspace_id = auth_workspace_id() AND auth_is_admin());

CREATE POLICY boards_delete ON boards FOR DELETE
  USING (workspace_id = auth_workspace_id() AND auth_is_admin());

-- ---------------------------------------------------------------------------
-- BOARD_STAGES
-- ---------------------------------------------------------------------------
CREATE POLICY board_stages_select ON board_stages FOR SELECT
  USING (
    board_id IN (
      SELECT id FROM boards
      WHERE workspace_id = auth_workspace_id()
        AND user_has_board_access(id)
    )
  );

CREATE POLICY board_stages_modify ON board_stages FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
    AND auth_is_admin()
  );

-- ---------------------------------------------------------------------------
-- BOARD_COLUMNS
-- ---------------------------------------------------------------------------
CREATE POLICY board_columns_select ON board_columns FOR SELECT
  USING (
    board_id IN (
      SELECT id FROM boards
      WHERE workspace_id = auth_workspace_id()
        AND user_has_board_access(id)
    )
  );

CREATE POLICY board_columns_modify ON board_columns FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
    AND auth_is_admin()
  );

-- ---------------------------------------------------------------------------
-- BOARD_MEMBERS
-- ---------------------------------------------------------------------------
CREATE POLICY board_members_select ON board_members FOR SELECT
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY board_members_modify ON board_members FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
    AND auth_is_admin()
  );

-- ---------------------------------------------------------------------------
-- COLUMN_PERMISSIONS
-- ---------------------------------------------------------------------------
CREATE POLICY column_permissions_select ON column_permissions FOR SELECT
  USING (
    column_id IN (
      SELECT bc.id FROM board_columns bc
      JOIN boards b ON b.id = bc.board_id
      WHERE b.workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY column_permissions_modify ON column_permissions FOR ALL
  USING (auth_is_admin());

-- ---------------------------------------------------------------------------
-- ITEMS
-- ---------------------------------------------------------------------------
CREATE POLICY items_select ON items FOR SELECT
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_admin()
      OR owner_id = auth.uid()
      OR user_has_board_access(board_id)
      OR territory_id IN (
        SELECT territory_id FROM user_territories WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY items_insert ON items FOR INSERT
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND user_can_edit_board(board_id)
  );

CREATE POLICY items_update ON items FOR UPDATE
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_admin()
      OR owner_id = auth.uid()
      OR user_can_edit_board(board_id)
    )
  );

CREATE POLICY items_delete ON items FOR DELETE
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_admin()
      OR owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- ITEM_VALUES
-- ---------------------------------------------------------------------------
CREATE POLICY item_values_select ON item_values FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM items WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY item_values_insert ON item_values FOR INSERT
  WITH CHECK (
    item_id IN (
      SELECT id FROM items
      WHERE workspace_id = auth_workspace_id()
        AND (auth_is_admin() OR owner_id = auth.uid() OR user_can_edit_board(board_id))
    )
  );

CREATE POLICY item_values_update ON item_values FOR UPDATE
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE workspace_id = auth_workspace_id()
        AND (auth_is_admin() OR owner_id = auth.uid() OR user_can_edit_board(board_id))
    )
  );

CREATE POLICY item_values_delete ON item_values FOR DELETE
  USING (
    item_id IN (
      SELECT id FROM items WHERE workspace_id = auth_workspace_id()
    )
  );

-- ---------------------------------------------------------------------------
-- SUB_ITEMS  (hereda permisos del item padre)
-- ---------------------------------------------------------------------------
CREATE POLICY sub_items_select ON sub_items FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY sub_items_insert ON sub_items FOR INSERT
  WITH CHECK (
    workspace_id = auth_workspace_id()
    AND item_id IN (
      SELECT id FROM items
      WHERE workspace_id = auth_workspace_id()
        AND (auth_is_admin() OR owner_id = auth.uid() OR user_can_edit_board(board_id))
    )
  );

CREATE POLICY sub_items_update ON sub_items FOR UPDATE
  USING (
    workspace_id = auth_workspace_id()
    AND item_id IN (
      SELECT id FROM items
      WHERE workspace_id = auth_workspace_id()
        AND (auth_is_admin() OR owner_id = auth.uid() OR user_can_edit_board(board_id))
    )
  );

CREATE POLICY sub_items_delete ON sub_items FOR DELETE
  USING (
    workspace_id = auth_workspace_id()
    AND (
      auth_is_admin()
      OR item_id IN (
        SELECT id FROM items WHERE owner_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- SUB_ITEM_VALUES
-- ---------------------------------------------------------------------------
CREATE POLICY sub_item_values_select ON sub_item_values FOR SELECT
  USING (
    sub_item_id IN (
      SELECT id FROM sub_items WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY sub_item_values_modify ON sub_item_values FOR ALL
  USING (
    sub_item_id IN (
      SELECT id FROM sub_items WHERE workspace_id = auth_workspace_id()
    )
  );

-- ---------------------------------------------------------------------------
-- SUB_ITEM_VIEWS
-- ---------------------------------------------------------------------------
CREATE POLICY sub_item_views_select ON sub_item_views FOR SELECT
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY sub_item_views_modify ON sub_item_views FOR ALL
  USING (
    board_id IN (
      SELECT id FROM boards WHERE workspace_id = auth_workspace_id()
    )
    AND auth_is_admin()
  );

-- ---------------------------------------------------------------------------
-- ITEM_CHANNELS / CHANNEL_MESSAGES / CHANNEL_MEMBERS / MENTIONS
-- ---------------------------------------------------------------------------
CREATE POLICY item_channels_select ON item_channels FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY item_channels_insert ON item_channels FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY item_channels_modify ON item_channels FOR UPDATE USING (workspace_id = auth_workspace_id());
CREATE POLICY item_channels_delete ON item_channels FOR DELETE USING (workspace_id = auth_workspace_id());

CREATE POLICY channel_messages_select ON channel_messages FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY channel_messages_insert ON channel_messages FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY channel_members_select ON channel_members FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM item_channels WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY channel_members_modify ON channel_members FOR ALL
  USING (
    channel_id IN (
      SELECT id FROM item_channels WHERE workspace_id = auth_workspace_id()
    )
  );

CREATE POLICY mentions_select ON mentions FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY mentions_insert ON mentions FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY mentions_update ON mentions FOR UPDATE
  USING (
    workspace_id = auth_workspace_id()
    AND mentioned_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- ITEM_ACTIVITY
-- ---------------------------------------------------------------------------
CREATE POLICY item_activity_select ON item_activity FOR SELECT
  USING (workspace_id = auth_workspace_id());

-- Insert solo via service role (triggers) — usuarios no insertan directamente
CREATE POLICY item_activity_insert ON item_activity FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

-- ---------------------------------------------------------------------------
-- QUOTE_TEMPLATES / QUOTES
-- ---------------------------------------------------------------------------
CREATE POLICY quote_templates_select ON quote_templates FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY quote_templates_modify ON quote_templates FOR ALL
  USING (workspace_id = auth_workspace_id() AND auth_is_admin());

CREATE POLICY quotes_select ON quotes FOR SELECT
  USING (workspace_id = auth_workspace_id());

CREATE POLICY quotes_insert ON quotes FOR INSERT
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY quotes_update ON quotes FOR UPDATE
  USING (workspace_id = auth_workspace_id());
