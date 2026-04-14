import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { resolveBoardBySid, getBoardContext, getWorkspaceUsers, getBoardItems, getSubItemColumns, getBoardViews, getSubItemViews, type SubItemColumn, type BoardView as BoardViewType } from '@/lib/boards'
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

  const [{ stages, columns }, users, items, subItemColumns, views, subItemViews] = await Promise.all([
    getBoardContext(board.id),
    getWorkspaceUsers(user.workspaceId),
    getBoardItems(board.id, user.workspaceId),
    getSubItemColumns(board.id),
    getBoardViews(board.id, board.workspace_id),
    getSubItemViews(board.id, user.workspaceId),
  ])

  const boardSettings = (board.settings ?? {}) as Record<string, unknown>
  const subitemView   = (boardSettings.subitem_view ?? 'L1_L2') as 'L1_only' | 'L1_L2' | 'L2_only'

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
      initialViews={views}
      initialSubItemViews={subItemViews}
      boardSettings={boardSettings}
      subitemView={subitemView}
    />
  )
}
