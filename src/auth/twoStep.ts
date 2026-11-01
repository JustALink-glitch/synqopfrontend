import { supabase } from '@/lib/supabase'

/** Two-step sign-in (TOTP authenticator apps) through Supabase Auth MFA. */
export async function verifiedFactor() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find((f) => f.status === 'verified') ?? null
}

/** Removes set-ups that were started but never finished, so a new one can begin cleanly. */
export async function clearUnfinished() {
  const { data } = await supabase.auth.mfa.listFactors()
  for (const f of data?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
}

export async function verifyCode(factorId: string, code: string): Promise<'ok' | 'wrong' | 'error'> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') })
  if (!error) return 'ok'
  return error.code === 'mfa_verification_failed' || error.status === 422 || error.status === 400 ? 'wrong' : 'error'
}

/** Six digits, spaces allowed while typing. */
export const isCode = (value: string) => /^\d{6}$/.test(value.replace(/\s+/g, ''))
