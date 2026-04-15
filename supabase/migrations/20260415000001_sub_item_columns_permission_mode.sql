-- Fase 16.1 — Herencia de permisos de columna (sub_item_columns)
-- Modo de permisos: public (default, visible para todos los miembros del board),
-- inherit (hereda column_permissions de la columna fuente via source_col_key),
-- custom (usa column_permissions propios en tabla column_permissions).

ALTER TABLE sub_item_columns
  ADD COLUMN permission_mode text NOT NULL DEFAULT 'public'
    CHECK (permission_mode IN ('public', 'inherit', 'custom'));

COMMENT ON COLUMN sub_item_columns.permission_mode IS
  'public: all board members see; inherit: inherit column_permissions from source_col_key; custom: use own column_permissions';
