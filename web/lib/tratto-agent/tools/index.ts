import 'server-only'
import type { TrattoTool, LLMToolSpec } from '../types'
import { zodToJsonSchema } from '../llm'
import { searchItems } from './search-items'
import { getItem } from './get-item'
import { createItem } from './create-item'
import { updateItem } from './update-item'
import { changeStage } from './change-stage'
import { addMessage } from './add-message'
import { listBoards } from './list-boards'
import { getBoardSummary } from './get-board-summary'

export const TRATTO_TOOLS: TrattoTool<any, any>[] = [
  searchItems,
  getItem,
  createItem,
  updateItem,
  changeStage,
  addMessage,
  listBoards,
  getBoardSummary,
]

export const TOOL_BY_NAME = new Map<string, TrattoTool<any, any>>(
  TRATTO_TOOLS.map(t => [t.name, t]),
)

export function toolsAsLLMSpecs(): LLMToolSpec[] {
  return TRATTO_TOOLS.map(t => ({
    name:        t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
  }))
}
