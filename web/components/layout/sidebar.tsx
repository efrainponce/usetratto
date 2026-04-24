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

// Iconos del design handoff — stroke 1.6, monocromos, estilo uniforme
const svgBase = {
  width:           '16',
  height:          '16',
  viewBox:         '0 0 24 24',
  fill:            'none',
  stroke:          'currentColor',
  strokeWidth:     '1.6',
  strokeLinecap:   'round' as const,
  strokeLinejoin:  'round' as const,
}

function BoardSvgIcon({ systemKey }: { systemKey: string | null }) {
  switch (systemKey) {
    case 'opportunities':
      // Bandera = oportunidad abierta (Flag del handoff)
      return (
        <svg {...svgBase}>
          <path d="M5 21V4h12l-2 4 2 4H5" />
        </svg>
      )
    case 'contacts':
      // Dos personas (Users del handoff) — más claro que una sola
      return (
        <svg {...svgBase}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
          <circle cx="17" cy="7" r="2.5" />
          <path d="M15 14c2.5 0 5 1.5 5 4" />
        </svg>
      )
    case 'accounts':
      // Edificio del handoff
      return (
        <svg {...svgBase}>
          <rect x="4" y="3" width="16" height="18" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
          <line x1="9" y1="13" x2="9.01" y2="13" />
          <line x1="15" y1="13" x2="15.01" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      )
    case 'vendors':
      // Camión del handoff
      return (
        <svg {...svgBase}>
          <rect x="2" y="7" width="12" height="10" />
          <polygon points="14 10 19 10 22 14 22 17 14 17" />
          <circle cx="6" cy="19" r="2" />
          <circle cx="18" cy="19" r="2" />
        </svg>
      )
    case 'catalog':
      // Caja 3D del handoff
      return (
        <svg {...svgBase}>
          <path d="M12 3l9 5v8l-9 5-9-5V8z" />
          <path d="M3 8l9 5 9-5" />
          <line x1="12" y1="13" x2="12" y2="21" />
        </svg>
      )
    case 'quotes':
      // Documento del handoff
      return (
        <svg {...svgBase}>
          <path d="M14 3H6v18h12V7z" />
          <polyline points="14 3 14 7 18 7" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
        </svg>
      )
    default:
      return (
        <svg {...svgBase}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
      )
  }
}

// Prioridad de orden de system boards. Valores más bajos = aparecen primero.
const SYSTEM_BOARD_ORDER: Record<string, number> = {
  opportunities: 0,
  contacts:      1,
  accounts:      2,
  catalog:       3,
  quotes:        4,
  vendors:       5,
}

function systemBoardRank(key: string | null): number {
  if (!key) return 999
  return SYSTEM_BOARD_ORDER[key] ?? 100
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

  const systemBoards = boards
    .filter(b => b.system_key !== null)
    .slice()
    .sort((a, b) => systemBoardRank(a.system_key) - systemBoardRank(b.system_key))
  const customBoards = boards.filter(b => b.system_key === null)

  return (
    <div className="group relative w-[56px] flex-none h-screen">
      <aside
        className={[
          'absolute top-0 left-0 h-screen z-40',
          'w-[56px] group-hover:w-[232px]',
          'transition-[width] duration-200 ease-out',
          'bg-[var(--bg-2)] border-r border-[var(--border)]',
          'px-[10px] pt-0 pb-[14px] flex flex-col gap-1 overflow-hidden',
          'group-hover:shadow-[var(--shadow-lg)]',
        ].join(' ')}
      >

        {/* Brand — logo Tratto "dos tiras" */}
        <div className="h-[56px] flex-none flex items-center gap-[10px] pl-[13px] pr-[10px] group-hover:pl-[10px] border-b border-[var(--border)] -mx-[10px] mb-2 transition-[padding] duration-200 ease-out">
          <div className="w-[30px] h-[30px] flex-none flex items-center justify-center bg-[var(--brand)] text-[var(--brand-ink)] rounded-[var(--radius)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 6c3 3 5 6 7 12" />
              <path d="M10 6c3 3 5 6 7 12" />
            </svg>
          </div>
          <div className="font-mono-tabular font-bold text-[17px] tracking-[0.04em] uppercase text-[var(--ink)] leading-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
            TRATTO
          </div>
        </div>

        {/* Boards label */}
        <div className="label-caps px-[10px] pt-[6px] pb-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
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

          {/* Workspace label */}
          <div className="label-caps px-[10px] pt-1 pb-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-75">
            Espacio
          </div>

          {/* Workspace chip */}
          <div className="flex items-center gap-[10px] px-[3px] py-2 rounded-[var(--radius)] group-hover:bg-[var(--surface-2)] group-hover:border group-hover:border-[var(--border)] group-hover:px-[10px] transition-all duration-150">
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
