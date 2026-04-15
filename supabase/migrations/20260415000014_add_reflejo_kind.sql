-- Add 'reflejo' to board_columns kind check constraint (Fase 16.6)
ALTER TABLE board_columns
  DROP CONSTRAINT board_columns_kind_check;

ALTER TABLE board_columns
  ADD CONSTRAINT board_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo'
  ));

-- Same for sub_item_columns (futuro: ref cols en sub-items)
ALTER TABLE sub_item_columns
  DROP CONSTRAINT IF EXISTS sub_item_columns_kind_check;

ALTER TABLE sub_item_columns
  ADD CONSTRAINT sub_item_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo'
  ));
