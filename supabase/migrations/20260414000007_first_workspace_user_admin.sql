-- Migration: promote to 'admin' any member who is the only user in their workspace
-- with no existing admin/superadmin. Fixes workspaces that were bootstrapped before
-- the provisioning logic defaulted the first user to 'admin'.

UPDATE users
SET role = 'admin'
WHERE role = 'member'
  AND workspace_id IS NOT NULL
  AND workspace_id NOT IN (
    SELECT DISTINCT workspace_id
    FROM users
    WHERE role IN ('admin', 'superadmin')
      AND workspace_id IS NOT NULL
  );
