import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { resolveBoardBySid } from '@/lib/boards'
import { BoardView } from './BoardView'

type Props = {
  params: Promise<{ boardSid: string }>
}

export default async function BoardPage({ params }: Props) {
  const { boardSid } = await params
  const sid = parseInt(boardSid, 10)
  if (isNaN(sid)) notFound()

  const user  = await requireAuth()
  const board = await resolveBoardBySid(sid, user.workspaceId)

  if (!board) notFound()

  return (
    <BoardView
      boardId={board.id}
      boardSid={board.sid}
      boardName={board.name}
    />
  )
}
