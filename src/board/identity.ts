// The player's signing identity. On first run we generate an ECDSA P-256 keypair
// and store it (as JWK) in v0/identity.json inside the workspace; on later runs
// we load it back. The private key never leaves the workspace and signs every
// score the player submits.
//
// Honest scope: this key IS the identity on the leaderboard. There's no server to
// bind it to a verified account, so it proves "the same key signed these runs and
// nobody tampered with them" — not "this is provably Ada". That's the ceiling for
// a backend-free, plaintext leaderboard, and it's stated plainly to users.

import { exportJwk, generateKeyPair, importSigningKey, pubkeyId } from './sign'

const IDENTITY_PATH = 'v0/identity.json'

export interface Identity {
  pubkeyId: string
  publicJwk: JsonWebKey
  privateKey: CryptoKey
  /** The player's chosen display name (empty until set). */
  name: string
}

interface StoredIdentity {
  v: 1
  pubkeyId: string
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
  createdAt: string
  name?: string
}

export async function loadOrCreateIdentity(): Promise<Identity> {
  // Wait for the identity file to sync before deciding it's absent. `gt.ready`
  // only means the workspace connected; on desktop a not-yet-synced readFile
  // resolves empty (not a throw), so without this we'd mint a fresh keypair and
  // write a duplicate leaderboard identity on every open.
  await window.gt.whenFileSynced(IDENTITY_PATH)
  const existing = await tryLoad()
  if (existing) return existing

  const pair = await generateKeyPair()
  const publicJwk = await exportJwk(pair.publicKey)
  const privateJwk = await exportJwk(pair.privateKey)
  const id = await pubkeyId(publicJwk)
  const stored: StoredIdentity = {
    v: 1,
    pubkeyId: id,
    publicJwk,
    privateJwk,
    createdAt: new Date().toISOString(),
    name: '',
  }
  await window.gt.writeFile(IDENTITY_PATH, JSON.stringify(stored, null, 2) + '\n')
  return { pubkeyId: id, publicJwk, privateKey: pair.privateKey, name: '' }
}

/** Update the stored display name (patches identity.json in place, keys untouched). */
export async function renameIdentity(name: string): Promise<void> {
  let text: string
  try {
    text = await window.gt.readFile(IDENTITY_PATH)
  } catch {
    return
  }
  try {
    const stored = JSON.parse(text) as StoredIdentity
    stored.name = name
    await window.gt.writeFile(IDENTITY_PATH, JSON.stringify(stored, null, 2) + '\n')
  } catch {
    // Corrupt identity file — leave it; a rename isn't worth clobbering keys.
  }
}

async function tryLoad(): Promise<Identity | null> {
  let text: string
  try {
    text = await window.gt.readFile(IDENTITY_PATH)
  } catch {
    return null
  }
  try {
    const stored = JSON.parse(text) as StoredIdentity
    if (!stored?.publicJwk || !stored?.privateJwk) return null
    const privateKey = await importSigningKey(stored.privateJwk)
    const id = stored.pubkeyId || (await pubkeyId(stored.publicJwk))
    return { pubkeyId: id, publicJwk: stored.publicJwk, privateKey, name: stored.name ?? '' }
  } catch {
    return null
  }
}
