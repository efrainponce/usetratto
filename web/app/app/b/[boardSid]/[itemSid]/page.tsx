import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { requireBoardAdmin } from '@/lib/permissions'
import { resolveBoardBySid, resolveItemBySid, getBoardContext, getWorkspaceUsers, getItemData, getSubItemViews } from '@/lib/boards'
import { ItemDetailView } from './ItemDetailView'

type Props = {
  params: Promise<{ boardSid: string; itemSid: string }>
}

export default async function ItemPage({ params }: Props) {
  const { boardSid, itemSid } = await params
  const boardSidNum = parseInt(boardSid, 10)
  const itemSidNum  = parseInt(itemSid, 10)

  if (isNaN(boardSidNum) || isNaN(itemSidNum)) notFound()

  const user  = await requireAuth()
  const board = await resolveBoardBySid(boardSidNum, user.workspaceId)
  if (!board) notFound()

  const item = await resolveItemBySid(itemSidNum, board.id, user.workspaceId)
  if (!item) notFound()

  const [{ stages, columns }, users, itemData, subItemViews, isBoardAdmin] = await Promise.all([
    getBoardContext(board.id),
    getWorkspaceUsers(user.workspaceId),
    getItemData(item.id, user.workspaceId),
    getSubItemViews(board.id, user.workspaceId),
    requireBoardAdmin(board.id, user.userId, user.workspaceId, user.role),
  ])

  if (!itemData) notFound()

  const boardSettings = (board.settings ?? {}) as Record<string, unknown>
  const subitemView   = (boardSettings.subitem_view ?? 'L1_L2') as 'L1_only' | 'L1_L2' | 'L2_only'

  return (
    <ItemDetailView
      boardId={board.id}
      boardSid={board.sid}
      boardName={board.name}
      initialStages={stages}
      initialColumns={columns}
      initialUsers={users}
      initialItem={itemData}
      initialSubItemViews={subItemViews}
      boardSettings={boardSettings}
      subitemView={subitemView}
      isBoardAdmin={isBoardAdmin}
    />
  )
}
