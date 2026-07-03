import { supabase } from '../lib/supabase'

// Thin wrappers around Supabase Auth's TOTP MFA.

// All TOTP factors on the account (verified + any dangling unverified ones).
export async function listFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return data.totp ?? []
}

export async function getVerifiedFactor() {
  const factors = await listFactors()
  return factors.find(f => f.status === 'verified') ?? null
}

// Begin enrollment. Returns { factorId, qrSvg, secret } for the user to scan.
// Clears any leftover unverified factors first so they don't accumulate.
export async function startEnroll() {
  const factors = await listFactors()
  for (const f of factors) {
    if (f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${Date.now()}`,
  })
  if (error) throw new Error(error.message)
  return { factorId: data.id, qrSvg: data.totp.qr_code, secret: data.totp.secret }
}

// Verify a 6-digit code against a factor. Used both to confirm enrollment and
// to satisfy the login challenge (elevating the session to AAL2).
export async function verifyCode(factorId, code) {
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
  if (cErr) throw new Error(cErr.message)
  const { error: vErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (vErr) throw new Error(vErr.message)
}

export async function disableMfa(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

// Generate a fresh set of one-time recovery codes (invalidates any previous set).
// Requires an AAL2 session — enforced server-side. Returns plaintext codes ONCE.
export async function generateRecoveryCodes() {
  const { data, error } = await supabase.functions.invoke('mfa-recovery', {
    body: { action: 'generate' },
  })
  if (error) {
    if (error.context?.status === 403) throw new Error('Please finish verifying your 2FA before generating codes.')
    throw new Error('Could not generate recovery codes. Please try again.')
  }
  if (data?.error) throw new Error(data.error)
  return data.codes
}

// Consume a recovery code: removes the lost authenticator so the user can get
// back in (2FA ends up OFF, ready to re-enroll).
export async function consumeRecoveryCode(code) {
  const { data, error } = await supabase.functions.invoke('mfa-recovery', {
    body: { action: 'consume', code },
  })
  if (error) {
    const status = error.context?.status
    if (status === 400) throw new Error('That recovery code is invalid or has already been used.')
    if (status === 429) throw new Error('Too many attempts. Please wait a few seconds and try again.')
    throw new Error('Something went wrong. Please try again.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}
