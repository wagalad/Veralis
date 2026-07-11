-- Migration v19 — Edit attribution (edited_by / edited_at)
--
-- Now that any team member can edit the team's scouting entries (v18), record
-- WHO last edited a report and WHEN, for accountability. Both are stamped
-- server-side inside the existing BEFORE UPDATE trigger, so a client cannot
-- forge them — edited_by is always the authenticated caller (auth.uid()) and
-- edited_at is always now(). They stay NULL on rows that have never been edited
-- (the trigger is BEFORE UPDATE only, so INSERT never sets them).
--
-- The v18 trigger (which pins created_by immutable) is folded into one trigger
-- here. Idempotent / safe to re-run.
--
-- Migrations are NOT auto-applied. Run this once against the live database
-- (Supabase Dashboard -> SQL Editor).

alter table public.scouting_entries
  add column if not exists edited_by uuid references auth.users(id),
  add column if not exists edited_at timestamptz;

-- Replace the v18 pin-created_by trigger with one that also stamps the editor.
drop trigger  if exists scouting_entries_pin_created_by on public.scouting_entries;
drop function if exists public.scouting_entries_pin_created_by();

create or replace function public.scouting_entries_touch_edit()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;  -- authorship is immutable
  new.edited_by  := auth.uid();      -- who edited (server-set, unspoofable)
  new.edited_at  := now();           -- when
  return new;
end;
$$;

drop trigger if exists scouting_entries_touch_edit on public.scouting_entries;
create trigger scouting_entries_touch_edit
  before update on public.scouting_entries
  for each row execute function public.scouting_entries_touch_edit();
