import { supabase } from '../lib/supabase'

// Thin wrappers over the admin-panel Edge Function. Every call is gated
// server-side: the caller must be in platform_admins AND have an AAL2 (2FA)
// session. A 403 means "not an operator (or 2FA not satisfied)" — callers treat
// that as "no access" and bounce out of the admin view.
//
// This hook holds no state; it just returns the action callers. The AdminPanel
// page owns loading/error/data state per tab.
export function useAdmin() {
  async function call(action, body = {}) {
    const { data, error } = await supabase.functions.invoke('admin-panel', {
      body: { action, ...body },
    })
    if (error) {
      const status = error.context?.status
      const err = new Error(
        status === 403 ? 'forbidden'
          : status === 401 ? 'Please sign in again.'
            : 'Something went wrong. Please try again.',
      )
      err.status = status
      throw err
    }
    if (data?.error) throw new Error(data.error)
    return data
  }

  return {
    overview:   () => call('overview'),
    listTeams:  () => call('list_teams'),
    teamDetail: (teamId) => call('team_detail', { team_id: teamId }),
    listUsers:  () => call('list_users'),
  }
}
