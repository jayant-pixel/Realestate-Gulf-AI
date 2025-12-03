import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error('SUPABASE_URL is not configured');
}
if (!serviceRoleKey) {
  console.warn('[supabase-admin] SUPABASE_SERVICE_ROLE_KEY missing; admin routes may fail.');
}

export const supabaseAdmin = createClient(url, serviceRoleKey ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
});
