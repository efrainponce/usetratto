import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { resolveBoardBySlug } from '@/lib/boards'
import { BoardView } from './BoardView'

type Props = {
  params: Promise<{ boardSlug: string }>
}

export default async function BoardPage({ params }: Props) {
  const { boardSlug } = await params
  const user  = await requireAuth()
  const board = await resolveBoardBySlug(boardSlug, user.workspaceId)

  if (!board) notFound()

  return (
    <BoardView
      boardId={board.id}
      boardSlug={board.slug}
      boardName={board.name}
    />
  )
}
