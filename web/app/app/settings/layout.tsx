import { requireAuth } from '@/lib/auth'
import SettingsNav from './SettingsNav'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div className="flex h-full bg-white">
      <SettingsNav role={user.role} />

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl px-10 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
