import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import type { TrattoTool, AgentContext } from '../types'
import { resolveItemBySid, getBoardMembership } from './_helpers'

const Input = z.object({
  item_sid: z.number().int().positive(),
  text:     z.string().min(1).max(2000),
})

type Out = {
  sid:         number
  channel:     string
  message_id:  string
}

async function handler(input: z.infer<typeof Input>, ctx: AgentContext): Promise<Out> {
  const service = createServiceClient()

  const item = await resolveItemBySid(ctx, input.item_sid)
  if (!item) throw new Error(`Item ${input.item_sid} no encontrado`)

  const member = await getBoardMembership(ctx, item.board_id)
  if (!member) throw new Error('Sin acceso al board')
  if (member.restrict_to_own && item.owner_id !== ctx.userId) {
    throw new Error(`Item ${input.item_sid} no encontrado`)
  }

  // Busca canal "General" del item (o el primer internal)
  const { data: channels } = await service
    .from('item_channels')
    .select('id, name, type')
    .eq('item_id', item.id)
    .order('position', { ascending: true })

  let channel = (channels ?? []).find((c: any) => c.name === 'General')
    ?? (channels ?? []).find((c: any) => c.type === 'internal')
    ?? (channels ?? [])[0]

  if (!channel) throw new Error('El item no tiene canales')

  const { data: msg, error } = await service
    .from('channel_messages')
    .insert({
      workspace_id: ctx.workspaceId,
      channel_id:   (channel as any).id,
      user_id:      ctx.userId,
      body:         input.text,
      type:         'text',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  return {
    sid:        item.sid,
    channel:    (channel as any).name,
    message_id: (msg as any).id,
  }
}

export const addMessage: TrattoTool<z.infer<typeof Input>, Out> = {
  name:        'add_message',
  description: 'Postea un mensaje en el canal General del item (o el primer canal interno si no existe General).',
  inputSchema: Input,
  handler,
}
