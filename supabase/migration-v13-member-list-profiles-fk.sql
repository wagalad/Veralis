-- migration-v13: fix "Couldn't load team members" error
--
-- The get-team-members Edge Function selects `profiles(display_name)` embedded
-- from team_memberships. PostgREST can only resolve that embed if a foreign key
-- relationship exists between the two tables. team_memberships.user_id and
-- profiles.id both only referenced auth.users independently, so PostgREST
-- returned PGRST200 ("Could not find a relationship between 'team_memberships'
-- and 'profiles'"), the function got an error and returned 500, and the client
-- showed "Couldn't load team members — please try again." for every team.
--
-- Adding a second FK from team_memberships.user_id -> profiles.id gives
-- PostgREST an unambiguous relationship to embed through. Every membership's
-- user_id already has a matching profiles row (auto-created on signup), so the
-- constraint validates against existing data.
--
-- Applied live to the DB via the Management API on 2026-07-06.

alter table public.team_memberships
  add constraint team_memberships_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
