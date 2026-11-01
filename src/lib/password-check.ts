import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Checks a password without touching the signed-in session.
 * Signing in again on the main client would replace the session with one that hasn't passed two-step
 * sign-in, so a separate client signs in, and that extra session is ended straight away.
 */
export async function checkPassword(email: string, password: string): Promise<boolean> {
  const side = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'synqop-password-check' },
  })
  const { error } = await side.auth.signInWithPassword({ email, password })
  if (error) return false
  await side.auth.signOut({ scope: 'local' }).catch(() => {})
  return true
}
