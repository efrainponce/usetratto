import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

type Props = {
  children: React.ReactNode
  params: Promise<{ workspaceSid: string }>
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const user = await requireAuth()
  const { workspaceSid } = await params

  // Parse workspace SID
  const wsId = parseInt(workspaceSid, 10)
  if (isNaN(wsId)) {
    redirect('/app')
  }

  // Resolve workspace by SID
  const supabase = createServiceClient()
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, sid, name')
    .eq('sid', wsId)
    .single()

  if (!workspace) redirect('/app')

  // Verify user belongs to this workspace (superadmin can access any)
  if (user.role !== 'superadmin' && user.workspaceId !== workspace.id) {
    redirect('/app')
  }

  return <>{children}</>
}
