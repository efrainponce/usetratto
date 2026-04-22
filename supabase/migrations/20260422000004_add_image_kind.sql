-- Add 'image' column kind — stores JSON array of {path, thumb_path, name, mime, size}
ALTER TABLE board_columns
  DROP CONSTRAINT board_columns_kind_check;

ALTER TABLE board_columns
  ADD CONSTRAINT board_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo','image'
  ));

ALTER TABLE sub_item_columns
  DROP CONSTRAINT IF EXISTS sub_item_columns_kind_check;

ALTER TABLE sub_item_columns
  ADD CONSTRAINT sub_item_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup','reflejo','image'
  ));
