/**
 * VEX Events API — data access module.
 *
 * ALL VEX API calls go through this file. The actual HTTP request hits a
 * Supabase Edge Function; the VEX API token never appears in frontend code.
 * To change the endpoint, update the Edge Function name below — one place.
 */

import { supabase } from './supabase'

async function proxy(action, params = {}) {
  const { data, error } = await supabase.functions.invoke('vex-api', {
    body: { action, ...params },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

/**
 * Look up a team by their VEX number (e.g. "16858A").
 * Returns the VEX API team object, which includes the internal numeric id
 * needed for further lookups.
 *
 * @param {string} teamNumber - e.g. "16858A"
 * @param {string} [program]  - "VRC" (default), "VEXU", "IQ"
 */
export async function getTeam(teamNumber, program = 'VRC') {
  const { team } = await proxy('team', { teamNumber, program })
  return team
}

/**
 * Search teams by number (e.g. "168") or name (e.g. "Waga").
 * Queries starting with a digit are treated as number searches;
 * all others are treated as name searches.
 *
 * @param {string} query   - partial number or name
 * @param {string} program - "VRC" (default), "VEXU", "IQ"
 */
export async function searchTeams(query, program = 'VRC') {
  const { teams } = await proxy('search_teams', { query, program })
  return teams
}

/**
 * Fetch skills scores and awards for a team by their VEX internal id.
 * The id comes from the team object returned by searchTeams / getTeam.
 *
 * @param {string|number} teamId - VEX API internal numeric id
 */
export async function getTeamStats(teamId) {
  const { stats } = await proxy('team_stats', { teamId: String(teamId) })
  return stats
}

/**
 * Fetch all teams registered for an event.
 * Handles pagination transparently — returns the full list.
 *
 * @param {string|number} eventId - VEX API event id
 */
export async function getEventTeams(eventId) {
  const { teams } = await proxy('event_teams', { eventId: String(eventId) })
  return teams
}

/**
 * Fetch qualification/elimination rankings for an event.
 * Results update live during the event (~30 s server-side cache).
 *
 * @param {string|number} eventId
 * @param {string|number} [division] - division id for multi-division events (e.g. Worlds)
 */
export async function getEventRankings(eventId, division) {
  const params = { eventId: String(eventId) }
  if (division != null) params.division = String(division)
  const { rankings } = await proxy('event_rankings', params)
  return rankings
}

/**
 * Fetch the skills leaderboard for an event.
 * Results update live during the event (~30 s server-side cache).
 *
 * @param {string|number} eventId
 */
export async function getEventSkills(eventId) {
  const { skills } = await proxy('event_skills', { eventId: String(eventId) })
  return skills
}

/**
 * Fetch the events a team is registered for, most-recent first.
 *
 * The VEX API has no event name-search endpoint, so Live Event Mode lists a
 * team's own events (which is where the team actually has matches).
 *
 * @param {string|number} teamId - VEX API internal numeric team id
 */
export async function getTeamEvents(teamId) {
  const { events } = await proxy('team_events', { teamId: String(teamId) })
  return events
}

/**
 * Fetch a team's match schedule at a specific event.
 *
 * @param {string|number} teamId  - VEX API internal numeric team id
 * @param {string|number} eventId - VEX API event id
 */
export async function getTeamMatches(teamId, eventId) {
  const { matches } = await proxy('team_matches', {
    teamId: String(teamId),
    eventId: String(eventId),
  })
  return matches
}
