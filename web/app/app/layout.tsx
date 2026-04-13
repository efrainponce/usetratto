import { requireAuth } from '@/lib/auth'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  )
}
