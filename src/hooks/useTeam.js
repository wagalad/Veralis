import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { setTeamGroup, trackTeamCreated, trackTeamJoined } from '../lib/analytics'

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
      .then(({ data }) => {
        const m = data ? { team: data.teams, role: data.role } : null
        setMembership(m)
        // Associate this person with their team for group analytics (deduped in the wrapper).
        if (m) setTeamGroup(m.team, m.role)
      })
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
    setTeamGroup(data.team, 'admin')
    trackTeamCreated(data.team.team_number)
    return data.team
  }

  // Join a team by invite code — Edge Function validates the code server-side.
  // Only if valid does it insert the membership row (using service role).
  async function joinTeam(inviteCode) {
    const { data, error } = await supabase.functions.invoke('join-team', {
      body: { invite_code: inviteCode },
    })
    if (error) {
      const status = error.context?.status
      if (status === 404) throw new Error("Oops! That invite code wasn't found — double-check it and try again.")
      if (status === 409) throw new Error("You're already a member of this team.")
      if (status === 400) throw new Error('Please enter an invite code.')
      if (status === 401) throw new Error('You must be signed in to join a team.')
      throw new Error('Something went wrong — please try again.')
    }
    if (data?.error) throw new Error(data.error)
    setMembership({ team: data.team, role: 'member' })
    setTeamGroup(data.team, 'member')
    trackTeamJoined('invite_code')
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
    if (error) {
      const status = error.context?.status
      if (status === 401) throw new Error('You must be signed in to view team members.')
      if (status === 403) throw new Error("You're not a member of this team.")
      throw new Error("Couldn't load team members — please try again.")
    }
    if (data?.error) throw new Error(data.error)
    return data.members
  }

  // Leave the current team. If the caller is the sole admin, the server
  // auto-promotes the longest-standing member before removing them.
  async function leaveTeam(teamId) {
    const { data, error } = await supabase.functions.invoke('leave-team', {
      body: { team_id: teamId },
    })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    setMembership(null)
    return data
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
    leaveTeam,
    regenerateInvite,
    getMembers,
    manageMember,
  }
}
