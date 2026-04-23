import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { getBoardMembership } from './_helpers'

const Input = z.object({})

type Out = {
  boards: Array<{
    sid:         number
    name:        string
    type:        'pipeline' | 'table'
    system_key:  string | null
    access:      string
  }>
}

async function handler(_: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()
  const { data: boards } = await service
    .from('boards')
    .select('id, sid, name, type, system_key')
    .eq('workspace_id', ctx.workspaceId)
    .order('name')

  const out: Out['boards'] = []
  for (const b of boards ?? []) {
    const member = await getBoardMembership(ctx, (b as any).id)
    if (!member) continue
    out.push({
      sid:        (b as any).sid,
      name:       (b as any).name,
      type:       (b as any).type,
      system_key: (b as any).system_key,
      access:     member.access,
    })
  }
  return { boards: out }
}

export const listBoards: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'list_boards',
  description: 'Lista todos los boards a los que el usuario tiene acceso en este workspace, con tipo (pipeline/table) y nivel de acceso.',
  inputSchema: Input,
  handler,
}
