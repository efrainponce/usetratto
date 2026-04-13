'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export type SidebarBoard = {
  id: string
  sid: number
  slug: string
  name: string
  type: string
  system_key: string | null
}

export type SidebarUser = {
  name: string | null
  role: string
}

type Props = {
  boards: SidebarBoard[]
  user: SidebarUser
  workspaceName: string
}

const BOARD_COLORS: Record<string, string> = {
  opportunities: '#6366f1',
  contacts:      '#3b82f6',
  accounts:      '#10b981',
  vendors:       '#f59e0b',
  catalog:       '#ec4899',
}

function boardColor(systemKey: string | null): string {
  if (!systemKey) return '#94a3b8'
  return BOARD_COLORS[systemKey] ?? '#94a3b8'
}

function initial(name: string | null): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

export default function Sidebar({ boards, user, workspaceName }: Props) {
  const pathname = usePathname()
  const router   = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const systemBoards = boards.filter(b => b.system_key !== null)
  const customBoards = boards.filter(b => b.system_key === null)

  return (
    <aside className="w-[220px] flex-none flex flex-col h-screen bg-white border-r border-gray-100">

      {/* Workspace */}
      <div className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center flex-none">
            <span className="text-white text-[11px] font-bold">T</span>
          </div>
          <span className="text-[13px] font-semibold text-gray-900 truncate">{workspaceName}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">

        {systemBoards.length > 0 && (
          <div className="mb-3">
            <div className="px-2 mb-1">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium select-none">
                Boards
              </span>
            </div>
            {systemBoards.map(board => (
              <BoardItem key={board.id} board={board} pathname={pathname} />
            ))}
          </div>
        )}

        {customBoards.length > 0 && (
          <div>
            <div className="px-2 mb-1 mt-3">
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium select-none">
                Mis boards
              </span>
            </div>
            {customBoards.map(board => (
              <BoardItem key={board.id} board={board} pathname={pathname} />
            ))}
          </div>
        )}

        {boards.length === 0 && (
          <p className="px-2 text-[12px] text-gray-400">
            No hay boards configurados.
          </p>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 px-2 py-2 space-y-0.5">
        <Link
          href="/app/settings"
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors"
        >
          <IconSettings />
          Configuración
        </Link>

        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-none">
            {initial(user.name)}
          </div>
          <span className="text-[12px] text-gray-600 truncate flex-1">
            {user.name ?? 'Usuario'}
          </span>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="text-gray-300 hover:text-gray-600 transition-colors"
          >
            <IconLogout />
          </button>
        </div>
      </div>

    </aside>
  )
}

function BoardItem({ board, pathname }: { board: SidebarBoard; pathname: string }) {
  const active =
    pathname === `/app/b/${board.slug}` ||
    pathname.startsWith(`/app/b/${board.slug}/`)

  return (
    <Link
      href={`/app/b/${board.slug}`}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] transition-colors ${
        active
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <span
        className="w-2 h-2 rounded-sm flex-none"
        style={{ backgroundColor: boardColor(board.system_key) }}
      />
      {board.name}
    </Link>
  )
}

function IconSettings() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
