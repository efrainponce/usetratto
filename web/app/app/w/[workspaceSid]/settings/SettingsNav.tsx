'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }
type NavSection = { section: string; items: NavItem[] }

function buildNav(role: string, workspaceSid: number): NavSection[] {
  const nav: NavSection[] = [
    {
      section: 'Mi cuenta',
      items: [
        { label: 'Perfil', href: `/app/w/${workspaceSid}/settings/profile` },
      ],
    },
    {
      section: 'Workspace',
      items: [
        { label: 'General',      href: `/app/w/${workspaceSid}/settings/workspace` },
        { label: 'Miembros',     href: `/app/w/${workspaceSid}/settings/members` },
        { label: 'Equipos',      href: `/app/w/${workspaceSid}/settings/teams` },
        { label: 'Territorios',  href: `/app/w/${workspaceSid}/settings/territories` },
        { label: 'Boards',       href: `/app/w/${workspaceSid}/settings/boards` },
      ],
    },
    {
      section: 'Plan',
      items: [
        { label: 'Facturación', href: `/app/w/${workspaceSid}/settings/billing` },
      ],
    },
  ]

  if (role === 'superadmin') {
    nav.push({
      section: 'Superadmin',
      items: [
        { label: 'Workspaces', href: `/app/w/${workspaceSid}/settings/superadmin` },
      ],
    })
  }

  return nav
}

export default function SettingsNav({ role, workspaceSid }: { role: string; workspaceSid: number }) {
  const pathname = usePathname()
  const nav = buildNav(role, workspaceSid)

  return (
    <nav className="w-[200px] flex-none h-full border-r border-gray-100 bg-gray-50/50 px-3 py-6 overflow-y-auto">
      {nav.map(({ section, items }) => (
        <div key={section} className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2 mb-1">
            {section}
          </p>
          {items.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center h-8 rounded-md px-2 text-sm transition-colors',
                  active
                    ? 'bg-white text-gray-900 font-medium shadow-sm border border-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60',
                ].join(' ')}
              >
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
