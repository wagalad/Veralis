// Placeholder — will read/write scouting entries from local storage (offline)
// and sync to Supabase when online (step 4 of build order).
export function useScoutingEntries() {
  return { entries: [], save: () => {}, loading: false }
}
