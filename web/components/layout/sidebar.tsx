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
  workspaceSid:  number
}

// ─── Icon map per system_key ──────────────────────────────────────────────────

function BoardSvgIcon({ systemKey }: { systemKey: string | null }) {
  switch (systemKey) {
    case 'opportunities':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
        </svg>
      )
    case 'contacts':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'accounts':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M9 16h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        </svg>
      )
    case 'vendors':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <path d="M16 8h4l3 5v4h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      )
    case 'catalog':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      )
    case 'quotes':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
      )
  }
}

function initial(name: string | null) {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar({ boards, user, workspaceName, workspaceSid }: Props) {
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
    <div className="group relative w-[56px] flex-none h-screen">
      <aside
        className={[
          'absolute top-0 left-0 h-screen z-40',
          'w-[56px] group-hover:w-[232px]',
          'transition-[width] duration-200 ease-out',
          'bg-[var(--bg-2)] border-r border-[var(--border)]',
          'px-[10px] py-[14px] flex flex-col gap-1 overflow-hidden',
          'group-hover:shadow-[var(--shadow-lg)]',
        ].join(' ')}
      >

        {/* Brand */}
        <div className="flex items-center gap-[10px] px-[3px] pb-4">
          <div className="w-[30px] h-[30px] flex-none flex items-center justify-center bg-[var(--brand)] text-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-[13px]">
            T
          </div>
          <div className="font-mono-tabular font-bold text-[17px] tracking-[0.04em] uppercase text-[var(--ink)] leading-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
            TRATTO
          </div>
        </div>

        {/* Workspace label */}
        <div className="label-caps px-[10px] pt-[10px] pb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
          Espacio
        </div>

        {/* Workspace chip */}
        <div className="flex items-center gap-[10px] px-[3px] py-2 mb-1.5 rounded-[var(--radius)] group-hover:bg-[var(--surface-2)] group-hover:border group-hover:border-[var(--border)] group-hover:px-[10px] transition-all duration-150">
          <div className="w-[28px] h-[28px] flex-none flex items-center justify-center bg-[var(--brand)] text-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-[12px]">
            {initial(workspaceName)}
          </div>
          <div className="flex-1 min-w-0 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
            <div className="text-[13px] font-semibold text-[var(--ink)] leading-tight truncate">
              {workspaceName}
            </div>
            <div className="text-[11px] text-[var(--ink-3)] font-normal mt-0.5 leading-tight truncate">
              {user.role} · workspace
            </div>
          </div>
        </div>

        {/* Boards label */}
        <div className="label-caps px-[10px] pt-[10px] pb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
          Boards
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-px">
          {boards.length === 0 ? (
            <div className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] text-[var(--ink-4)] opacity-50 cursor-default whitespace-nowrap">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Sin boards</span>
            </div>
          ) : (
            <>
              {systemBoards.map(board => (
                <BoardNavItem key={board.id} board={board} pathname={pathname} workspaceSid={workspaceSid} />
              ))}

              {customBoards.length > 0 && systemBoards.length > 0 && (
                <div className="h-px bg-[var(--border)] my-1 mx-[10px]" />
              )}

              {customBoards.map(board => (
                <BoardNavItem key={board.id} board={board} pathname={pathname} workspaceSid={workspaceSid} />
              ))}
            </>
          )}
        </nav>

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex flex-col gap-1">
          <Link
            href={`/app/w/${workspaceSid}/settings`}
            className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors whitespace-nowrap"
          >
            <div className="flex-none text-[var(--ink-3)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">Configuración</span>
          </Link>

          <div className="h-px bg-[var(--border)] my-1 mx-[10px]" />

          <button
            onClick={logout}
            className="flex items-center gap-[10px] px-[3px] py-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] transition-colors w-full text-left group-hover:px-[10px]"
            title="Cerrar sesión"
          >
            <div className="w-[28px] h-[28px] flex-none flex items-center justify-center bg-[var(--ink-3)] text-[var(--bg)] rounded-full font-semibold text-[11px]">
              {initial(user.name)}
            </div>
            <div className="flex-1 min-w-0 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
              <div className="text-[12.5px] font-medium text-[var(--ink)] leading-tight truncate">
                {user.name ?? 'Usuario'}
              </div>
              <div className="text-[11px] text-[var(--ink-4)] font-normal mt-0.5 leading-tight truncate">
                {user.role}
              </div>
            </div>
          </button>
        </div>

      </aside>
    </div>
  )
}

// ─── Board nav item ──────────────────────────────────────────────────────────

function BoardNavItem({
  board,
  pathname,
  workspaceSid,
}: {
  board: SidebarBoard
  pathname: string
  workspaceSid: number
}) {
  const active =
    pathname === `/app/w/${workspaceSid}/b/${board.sid}` ||
    pathname.startsWith(`/app/w/${workspaceSid}/b/${board.sid}/`)

  return (
    <Link
      href={`/app/w/${workspaceSid}/b/${board.sid}`}
      className={[
        'flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] transition-colors whitespace-nowrap',
        active
          ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] shadow-[var(--shadow-sm)]'
          : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
      ].join(' ')}
      title={board.name}
    >
      <div className={`flex-none ${active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]'}`}>
        <BoardSvgIcon systemKey={board.system_key} />
      </div>
      <span className="flex-1 truncate opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">{board.name}</span>
    </Link>
  )
}
