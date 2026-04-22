import type { SubItemColumn as BaseSubItemColumn } from '@/lib/boards'
import type { SubItemData, SourceItem } from '@/lib/boards/types'

export type SubItemView = {
  id:       string
  sid:      number
  name:     string
  position: number
  type:     'native' | 'board_items' | 'board_sub_items'
  config:   Record<string, unknown>
}

export type SubItemColumn = BaseSubItemColumn & {
  is_system?:       boolean
  permission_mode?: 'public' | 'inherit' | 'custom'
  user_access?:     'edit' | 'view' | null
}

export type BoardColumn = {
  id:       string
  col_key:  string
  name:     string
  kind:     string
  position: number
  is_hidden: boolean
  settings: Record<string, unknown>
}

export type NativeData     = { kind: 'native';          columns: SubItemColumn[]; items: SubItemData[] }
export type BoardItemsData = { kind: 'board_items';      source_board_id: string; source_board_sid: number | null; source_board_name: string; columns: BoardColumn[]; items: SourceItem[] }
export type BoardSubData   = { kind: 'board_sub_items';  source_board_id: string; columns: SubItemColumn[]; items: SubItemData[] }
export type ViewData       = NativeData | BoardItemsData | BoardSubData

export type EditTarget = { id: string; field: string } | null
