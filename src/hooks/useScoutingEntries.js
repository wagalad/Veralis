import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOnlineStatus } from './useOnlineStatus'

const pendingKey = (teamId) => `vrc_pending_${teamId}`

function loadPending(teamId) {
  try { return JSON.parse(localStorage.getItem(pendingKey(teamId))) || [] }
  catch { return [] }
}

function savePending(teamId, entries) {
  localStorage.setItem(pendingKey(teamId), JSON.stringify(entries))
}

export function useScoutingEntries(team) {
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [pending, setPendingState] = useState([])
  const [synced, setSynced] = useState([])
  const [loading, setLoading] = useState(false)

  // Load pending entries from localStorage on mount / team change
  useEffect(() => {
    if (team?.id) setPendingState(loadPending(team.id))
  }, [team?.id])

  // Fetch all of this team's entries from Supabase (includes teammates')
  const fetchSynced = useCallback(async () => {
    if (!team?.id || !user) return
    setLoading(true)
    const { data } = await supabase
      .from('scouting_entries')
      .select('*')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false })
    if (data) setSynced(data)
    setLoading(false)
  }, [team?.id, user])

  useEffect(() => {
    if (online) fetchSynced()
  }, [online, fetchSynced])

  // Push any pending localStorage entries to Supabase when online
  const syncPending = useCallback(async () => {
    if (!team?.id || !user) return
    const toSync = loadPending(team.id)
    if (!toSync.length) return

    const stillPending = []
    for (const { _local_id, ...row } of toSync) {
      const { error } = await supabase.from('scouting_entries').insert(row)
      if (error) stillPending.push({ _local_id, ...row })
    }

    savePending(team.id, stillPending)
    setPendingState(stillPending)

    // Refresh synced list to include newly synced entries + teammates' entries
    if (stillPending.length < toSync.length) fetchSynced()
  }, [team?.id, user, fetchSynced])

  useEffect(() => {
    if (online) syncPending()
  }, [online, syncPending])

  async function save(scoutedTeamNumber, form, photoFile) {
    const localEntry = {
      _local_id: crypto.randomUUID(),
      team_id: team.id,
      scouted_team_number: scoutedTeamNumber,
      drivetrain: form.drivetrain,
      intake: form.intake,
      scoring: form.scoring,
      autonomous: form.autonomous,
      reliability: form.reliability,
      note: form.note || null,
      photo_url: null,
      created_by: user.id,
      created_at: new Date().toISOString(),
    }

    // Save to localStorage immediately — works offline
    const existing = loadPending(team.id)
    savePending(team.id, [localEntry, ...existing])
    setPendingState(prev => [localEntry, ...prev])

    if (!online) return localEntry

    // Online: upload photo then insert to Supabase.
    // scout-photos is a private bucket, so we store the storage path (not a
    // public URL — that wouldn't resolve). Display code should turn this into
    // a viewable image via supabase.storage.from('scout-photos').createSignedUrl(path, ttl).
    let photoUrl = null
    if (photoFile) {
      const { data: upload } = await supabase.storage
        .from('scout-photos')
        .upload(`${team.id}/${localEntry._local_id}`, photoFile, { contentType: photoFile.type })
      if (upload) photoUrl = upload.path
    }

    const { _local_id, ...insertRow } = { ...localEntry, photo_url: photoUrl }
    const { data, error } = await supabase
      .from('scouting_entries')
      .insert(insertRow)
      .select()
      .single()

    if (!error && data) {
      // Remove from pending, add to synced
      const newPending = loadPending(team.id).filter(e => e._local_id !== localEntry._local_id)
      savePending(team.id, newPending)
      setPendingState(newPending)
      setSynced(prev => [data, ...prev])
      return data
    }

    return localEntry
  }

  // Pending entries shown first (immediate feedback), then synced (from DB / teammates)
  const entries = [
    ...pending.map(e => ({ ...e, _synced: false })),
    ...synced.map(e => ({ ...e, _synced: true })),
  ]

  return { entries, loading, save, refresh: fetchSynced }
}
