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
  | 'button'
  | 'signature'
  | 'formula'
  | 'rollup'

export type SelectOption = {
  value: string
  label: string
  color?: string  // hex color
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
  action?:          'change_stage' | 'create_quote' | 'run_automation'
  stage_id?:        string
  template_id?:     string
  automation_id?:   string
  confirm?:         boolean
  confirm_message?: string
  // signature
  allowed_roles?:   string[]
  column_id?:       string           // UUID fallback para SignatureCell
  // formula
  formula_config?: { type: string; [key: string]: unknown }
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
  text:        200,
  file:        180,
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
  isEditing:   boolean
  rowId:       string
  onStartEdit: () => void
  onCommit:    (value: CellValue) => void
  onCancel:    () => void
  onNavigate:  (dir: NavDirection) => void
}
