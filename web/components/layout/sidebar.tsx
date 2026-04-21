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

// ─── Utility ──────────────────────────────────────────────────────────────────

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
    <aside className="w-[232px] flex-none flex flex-col h-screen bg-[var(--bg-2)] border-r border-[var(--border)] px-[10px] py-[14px] gap-1">

      {/* Brand section */}
      <div className="flex items-center gap-[10px] px-[10px] pb-4">
        <div className="w-[30px] h-[30px] flex-none flex items-center justify-center bg-[var(--brand)] text-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-[13px]">
          T
        </div>
        <div className="font-mono-tabular font-bold text-[17px] tracking-[0.04em] uppercase text-[var(--ink)] leading-none">
          TRATTO
        </div>
      </div>

      {/* Workspace label */}
      <div className="label-caps px-[10px] pt-[10px] pb-1">
        Espacio
      </div>

      {/* Workspace chip */}
      <div className="flex items-center gap-[10px] px-[10px] py-2 mx-0 mb-1.5 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
        <div className="w-[28px] h-[28px] flex-none flex items-center justify-center bg-[var(--brand)] text-[var(--brand-ink)] rounded-[var(--radius)] font-bold text-[12px]">
          {initial(workspaceName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--ink)] leading-tight truncate">
            {workspaceName}
          </div>
          <div className="text-[11px] text-[var(--ink-3)] font-normal mt-0.5 leading-tight truncate">
            {user.role} · workspace
          </div>
        </div>
      </div>

      {/* Boards label */}
      <div className="label-caps px-[10px] pt-[10px] pb-1">
        Boards
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-px">
        {boards.length === 0 ? (
          <div className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] text-[var(--ink-4)] opacity-50 cursor-default">
            Sin boards
          </div>
        ) : (
          <>
            {systemBoards.map(board => (
              <BoardNavItem
                key={board.id}
                board={board}
                pathname={pathname}
                workspaceSid={workspaceSid}
              />
            ))}

            {customBoards.length > 0 && systemBoards.length > 0 && (
              <div className="h-px bg-[var(--border)] my-1" />
            )}

            {customBoards.map(board => (
              <BoardNavItem
                key={board.id}
                board={board}
                pathname={pathname}
                workspaceSid={workspaceSid}
              />
            ))}
          </>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer section */}
      <div className="flex flex-col gap-1">
        {/* Settings */}
        <Link
          href={`/app/w/${workspaceSid}/settings`}
          className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Configuración</span>
        </Link>

        {/* Divider */}
        <div className="h-px bg-[var(--border)] my-1" />

        {/* User section */}
        <button
          onClick={logout}
          className="flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] hover:bg-[var(--surface-2)] transition-colors w-full text-left"
        >
          <div className="w-[28px] h-[28px] flex-none flex items-center justify-center bg-[var(--ink-3)] text-[var(--bg)] rounded-full font-semibold text-[11px]">
            {initial(user.name)}
          </div>
          <div className="flex-1 min-w-0">
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
        'flex items-center gap-[10px] px-[10px] py-2 rounded-[var(--radius)] text-[13.5px] transition-colors',
        active
          ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)] shadow-[var(--shadow-sm)]'
          : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
      ].join(' ')}
    >
      <div className={`flex-none ${active ? 'text-[var(--brand)]' : 'text-[var(--ink-3)]'}`}>
        <BoardSvgIcon systemKey={board.system_key} name={board.name} />
      </div>
      <span className="flex-1 truncate">{board.name}</span>
    </Link>
  )
}
