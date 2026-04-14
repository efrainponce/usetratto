-- =============================================================================
-- 009_column_permissions_polymorphic.sql
-- Make column_permissions support both board_columns and sub_item_columns
-- =============================================================================

-- 1. Make column_id nullable to support polymorphic references
ALTER TABLE column_permissions ALTER COLUMN column_id DROP NOT NULL;

-- 2. Add sub_item_column_id foreign key
ALTER TABLE column_permissions
  ADD COLUMN sub_item_column_id uuid REFERENCES sub_item_columns(id) ON DELETE CASCADE;

-- 3. Add CHECK constraint: exactly one of column_id or sub_item_column_id must be NOT NULL
ALTER TABLE column_permissions
  ADD CONSTRAINT col_perms_exactly_one CHECK (
    (column_id IS NOT NULL)::int + (sub_item_column_id IS NOT NULL)::int = 1
  );

-- 4. Add index on sub_item_column_id for efficient lookups
CREATE INDEX IF NOT EXISTS column_permissions_sub_item_col_idx
  ON column_permissions(sub_item_column_id)
  WHERE sub_item_column_id IS NOT NULL;

-- 5. Drop existing column_permissions policies
DROP POLICY IF EXISTS column_permissions_select ON column_permissions;
DROP POLICY IF EXISTS column_permissions_modify ON column_permissions;

-- 6. Recreate column_permissions_select to handle both column_id and sub_item_column_id
CREATE POLICY column_permissions_select ON column_permissions FOR SELECT
  USING (
    -- Check access via board_columns → boards → workspace_id
    column_id IN (
      SELECT bc.id FROM board_columns bc
      JOIN boards b ON b.id = bc.board_id
      WHERE b.workspace_id = auth_workspace_id()
    )
    OR
    -- Check access via sub_item_columns → boards → workspace_id
    sub_item_column_id IN (
      SELECT sic.id FROM sub_item_columns sic
      JOIN boards b ON b.id = sic.board_id
      WHERE b.workspace_id = auth_workspace_id()
    )
  );

-- 7. Recreate column_permissions_modify policy (admins only)
CREATE POLICY column_permissions_modify ON column_permissions FOR ALL
  USING (auth_is_admin());
