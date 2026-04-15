-- Add 'rollup' to board_columns kind check constraint
ALTER TABLE board_columns
  DROP CONSTRAINT board_columns_kind_check;

ALTER TABLE board_columns
  ADD CONSTRAINT board_columns_kind_check
  CHECK (kind IN (
    'text','number','date','select','multiselect',
    'people','boolean','url','file','email','phone',
    'autonumber','formula','relation',
    'button','signature','rollup'
  ));
