import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getFirstBoard } from '@/lib/boards'
import { createServiceClient } from '@/lib/supabase/service'

export default async function AppPage() {
  const user = await requireAuth()

  // Get workspace SID
  const supabase = createServiceClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('sid')
    .eq('id', user.workspaceId)
    .single()

  if (!workspace) redirect('/login')

  // Get first board
  const board = await getFirstBoard(user.workspaceId)
  if (board) {
    redirect(`/app/w/${workspace.sid}/b/${board.sid}`)
  }

  redirect('/login')
}
