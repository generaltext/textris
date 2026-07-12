// Cryptographic signing for score records (ECDSA P-256 via WebCrypto — available
// everywhere, no bundled crypto library). A record is signed over a canonical,
// key-sorted serialization of everything except its own `sig`, so signing and
// verification hash identical bytes regardless of property order.

const enc = new TextEncoder()

/** Deterministic JSON: object keys sorted recursively. Signer and verifier must
 *  produce byte-identical output, so ordering can't be left to the engine. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function toBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** Short, stable id derived from a public key's essential fields. Doubles as the
 *  player id and the score-file name, so a record's key must hash to its file. */
export async function pubkeyId(jwk: JsonWebKey): Promise<string> {
  const canon = stableStringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })
  return (await sha256Hex(canon)).slice(0, 12)
}

const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_ALG = { name: 'ECDSA', hash: 'SHA-256' } as const

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify'])
}

export async function exportJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key)
}

export async function importSigningKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, ECDSA, false, ['sign'])
}

/** Sign the canonical bytes of a payload (a record without its `sig`). */
export async function sign(payload: unknown, privateKey: CryptoKey): Promise<string> {
  const data = enc.encode(stableStringify(payload))
  const sig = await crypto.subtle.sign(SIGN_ALG, privateKey, data)
  return toBase64(sig)
}

/** Verify a base64 signature over a payload against a public-key JWK. */
export async function verify(payload: unknown, sigB64: string, pubJwk: JsonWebKey): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('jwk', pubJwk, ECDSA, false, ['verify'])
    const data = enc.encode(stableStringify(payload))
    return await crypto.subtle.verify(SIGN_ALG, key, fromBase64(sigB64), data)
  } catch {
    return false
  }
}
