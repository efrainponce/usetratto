import { requireAuthApi, isAuthError } from '@/lib/auth/api'

export async function GET() {
  const auth = await requireAuthApi()
  if (isAuthError(auth)) return auth // 401 si no hay sesión

  return Response.json({
    ok: true,
    userId: auth.userId,
    phone: auth.phone,
    timestamp: new Date().toISOString(),
  })
}
