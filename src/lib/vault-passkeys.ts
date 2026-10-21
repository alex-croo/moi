import type { PasskeyMaterial, VaultPasskey } from "./vault-crypto";
const bytes = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
const encode = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
const random = () => crypto.getRandomValues(new Uint8Array(32));
type PRFResults = AuthenticationExtensionsClientOutputs & {
  prf?: { enabled?: boolean; results?: { first: ArrayBuffer } };
};
export function passkeyAvailable() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}
// WebAuthn is used solely to wrap a local encryption key, never as a substitute
// for the Google session. PRF output/assertions never go to the application server.
export async function createPasskeyMaterial(
  userId: string,
): Promise<PasskeyMaterial> {
  if (!passkeyAvailable()) throw Error("passkey_unavailable");
  const salt = encode(random().buffer),
    rpId = location.hostname;
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: random(),
      rp: { id: rpId, name: "Tred’meal" },
      user: {
        id: new TextEncoder().encode(userId),
        name: "Mon espace Tred’meal",
        displayName: "Tred’meal",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60000,
      extensions: {
        prf: { eval: { first: bytes(salt) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (
    !credential ||
    !(credential.getClientExtensionResults() as PRFResults).prf?.enabled
  )
    throw Error("prf_unavailable");
  // A second assertion proves the key can actually be used before migration.
  const id = encode(credential.rawId);
  const secret = await getPasskeySecret({ id, salt, rpId });
  return { id, salt, rpId, secret };
}
export async function getPasskeySecret(
  entry: Pick<VaultPasskey, "id" | "salt" | "rpId">,
): Promise<Uint8Array> {
  if (!passkeyAvailable() || entry.rpId !== location.hostname)
    throw Error("passkey_unavailable");
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: random(),
      rpId: entry.rpId,
      allowCredentials: [{ type: "public-key", id: bytes(entry.id) }],
      userVerification: "required",
      timeout: 60000,
      extensions: {
        prf: { eval: { first: bytes(entry.salt) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const output = (
    credential?.getClientExtensionResults() as PRFResults | undefined
  )?.prf?.results?.first;
  if (
    !credential ||
    encode(credential.rawId) !== entry.id ||
    !output ||
    output.byteLength !== 32
  )
    throw Error("prf_unavailable");
  return new Uint8Array(output);
}
