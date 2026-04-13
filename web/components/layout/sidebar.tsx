'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export type SidebarBoard = {
  id:         string
  sid:        number
  slug:       string
  name:       string
  type:       string
  system_key: string | null
}

export type SidebarUser = {
  name: string | null
  role: string
}

type Props = {
  boards:        SidebarBoard[]
  user:          SidebarUser
  workspaceName: string
}

// ─── Icon map per system_key ──────────────────────────────────────────────────

function BoardIcon({ board, pathname }: { board: SidebarBoard; pathname: string }) {
  const active =
    pathname === `/app/b/${board.slug}` ||
    pathname.startsWith(`/app/b/${board.slug}/`)

  return (
    <Tooltip label={board.name} side="right">
      <Link
        href={`/app/b/${board.slug}`}
        className={[
          'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
          active
            ? 'bg-gray-900 text-white'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700',
        ].join(' ')}
      >
        <BoardSvgIcon systemKey={board.system_key} name={board.name} />
      </Link>
    </Tooltip>
  )
}

function BoardSvgIcon({ systemKey, name }: { systemKey: string | null; name: string }) {
  switch (systemKey) {
    case 'opportunities':
      return (
        // Funnel / pipeline
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
        </svg>
      )
    case 'contacts':
      return (
        // Person
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'accounts':
      return (
        // Building
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M9 16h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        </svg>
      )
    case 'vendors':
      return (
        // Truck
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 5v4h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'catalog':
      return (
        // Layers / stack
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      )
    default:
      // Custom board — table grid
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
      )
  }
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

function initial(name: string | null) {
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
    <aside className="w-[52px] flex-none flex flex-col h-screen bg-white border-r border-gray-100 items-center py-3 gap-0.5">

      {/* Logo */}
      <Tooltip label={workspaceName} side="right">
        <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-none mb-3 cursor-default">
          <span className="text-white text-[12px] font-bold select-none">T</span>
        </div>
      </Tooltip>

      {/* System boards */}
      {systemBoards.map(board => (
        <BoardIcon key={board.id} board={board} pathname={pathname} />
      ))}

      {/* Divider before custom boards */}
      {customBoards.length > 0 && (
        <div className="w-5 h-px bg-gray-200 my-2" />
      )}

      {customBoards.map(board => (
        <BoardIcon key={board.id} board={board} pathname={pathname} />
      ))}

      {/* Empty state hint */}
      {boards.length === 0 && (
        <Tooltip label="No hay boards" side="right">
          <div className="w-8 h-8 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          </div>
        </Tooltip>
      )}

      <div className="flex-1" />

      {/* Settings */}
      <Tooltip label="Configuración" side="right">
        <Link
          href="/app/settings"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </Tooltip>

      {/* User avatar + logout */}
      <Tooltip label={`${user.name ?? 'Usuario'} · Cerrar sesión`} side="right">
        <button
          onClick={logout}
          className="w-8 h-8 mt-0.5 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {initial(user.name)}
        </button>
      </Tooltip>

    </aside>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({
  children,
  label,
  side = 'right',
}: {
  children: React.ReactNode
  label:    string
  side?:   'right' | 'left'
}) {
  return (
    <div className="relative group flex items-center">
      {children}
      <div
        className={[
          'pointer-events-none absolute z-50 whitespace-nowrap',
          'px-2 py-1 bg-gray-900 text-white text-[11px] rounded-md',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          side === 'right' ? 'left-full ml-2' : 'right-full mr-2',
        ].join(' ')}
      >
        {label}
      </div>
    </div>
  )
}
