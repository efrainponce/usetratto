import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Module-level singleton — reused across requests in the same process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: SupabaseClient<any> | null = null

export function createServiceClient(): SupabaseClient<any> {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession:   false,
        },
      }
    )
  }
  return _client
}
