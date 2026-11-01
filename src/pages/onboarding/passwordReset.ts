import { api } from '@/lib/api'

/** S1.01 — ask the API to email a reset link. Resolves the same whether or not the email has an account. */
export async function requestPasswordReset(email: string, captchaToken?: string): Promise<void> {
  await api('/v1/auth/password-reset', { method: 'POST', body: { email: email.trim().toLowerCase(), captchaToken } })
}
