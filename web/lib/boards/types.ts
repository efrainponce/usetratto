// Client-safe shared types. No "server-only" — importable from client components.

export type SubItemValue = {
  column_id:    string
  col_key:      string
  value_text:   string | null
  value_number: number | null
  value_date:   string | null
  value_json:   unknown
}

export type SubItemData = {
  id:                string
  sid:               number
  parent_id:         string | null
  depth:             number
  name:              string
  position:          number
  source_item_id:    string | null
  source_item_sid?:  number | null
  source_board_sid?: number | null
  values:            SubItemValue[]
  children?:         SubItemData[]
}

export type ColPermission = {
  id:       string
  user_id:  string | null
  team_id:  string | null
  access:   'view' | 'edit'
  users?:   { id: string; name: string; sid?: number }
  teams?:   { id: string; name: string; sid?: number }
}

export type SourceItem = {
  id:          string
  sid:         number
  name:        string
  stage_id:    string | null
  item_values?: {
    column_id:    string
    value_text:   string | null
    value_number: number | null
    value_date:   string | null
    value_json:   unknown
  }[]
}
