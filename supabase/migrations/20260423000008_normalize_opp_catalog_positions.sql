-- Normalize sub_item_column positions on opp Catálogo views to the opinionated order.
-- SKU=1, Cantidad=2, Precio=3, Descripción=4, Unidad=5, Imagen=6, Subtotal=7.

UPDATE sub_item_columns sic
SET position = CASE sic.col_key
  WHEN 'sku'         THEN 1
  WHEN 'cantidad'    THEN 2
  WHEN 'unit_price'  THEN 3
  WHEN 'descripcion' THEN 4
  WHEN 'unidad'      THEN 5
  WHEN 'foto'        THEN 6
  WHEN 'subtotal'    THEN 7
  ELSE sic.position
END
FROM sub_item_views siv
JOIN boards b ON b.id = siv.board_id
WHERE sic.view_id = siv.id
  AND b.system_key = 'opportunities'
  AND siv.type = 'native'
  AND sic.col_key IN ('sku','cantidad','unit_price','descripcion','unidad','foto','subtotal');
