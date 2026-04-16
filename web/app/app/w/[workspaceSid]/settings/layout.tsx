import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import SettingsNav from './SettingsNav'

type Props = {
  children: React.ReactNode
  params: Promise<{ workspaceSid: string }>
}

export default async function SettingsLayout({
  children,
  params,
}: Props) {
  const user = await requireAuth()
  const { workspaceSid } = await params

  return (
    <div className="flex h-full bg-white">
      <SettingsNav role={user.role} workspaceSid={parseInt(workspaceSid, 10)} />

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl px-10 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
