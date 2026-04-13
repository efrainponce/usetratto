import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getFirstBoard } from '@/lib/boards'

export default async function AppPage() {
  const user  = await requireAuth()
  const board = await getFirstBoard(user.workspaceId)
  if (board) {
    redirect(`/app/b/${board.sid}`)
  }
  redirect('/login')
}
