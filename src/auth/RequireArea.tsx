import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { areaForRole, homePath, type Area } from '@/lib/roles'
import { useAuth } from './useAuth'
import { StatePanel } from '@/components/StatePanel'

/**
 * Gate for an app area. Signed-out users go to sign-in; signed-in users in the wrong
 * area go to their own home. This is a convenience — the API enforces every permission.
 */
export function RequireArea({ area, children }: { area: Area; children: ReactNode }) {
  const { state, signOut } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return <div aria-busy="true" aria-label="Loading" className="min-h-dvh bg-canvas" />
  }
  if (state.status === 'signed-out') {
    return <Navigate to={state.expired ? '/signed-out' : '/sign-in'} replace state={{ from: location.pathname + location.search }} />
  }
  if (state.status === 'no-access' && state.reason === 'no_organisation') {
    // Signed up but never finished set-up: resume at the organisation step (R1.03a).
    return <Navigate to="/signup/organisation" replace />
  }
  if (state.status === 'no-access' && state.reason === 'mfa_required') {
    return <Navigate to="/sign-in/code" replace state={{ from: location.pathname + location.search }} />
  }
  if (state.status === 'no-access') {
    return (
      <StatePanel
        kind="restricted"
        title={state.reason === 'access_ended' ? 'Your access has ended' : 'No access to an organisation'}
        description={
          state.reason === 'access_ended'
            ? 'Your organisation has ended your access to Synqop. Contact your administrator if you think this is a mistake.'
            : "This account isn't active in any Synqop organisation. If you were invited, use the link in your invitation email."
        }
        action={{ label: 'Sign out', onClick: signOut }}
      />
    )
  }
  const role = state.me.membership.role
  // O1.01r: trainers who open an admin link get an explanation instead of a silent redirect.
  if (area === 'admin' && areaForRole(role) === 'trainer') return <Navigate to="/trainer/restricted" replace />
  if (areaForRole(role) !== area) return <Navigate to={homePath(role)} replace />
  return children
}
