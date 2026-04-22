// ─── Column definitions ───────────────────────────────────────────────────────

export type CellKind =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'people'
  | 'boolean'
  | 'relation'
  | 'phone'
  | 'email'
  | 'autonumber'
  | 'file'
  | 'image'
  | 'button'
  | 'signature'
  | 'formula'
  | 'rollup'
  | 'reflejo'

export type SelectOption = {
  value: string
  label: string
  color?: string  // hex color
}

export type ColumnValidation = {
  condition: {
    col: string
    operator: 'empty' | 'not_empty' | '>' | '<' | '=' | '!=' | 'contains' | 'not_contains'
    value?: unknown
  }
  message: string
}

export type ColumnSettings = {
  options?:         SelectOption[]   // select, multiselect, people
  target_board_id?: string           // relation
  format?:          string           // number: 'integer' | 'decimal' | 'currency' | 'percent'
  placeholder?:     string
  // file
  max_files?:       number
  // button
  label?:           string
  action?:          'change_stage' | 'create_quote' | 'run_automation' | 'generate_document'
  target_stage_id?: string           // change_stage target
  stage_id?:        string           // legacy alias
  template_id?:     string
  automation_id?:   string
  confirm?:         boolean
  confirm_message?: string
  // signature
  allowed_roles?:   string[]
  column_id?:       string           // UUID fallback para SignatureCell
  // formula
  formula_config?:  { type: string; [key: string]: unknown }
  // rollup
  rollup_config?:   { source_level: string; source_col_key: string; aggregate: string }
  // validation
  validation?:      ColumnValidation
  // stage gates — keyed by stage_id, value is array of col_keys that must pass
  stage_gates?:     Record<string, string[]>
  // default value
  default_value?:   unknown
  // fase 16.5 — required field (enforced via stage gates + ColumnCell isInvalid)
  required?:        boolean
  // fase 16.5 — role metatag
  role?:            'owner' | 'primary_stage' | 'end_date'
  // fase 16.5 — system column display mode
  display?:         'read_only' | 'relative'
  read_only?:       boolean
  // fase 16.5 — auto_fill targets for relation cols
  auto_fill_targets?: Array<{ source_col_key: string; target_col_key: string }>
  // fase 16.6 — ref (mirror) column config
  ref_source_col_key?: string
  ref_field_col_key?:  string
  ref_field_kind?:     string
}

export type ColumnDef = {
  id?:       string           // UUID de board_columns (para endpoints que lo requieren)
  key:       string           // stable col_key from board_columns
  label:     string
  kind:      CellKind
  width?:    number           // px — uses DEFAULT_WIDTHS if omitted
  sticky?:   boolean          // true for the name column
  sortable?: boolean
  editable?: boolean          // default true; false for autonumber
  settings:  ColumnSettings
}

// Default column widths per kind
export const DEFAULT_WIDTHS: Record<CellKind, number> = {
  autonumber:  72,
  boolean:     60,
  date:        120,
  formula:     100,
  number:      100,
  phone:       140,
  email:       180,
  select:      130,
  multiselect: 170,
  people:      140,
  relation:    150,
  reflejo:     150,
  text:        200,
  file:        180,
  image:       180,
  button:      120,
  signature:   160,
  rollup:      100,
}

// ─── Row / cell data ──────────────────────────────────────────────────────────

export type CellValue = string | number | boolean | null | string[]

export type Row = {
  id:             string       // UUID for API calls
  sid?:           number       // displayed as autonumber
  cells:          Record<string, CellValue>
  hasSubItems:    boolean
  subItemsCount?: number       // L1 sub-item count for badge
  subRows?:       Row[]        // TanStack expansion — depth=1 children
}

// ─── Cell component contract ──────────────────────────────────────────────────

export type NavDirection = 'up' | 'down' | 'left' | 'right' | 'tab' | 'shifttab' | 'enter'

export type CellProps = {
  column:      ColumnDef
  value:       CellValue
  row?:        Record<string, CellValue>  // full row cells for validation + IF formulas
  allColumns?: ColumnDef[]               // all board columns — used by ButtonCell for gate validation
  isEditing:   boolean
  rowId:       string
  onStartEdit: () => void
  onCommit:    (value: CellValue) => void
  onCancel:    () => void
  onNavigate:  (dir: NavDirection) => void
}
