/** Browser-only cryptography. Neither a passphrase nor an unwrapped key goes to the server. */
export type Sealed = { iv: string; ciphertext: string };
export type VaultEnvelope = {
  version: 1;
  ownerId: string;
  revision: number;
  iterations: 600000;
  salt: string;
  password: Sealed;
  recovery: Sealed;
  payload: Sealed;
};
const encode = (value: string) => new TextEncoder().encode(value);
const b64 = (v: Uint8Array) => {
  let s = "";
  for (const c of v) s += String.fromCharCode(c);
  return btoa(s);
};
const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size));
const aad = (owner: string, purpose: string) =>
  encode(`iamable:v1:${owner}:${purpose}`);
async function aes(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
async function passwordKey(passphrase: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    encode(passphrase.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations: 600000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function seal(
  key: CryptoKey,
  raw: Uint8Array,
  owner: string,
  purpose: string,
): Promise<Sealed> {
  const iv = random(12);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad(owner, purpose),
      tagLength: 128,
    },
    key,
    raw as BufferSource,
  );
  return { iv: b64(iv), ciphertext: b64(new Uint8Array(encrypted)) };
}
async function open(
  key: CryptoKey,
  sealed: Sealed,
  owner: string,
  purpose: string,
) {
  if (bytes(sealed.iv).length !== 12) throw new Error("Invalid nonce");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: bytes(sealed.iv),
        additionalData: aad(owner, purpose),
        tagLength: 128,
      },
      key,
      bytes(sealed.ciphertext),
    ),
  );
}
function verifyEnvelope(e: VaultEnvelope, owner: string) {
  if (
    e.version !== 1 ||
    e.ownerId !== owner ||
    e.iterations !== 600000 ||
    !Number.isSafeInteger(e.revision) ||
    e.revision < 1 ||
    bytes(e.salt).length !== 16
  )
    throw new Error("Invalid vault");
}
export async function decryptVault<T>(
  key: CryptoKey,
  envelope: VaultEnvelope,
  owner: string,
): Promise<T> {
  verifyEnvelope(envelope, owner);
  return JSON.parse(
    new TextDecoder().decode(
      await open(key, envelope.payload, owner, `payload:${envelope.revision}`),
    ),
  ) as T;
}
export async function encryptVault<T>(
  key: CryptoKey,
  previous: VaultEnvelope,
  value: T,
): Promise<VaultEnvelope> {
  const revision = previous.revision + 1;
  return {
    ...previous,
    revision,
    payload: await seal(
      key,
      encode(JSON.stringify(value)),
      previous.ownerId,
      `payload:${revision}`,
    ),
  };
}
export async function createVault<T>(
  ownerId: string,
  passphrase: string,
  value: T,
) {
  if (passphrase.length < 16) throw new Error("Use at least 16 characters");
  const raw = random(32),
    recoveryRaw = random(32),
    salt = b64(random(16));
  try {
    const key = await aes(raw);
    const recoveryCode = Array.from(recoveryRaw, (b) =>
      b.toString(16).padStart(2, "0"),
    )
      .join("")
      .match(/.{1,8}/g)!
      .join("-");
    const base: VaultEnvelope = {
      version: 1,
      ownerId,
      revision: 0,
      iterations: 600000,
      salt,
      password: await seal(
        await passwordKey(passphrase, salt),
        raw,
        ownerId,
        "password",
      ),
      recovery: await seal(await aes(recoveryRaw), raw, ownerId, "recovery"),
      payload: { iv: "", ciphertext: "" },
    };
    const envelope = await encryptVault(key, base, value);
    // Verify a complete decrypt before ever allowing the server to replace legacy data.
    if (
      JSON.stringify(await decryptVault(key, envelope, ownerId)) !==
      JSON.stringify(value)
    )
      throw new Error("Verification failed");
    return { key, envelope, recoveryCode };
  } finally {
    raw.fill(0);
    recoveryRaw.fill(0);
  }
}
export async function unlockVault(
  envelope: VaultEnvelope,
  owner: string,
  secret: string,
  recovery = false,
) {
  verifyEnvelope(envelope, owner);
  let wrapping: CryptoKey;
  if (recovery) {
    const hex = secret.replace(/[\s-]/g, "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("Invalid recovery code");
    const raw = Uint8Array.from(hex.match(/../g)!, (v) => parseInt(v, 16));
    try {
      wrapping = await aes(raw);
    } finally {
      raw.fill(0);
    }
  } else wrapping = await passwordKey(secret, envelope.salt);
  const raw = await open(
    wrapping,
    recovery ? envelope.recovery : envelope.password,
    owner,
    recovery ? "recovery" : "password",
  );
  try {
    return await aes(raw);
  } finally {
    raw.fill(0);
  }
}
export async function changeVaultPassphrase(
  envelope: VaultEnvelope,
  owner: string,
  recoveryCode: string,
  passphrase: string,
) {
  verifyEnvelope(envelope, owner);
  if (passphrase.length < 16) throw new Error("Use at least 16 characters");
  const hex = recoveryCode.replace(/[\s-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("Invalid recovery code");
  const recoveryRaw = Uint8Array.from(hex.match(/../g)!, (v) =>
    parseInt(v, 16),
  );
  const salt = b64(random(16));
  let raw: Uint8Array | undefined;
  try {
    raw = await open(
      await aes(recoveryRaw),
      envelope.recovery,
      owner,
      "recovery",
    );
    return {
      ...envelope,
      salt,
      password: await seal(
        await passwordKey(passphrase, salt),
        raw,
        owner,
        "password",
      ),
    };
  } finally {
    recoveryRaw.fill(0);
    raw?.fill(0);
  }
}
