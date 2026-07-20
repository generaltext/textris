// The player's signing key is a per-DEVICE key pair, stored in localStorage —
// deliberately NOT in the synced workspace.
//
// Why this matters: the app's data folder syncs to EVERY workspace member, so a
// key stored there (as an earlier version did, in v0/identity.json) is SHARED by
// everyone — one keypair, one pubkeyId, one score file, and a name field that
// multiple people write and CRDT-merge into garbage. A device-local key gives
// each player (each browser) a unique signing key, so each score file has a
// single writer again. A private key must never sync anyway.
//
// WHO you are on the board (id + display name) comes from gt.user() — see
// App.tsx. This key only provides tamper-evidence and a stable per-device file
// scope (its pubkeyId names your score file and is the record's player.id).

import { exportJwk, generateKeyPair, importSigningKey, pubkeyId } from './sign'

const KEY_STORAGE = 'textris:device-key:v1'
const NAME_STORAGE = 'textris:name:v1'

export interface Identity {
  /** Hash of the public key: names this device's score file and is player.id. */
  pubkeyId: string
  publicJwk: JsonWebKey
  privateKey: CryptoKey
}

interface StoredKey {
  publicJwk: JsonWebKey
  privateJwk: JsonWebKey
}

function readLocal(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null // storage blocked (e.g. some sandboxes)
  }
}
function writeLocal(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the value stays in memory for this session only.
  }
}

/** Load this device's signing key, or generate + persist one. Falls back to an
 *  ephemeral in-memory key if localStorage is unavailable (records still verify;
 *  the key just won't persist across reloads). */
export async function loadOrCreateIdentity(): Promise<Identity> {
  const raw = readLocal(KEY_STORAGE)
  if (raw) {
    try {
      const stored = JSON.parse(raw) as StoredKey
      if (stored?.publicJwk && stored?.privateJwk) {
        const privateKey = await importSigningKey(stored.privateJwk)
        return {
          pubkeyId: await pubkeyId(stored.publicJwk),
          publicJwk: stored.publicJwk,
          privateKey,
        }
      }
    } catch {
      // Corrupt stored key — fall through and mint a fresh one.
    }
  }
  const pair = await generateKeyPair()
  const publicJwk = await exportJwk(pair.publicKey)
  const privateJwk = await exportJwk(pair.privateKey)
  writeLocal(KEY_STORAGE, JSON.stringify({ publicJwk, privateJwk }))
  return { pubkeyId: await pubkeyId(publicJwk), publicJwk, privateKey: pair.privateKey }
}

/** The player's manual name override (per device), or null if unset. */
export function getNameOverride(): string | null {
  const n = readLocal(NAME_STORAGE)
  return n && n.trim() ? n : null
}

/** Save a manual name override for this device (never synced, never merged). */
export function setNameOverride(name: string): void {
  writeLocal(NAME_STORAGE, name)
}
