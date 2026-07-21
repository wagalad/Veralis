// Analytics wrapper around PostHog.
//
// Nothing else in the app should import `posthog-js` directly — everything goes
// through the named helpers below. That keeps event names consistent, makes them
// easy to rename/remove, and lets the whole module safely no-op when there's no
// PostHog key (local dev, PR previews). Capture is deliberately lean: manual SPA
// pageviews + a curated set of custom events. No autocapture, no session replay
// (both can be enabled later by flipping the flags in initAnalytics).

import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com'

// When there's no key we never init PostHog, and `enabled` gates every call so
// the helpers become harmless no-ops.
let enabled = false

export function initAnalytics() {
  if (!KEY) {
    if (import.meta.env.DEV) {
      console.warn('[Veralis] PostHog not configured. Add VITE_POSTHOG_KEY to .env to enable analytics.')
    }
    return
  }
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: false,      // SPA — we capture $pageview manually on route change
    autocapture: false,           // lean capture: named events only
    disable_session_recording: true,
    capture_pageleave: true,      // cheap, and needed for accurate session/bounce metrics
    person_profiles: 'identified_only', // don't create profiles for anon visitors we never identify
    // Strip query strings from every event's URL properties. The /team/join?code=…
    // invite link carries a secret team-access code; without this, auto-enriched
    // events ($pageleave, custom events fired on that page) would ship it to PostHog.
    sanitize_properties: (props) => {
      for (const k of ['$current_url', '$referrer', '$referring_domain']) {
        if (typeof props[k] === 'string' && props[k].includes('?')) {
          props[k] = props[k].split('?')[0]
        }
      }
      return props
    },
  })
  enabled = true
}

// --- Identity -------------------------------------------------------------

export function identifyUser(user, props = {}) {
  if (!enabled || !user) return
  posthog.identify(user.id, {
    email: user.email,
    ...props,
  })
}

export function resetUser() {
  if (!enabled) return
  lastTeamId = null
  posthog.reset()
}

// Associate the current person with their team (PostHog "group analytics"), so
// adoption/retention can be sliced per team. `role` is set as a person property.
// useTeam() runs in many components, so we dedupe: once a group is set it sticks
// for the session, and we only re-emit $groupidentify when the team changes.
let lastTeamId = null
export function setTeamGroup(team, role) {
  if (!enabled || !team || team.id === lastTeamId) return
  lastTeamId = team.id
  posthog.group('team', team.id, {
    team_number: team.team_number,
    team_name: team.team_name,
  })
  if (role) posthog.setPersonProperties({ role })
}

// --- Pageviews ------------------------------------------------------------

export function capturePageview(pathname) {
  if (!enabled) return
  posthog.capture('$pageview', { $current_url: pathname })
}

// --- Growth events --------------------------------------------------------

// method: 'email' | 'google' | 'apple'
export function trackSignup(method) {
  capture('signup', { method })
}
export function trackLogin(method) {
  capture('login', { method })
}
// via: 'invite_code' | 'invite_link'
export function trackTeamCreated(team_number) {
  capture('team_created', { team_number })
}
export function trackTeamJoined(via) {
  capture('team_joined', { via })
}
// channel: 'native_share' | 'copy_code'
export function trackInviteShared(channel) {
  capture('invite_shared', { channel })
}

// --- Product-usage events -------------------------------------------------

// action: 'created' | 'updated'
export function trackScoutEntry(action) {
  capture('scout_entry', { action })
}
export function trackSearch() {
  capture('search')
}
export function trackEventModeSelected() {
  capture('event_mode_selected')
}
export function trackRulesAsked() {
  capture('rules_asked')
}
export function trackMfaEnabled() {
  capture('mfa_enabled')
}
// step: 'started' | 'completed' | 'skipped'
export function trackOnboarding(step) {
  capture('onboarding', { step })
}

// --- Consent (opt-out toggle in Settings) ---------------------------------

export function optOut() {
  if (!enabled) return
  posthog.opt_out_capturing()
}
export function optIn() {
  if (!enabled) return
  posthog.opt_in_capturing()
}
export function hasOptedOut() {
  if (!enabled) return false
  return posthog.has_opted_out_capturing()
}

// --- internal -------------------------------------------------------------

function capture(event, props) {
  if (!enabled) return
  posthog.capture(event, props)
}

export { posthog }
