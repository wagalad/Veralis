import { rating, rate, ordinal } from 'openskill'

// OpenSkill (Weng-Lin Bayesian) team rating — the same algorithm as openskill.py,
// via the JS port (philihp/openskill.js). We compute an "ego-centric" rating from
// the searched team's own season matches: every team seen starts at the default
// rating and updates only within this team's schedule, so the number reflects
// results weighted by the opponents actually faced. Not a globally-normalized
// leaderboard — surfaced in the UI as "based on N season matches".

// Whether a match has actually been played (so it can move ratings). RobotEvents'
// `scored` boolean is unreliable — for past seasons it often stays `false` even on
// fully-scored matches — so we treat a match as played when it carries a real score.
// A future/unplayed match sits at 0–0 with no start time and is skipped.
function isPlayed(m) {
  if (!m) return false
  const al = m.alliances ?? []
  const red = al.find(a => a.color === 'red')
  const blue = al.find(a => a.color === 'blue')
  if (!red || !blue) return false
  return m.scored === true || (red.score ?? 0) + (blue.score ?? 0) > 0
}

// Pull a team number string out of a RobotEvents alliance-team entry (shape varies).
function teamNumberOf(t) {
  const n = t?.team?.number ?? t?.team?.name ?? t?.number ?? t?.name
  return n ? String(n).toUpperCase() : null
}

/**
 * @param {Array} matches   - a team's season matches (RobotEvents shape)
 * @param {string} teamNumber - e.g. "16858A"
 * @returns {{score:number|null, tier:string|null, mu:number|null, sigma:number|null, matches:number, provisional:boolean}}
 */
export function computeTeamRating(matches, teamNumber) {
  const me = (teamNumber || '').toUpperCase()

  const played = (matches || [])
    .filter(isPlayed)
    .sort((a, b) =>
      String(a.scheduled ?? a.started ?? '').localeCompare(String(b.scheduled ?? b.started ?? '')))

  const ratings = new Map() // teamNumber -> { mu, sigma }
  const get = (n) => ratings.get(n) ?? rating()
  let counted = 0

  for (const m of played) {
    const red = (m.alliances ?? []).find(a => a.color === 'red')
    const blue = (m.alliances ?? []).find(a => a.color === 'blue')
    if (!red || !blue) continue

    const redTeams = (red.teams ?? []).map(teamNumberOf).filter(Boolean)
    const blueTeams = (blue.teams ?? []).map(teamNumberOf).filter(Boolean)
    if (redTeams.length === 0 || blueTeams.length === 0) continue

    const redScore = red.score ?? 0
    const blueScore = blue.score ?? 0
    // rank: lower is better; equal scores = tie.
    const rank = redScore === blueScore ? [1, 1] : redScore > blueScore ? [1, 2] : [2, 1]

    const [newRed, newBlue] = rate([redTeams.map(get), blueTeams.map(get)], { rank })
    redTeams.forEach((n, i) => ratings.set(n, newRed[i]))
    blueTeams.forEach((n, i) => ratings.set(n, newBlue[i]))

    if (redTeams.includes(me) || blueTeams.includes(me)) counted++
  }

  const r = ratings.get(me)
  if (!r || counted === 0) {
    return { score: null, tier: null, mu: null, sigma: null, matches: 0, provisional: true }
  }

  // Skill estimate (mu) mapped to a friendly 0–100 scale: 25 (default) ≈ 50,
  // ~35 ≈ elite, ~15 ≈ floor. Tunable. Uncertainty (sigma) drives "provisional".
  const score = Math.max(0, Math.min(100, Math.round((r.mu - 15) * 5)))
  // In the ego-centric model sigma converges slowly (opponents differ across
  // events), so trust is gauged by match count rather than sigma.
  const provisional = counted < 12
  const tier =
    score >= 80 ? 'Elite'
      : score >= 62 ? 'Strong'
        : score >= 45 ? 'Solid'
          : 'Developing'

  // ordinal (mu − 3σ) kept available for callers that want the conservative value.
  return { score, tier, mu: r.mu, sigma: r.sigma, ordinal: ordinal(r), matches: counted, provisional }
}
