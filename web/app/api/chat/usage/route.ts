import { NextResponse } from 'next/server'
import { requireAuthApi, isAuthError } from '@/lib/auth/api'
import { getUsageReport } from '@/lib/tratto-agent/billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth

  const report = await getUsageReport(auth.workspaceId)
  return NextResponse.json({
    workspace_id: auth.workspaceId,
    ...report,
  })
}
