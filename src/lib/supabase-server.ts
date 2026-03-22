import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side Supabase client — uses service role key to bypass RLS.
// Only used in API routes (server-side). Never imported in client components.
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)
