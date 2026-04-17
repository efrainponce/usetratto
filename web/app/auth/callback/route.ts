/**
 * GET /auth/callback
 *
 * Handles Supabase auth callbacks (magic link, PKCE code exchange).
 * Supabase redirects here after email verification with ?code=...
 * We exchange the code for a session and redirect to /app.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  // Fallback: redirect to login on error
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
}
