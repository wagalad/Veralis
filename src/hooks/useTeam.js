import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useTeam() {
  const { user } = useAuth()
  // membership = { team: {..., invite_code}, role: 'admin'|'member' } | null | undefined
  const [membership, setMembership] = useState(undefined)

  useEffect(() => {
    if (!user) { setMembership(null); return }
    supabase
      .from('team_memberships')
      .select('role, teams(*)')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setMembership(data ? { team: data.teams, role: data.role } : null))
  }, [user?.id])

  // Create a new team — goes through Edge Function, never touches DB directly.
  // Edge Function: creates the team row + membership row as 'admin'.
  async function createTeam(teamNumber, teamName) {
    const { data, error } = await supabase.functions.invoke('create-team', {
      body: { team_number: teamNumber, team_name: teamName },
    })
    if (error) throw new Error(error.message)
    if (data?.error) {
      const err = new Error(data.error)
      if (data.duplicate) {
        err.duplicate = true
        err.teamNumber = data.team_number
      }
      throw err
    }
    setMembership({ team: data.team, role: 'admin' })
    return data.team
  }

  // Join a team by invite code — Edge Function validates the code server-side.
  // Only if valid does it insert the membership row (using service role).
  async function joinTeam(inviteCode) {
    const { data, error } = await supabase.functions.invoke('join-team', {
      body: { invite_code: inviteCode },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    setMembership({ team: data.team, role: 'member' })
    return data.team
  }

  // Regenerate invite code — Edge Function verifies admin role server-side.
  async function regenerateInvite() {
    if (!membership?.team?.id) throw new Error('No team')
    const { data, error } = await supabase.functions.invoke('regenerate-invite', {
      body: { team_id: membership.team.id },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    setMembership(prev => ({
      ...prev,
      team: { ...prev.team, invite_code: data.invite_code },
    }))
    return data.invite_code
  }

  // Fetch members of a team — caller must be a member of that team.
  async function getMembers(teamId) {
    const { data, error } = await supabase.functions.invoke('get-team-members', {
      body: { team_id: teamId },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data.members
  }

  // Promote a member to admin or remove them — caller must be an admin.
  async function manageMember(teamId, targetUserId, action) {
    const { data, error } = await supabase.functions.invoke('manage-member', {
      body: { team_id: teamId, target_user_id: targetUserId, action },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data
  }

  return {
    team: membership?.team ?? null,
    role: membership?.role ?? null,
    loading: membership === undefined,
    createTeam,
    joinTeam,
    regenerateInvite,
    getMembers,
    manageMember,
  }
}
