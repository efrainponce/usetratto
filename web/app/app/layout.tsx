import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import Sidebar, { type SidebarBoard } from '@/components/layout/sidebar'
import ChatRail from '@/components/ChatRail'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const supabase = createServiceClient()

  const [{ data: workspace }, { data: boards }] = await Promise.all([
    supabase
      .from('workspaces')
      .select('sid, name')
      .eq('id', user.workspaceId)
      .single(),
    supabase
      .from('boards')
      .select('id, sid, slug, name, type, system_key')
      .eq('workspace_id', user.workspaceId)
      .order('name'),
  ])

  return (
    <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
      <Sidebar
        boards={(boards ?? []) as SidebarBoard[]}
        user={{ name: user.name, role: user.role }}
        workspaceName={workspace?.name ?? 'Tratto'}
        workspaceSid={workspace?.sid ?? 0}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <ChatRail />
    </div>
  )
}
