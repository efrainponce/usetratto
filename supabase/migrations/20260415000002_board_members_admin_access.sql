-- Fase 16 extended — per-board admin access level
-- Extiende el check constraint de board_members.access para incluir 'admin'
-- admin = edit + gestionar schema del board (columnas, stages, permisos, miembros)

ALTER TABLE board_members
  DROP CONSTRAINT IF EXISTS board_members_access_check;

ALTER TABLE board_members
  ADD CONSTRAINT board_members_access_check
  CHECK (access IN ('view', 'edit', 'admin'));

COMMENT ON COLUMN board_members.access IS
  'view: solo lectura; edit: lectura + editar valores de celda; admin: lo anterior + gestionar schema del board (columnas, opciones, stages, permisos, miembros)';
