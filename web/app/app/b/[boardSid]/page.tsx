import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { resolveBoardBySid, getBoardContext, getWorkspaceUsers, getBoardItems, getSubItemColumns, type SubItemColumn } from '@/lib/boards'
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

  const [{ stages, columns }, users, items, subItemColumns] = await Promise.all([
    getBoardContext(board.id),
    getWorkspaceUsers(user.workspaceId),
    getBoardItems(board.id, user.workspaceId),
    getSubItemColumns(board.id),
  ])

  return (
    <BoardView
      boardId={board.id}
      boardSid={board.sid}
      boardName={board.name}
      initialStages={stages}
      initialColumns={columns}
      initialUsers={users}
      initialItems={items}
      initialSubItemColumns={subItemColumns}
      initialSourceBoardId={board.sub_items_source_board_id ?? null}
    />
  )
}
