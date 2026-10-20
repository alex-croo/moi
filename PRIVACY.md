# Optional privacy and local passkey unlocking

Standard mode is the default for accounts without an existing encrypted vault.
Google sign-in opens the dashboard directly. RLS isolates standard data by owner;
the admin UI never exposes its contents, but infrastructure operators can read it.
This distinction is visible in Preferences and on the public privacy page.
Existing vaults remain encrypted; there is no automatic downgrade or server-held key.

Enhanced protection is opt-in in Preferences → Privacy. All existing personal
content is included. The browser verifies encryption/decryption, then the database
atomically saves ciphertext and purges standard/legacy rows. Revision checks and
a shared membership-row lock reject stale saves and concurrent activation; protected
accounts cannot write to the standard endpoint or the standard SQL function.

Passkeys use WebAuthn PRF solely for local encryption-key wrapping. Google remains
the account authenticator. No WebAuthn assertion or PRF output is sent to our server,
so this is not an alternative server authentication protocol. User verification and
resident keys are required. A second get assertion proves PRF support before setup
continues. Cancellation, unsupported PRF and mismatched RP IDs fail closed: no
activation or migration. Device biometrics/PIN are handled by the OS, not the app.
Only credential ID, RP ID, PRF input salt and an encrypted data-key wrapper are saved.
A passphrase remains an explicit fallback, never a silent fallback after PRF failure.
A recovery code must be saved and acknowledged before committing activation.
Switching unlocking methods requires an already unlocked vault and rotates its data
key and recovery code. Old encrypted backups still need their old secrets.

The same key wrapping is used for decrypted backups; recovery and existing
passphrase vaults remain supported. Remote AI journal editing is available on explicit selection in standard mode only.
Encrypted accounts are refused before the request body is read; the SQL quota
function independently rejects accounts with a vault. Only the selected passage
is sent through Vercel AI Gateway, with zero-retention/no-training provider
filters and SDK input/output telemetry disabled. Proposals stay in memory until
accepted; accepting edits the draft, and saving persists that accepted text. This update does not publish OAuth or enable new signups.

In enhanced mode, personal data (journal text, titles, mood, weights, meal selections, pantry,
shopping checks, document links, unit preferences and program progress) is
AES-256-GCM encrypted in the browser. Supabase stores one versioned envelope per
user. A random data key is wrapped by WebAuthn PRF or a PBKDF2-SHA256 key (600,000
iterations, 128-bit salt), and separately by a random 256-bit recovery key. Nonces are random
96-bit values; authenticated context binds ciphertext to user, purpose and
revision. No unwrapped key or passphrase is sent to the application server.
Keys and plaintext are held in memory while unlocked, not localStorage.

This protects stored content from ordinary administrative access and database
exports. It does not protect an unlocked device, malicious browser extensions,
or a compromised application update. The operator controls the JavaScript
served by a web app and could change it: do not claim absolute protection against
an actively malicious operator. Independent review is required before making
stronger security claims. Account/email, membership, circle relationships,
request times and ciphertext sizes remain visible metadata. Content is not
padded; database/server rollback to an older valid ciphertext cannot be detected
across a completely new session without an independently retained version.

## Migration and backups

The SQL migration disables all legacy personal writes, including direct REST
and old journal RPCs. Existing data remains owner-readable only for migration.
The browser loads it in standard mode or, on explicit activation, encrypts it and verifies a complete local decryption.
The first save transaction writes the vault and removes that user's legacy rows.
A readback verifies the persisted envelope. Concurrent saves use expected
revisions and are rejected rather than overwriting newer data.

First-time setup is performed by the user, including saving a recovery code.
The operator must not generate or hold the user's real recovery secret. Account
password reset and Google login cannot decrypt the vault. A recovery code can
unlock it and rewrap its data key under a new passphrase. Without either secret,
content cannot be recovered by the administrator. Losing both is permanent.

The UI exports encrypted JSON and can restore it after verifying ownership and
successful decryption, with explicit confirmation before replacing newer data.
Downloaded recovery codes and decrypted PDFs need the user's own protection.
Old database dumps, logs, previously exported files, database WAL and provider
backups are not retroactively encrypted. Inventory and retire/protect old copies
after the owner verifies migration; never silently claim this happened. Existing
local pre-migration backups are retained during rollout to preserve recovery.
Future database backups should contain only encrypted personal payloads.

## Admission and circles

Only a database-backed active administrator can issue, revoke or renew platform
invitations or suspend members. Invitations are bound to a verified Google email,
expire after seven days and never grant admin. Admin invitations are available in either privacy mode. No user_metadata is used for authorization.

Configure Supabase's Before User Created hook to
`public.before_invited_user_created` BEFORE enabling new signups. The hook is
callable only by supabase_auth_admin, accepts only Google signups with a current
invitation and denies everyone else. Keep email/phone/anonymous providers off.
Google OAuth must permit invited external accounts; the previous owner-only test
user list is insufficient. Publishing OAuth is distinct from granting application
membership: RLS and membership checks remain mandatory.

Circle invitation and platform admission are separate. A person accepts a circle
invitation and chooses an alias before seeing its feed. Circle owners can remove
members; members can leave. RLS does not grant the platform admin a circle bypass.
Circle messages are explicit predefined encouragement/milestone statements,
previewed before posting. They are not encrypted with personal-vault keys and
may be visible to infrastructure administrators. No personal content, automatic
progress, weight or journal excerpt is shared. Previously seen information cannot
be withdrawn from screenshots or recipients' copies. Limits: 10 owned circles,
20 participants per circle, 30 posts/hour.

## Daily program

31 original FR/EN educational readings, milestones on days 7, 14, 21 and 31.
One new completion per local Toronto day; no missed-day penalty. Completion and
progress are encrypted. A lesson adds a prompt to today's existing draft without
overwriting it; journaling is optional. Published lessons are common content,
not personalized clinical recommendations. Citations accompany each reading;
the program itself has not been clinically validated. No weight-loss promises,
calorie prescription or medication advice. The admin can preview all readings
without accessing participants' progress.

## Verification

`npm run typecheck`, `npm run build`, and
`npx playwright test --config=privacy-tests.config.ts` (unit runner only; no browser).
Tests cover cryptographic tampering, owner/revision binding, wrong passphrase,
recovery and backup roundtrips; PostgreSQL RLS, admission, admin isolation,
revocation, circle acceptance/removal and sequential daily progression.
Browser verification uses CUA with synthetic data; it is separate from database
and cryptographic tests. For encrypted accounts, remote AI editing is disabled before reading any request
body. Standard-mode selections are sent only after an explicit editing action.
