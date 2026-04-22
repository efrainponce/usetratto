-- ---------------------------------------------------------------------------
-- Catálogo: foto como image + primera columna en la vista Default
-- ---------------------------------------------------------------------------
-- La migración 20260422000005 solo tocó board_columns.position, pero el orden
-- visible lo controla board_view_columns.position por vista. Esta migración
-- reordena las posiciones en todas las vistas del board Catálogo y asegura
-- que foto sea kind='image' (idempotente).

DO $$
DECLARE
  b_id           uuid;
  v_id           uuid;
  c_foto         uuid;
  c_sku          uuid;
  c_descripcion  uuid;
  c_unit_price   uuid;
  c_owner        uuid;
BEGIN
  FOR b_id IN SELECT id FROM boards WHERE system_key = 'catalog'
  LOOP
    -- Asegurar kind=image en board_columns (idempotente)
    UPDATE board_columns SET kind = 'image'
      WHERE board_id = b_id AND col_key = 'foto' AND kind = 'file';

    -- Ids de columnas
    SELECT id INTO c_foto        FROM board_columns WHERE board_id = b_id AND col_key = 'foto';
    SELECT id INTO c_sku         FROM board_columns WHERE board_id = b_id AND col_key = 'sku';
    SELECT id INTO c_descripcion FROM board_columns WHERE board_id = b_id AND col_key = 'descripcion';
    SELECT id INTO c_unit_price  FROM board_columns WHERE board_id = b_id AND col_key = 'unit_price';
    SELECT id INTO c_owner       FROM board_columns WHERE board_id = b_id AND col_key = 'owner';

    -- Reordenar en cada vista del board (incluye Default y cualquiera custom)
    FOR v_id IN SELECT id FROM board_views WHERE board_id = b_id
    LOOP
      -- Upsert: si la vista no tiene fila para la columna, la creamos; si sí, update
      INSERT INTO board_view_columns (view_id, column_id, position, is_visible, width)
        VALUES (v_id, c_foto, 1, true, 80)
      ON CONFLICT (view_id, column_id) DO UPDATE SET position = 1, is_visible = true;

      UPDATE board_view_columns SET position = 2 WHERE view_id = v_id AND column_id = c_sku;
      UPDATE board_view_columns SET position = 3 WHERE view_id = v_id AND column_id = c_descripcion;
      UPDATE board_view_columns SET position = 4 WHERE view_id = v_id AND column_id = c_unit_price;
      UPDATE board_view_columns SET position = 5 WHERE view_id = v_id AND column_id = c_owner;
    END LOOP;
  END LOOP;
END $$;
