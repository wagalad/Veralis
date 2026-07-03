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
