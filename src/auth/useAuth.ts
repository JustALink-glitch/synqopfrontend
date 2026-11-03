import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import type { Role } from '@/lib/roles'

export interface Me {
  user: { id: string; email: string | null }
  membership: {
    id: string
    organisationId: string
    role: Role
    firstName: string
    lastName: string
    phone?: string | null
    /** G1.04: set by the person; otherwise "First L.". */
    displayName?: string | null
    lastSignInAt?: string | null
    /** T9.01 Shown to participants on sessions. */
    bio?: string | null
    /** Short-lived link to their profile photo. */
    photoUrl?: string | null
  }
  organisation: { id: string; name: string; timeZone: string; deletionScheduledFor?: string | null; logoUrl?: string | null } | null
}

/** Why a signed-in account can't use the app (API error codes from /v1/me). */
export type NoAccessReason = 'no_organisation' | 'access_ended' | 'mfa_required' | 'unknown'

export type AuthState =
  | { status: 'loading' }
  /** `expired`: the session ended without the person signing out (X1.03). */
  | { status: 'signed-out'; expired?: boolean }
  /**
   * Signed in to Supabase, but no active membership: `no_organisation` → resume organisation set-up (R1.03a);
   * `access_ended` → deactivated (P1.04w). `mfa_required` → enter the two-step sign-in code.
   */
  | { status: 'no-access'; reason: NoAccessReason; session: Session }
  | { status: 'signed-in'; session: Session; me: Me }

export interface AuthContextValue {
  state: AuthState
  signOut: () => Promise<void>
  /** Re-fetch /v1/me, e.g. right after creating an organisation or accepting an invitation. */
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
