import { useState, useEffect } from 'react'
import { getTeam, getTeamMatches } from '../lib/vexApi'

const LS_KEY = 'veralis_active_event'

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useEvent(teamNumber) {
  const [activeEvent, setActiveEvent] = useState(loadSaved)
  const [vexTeam, setVexTeam] = useState(null)
  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [matchesError, setMatchesError] = useState(null)

  // Resolve VEX internal team ID when teamNumber changes
  useEffect(() => {
    if (!teamNumber) { setVexTeam(null); return }
    getTeam(teamNumber).then(setVexTeam).catch(() => setVexTeam(null))
  }, [teamNumber])

  // Fetch match schedule when event + VEX team ID are both available
  useEffect(() => {
    if (!activeEvent || !vexTeam?.id) { setMatches([]); return }
    setMatchesLoading(true)
    setMatchesError(null)
    getTeamMatches(vexTeam.id, activeEvent.id)
      .then(m => { setMatches(Array.isArray(m) ? m : []); setMatchesLoading(false) })
      .catch(e => { setMatchesError(e.message); setMatchesLoading(false) })
  }, [activeEvent?.id, vexTeam?.id])

  function selectEvent(event) {
    const saved = { id: event.id, name: event.name, start: event.start, location: event.location }
    localStorage.setItem(LS_KEY, JSON.stringify(saved))
    setActiveEvent(saved)
    setMatches([])
    setMatchesError(null)
  }

  function clearEvent() {
    localStorage.removeItem(LS_KEY)
    setActiveEvent(null)
    setMatches([])
    setMatchesError(null)
  }

  return { activeEvent, vexTeam, matches, matchesLoading, matchesError, selectEvent, clearEvent }
}
