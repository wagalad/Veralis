// VEX Events API data access — all calls go through a Supabase Edge Function.
// The API token NEVER lives in frontend code (see PRD §6 security model).
// Swap VITE_SUPABASE_URL in .env when the Edge Function is wired up.

const BASE_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vex`
  : null

export async function getEventTeams(eventId) {
  if (!BASE_URL) throw new Error('Supabase not configured yet')
  const res = await fetch(`${BASE_URL}/events/${eventId}/teams`)
  if (!res.ok) throw new Error(`VEX API error: ${res.status}`)
  return res.json()
}

export async function getEventMatches(eventId) {
  if (!BASE_URL) throw new Error('Supabase not configured yet')
  const res = await fetch(`${BASE_URL}/events/${eventId}/matches`)
  if (!res.ok) throw new Error(`VEX API error: ${res.status}`)
  return res.json()
}
