# Tred’meal — by Croo.Studio

Approved identity, October 2026. Keep the complete logo and its signature together.

- `logo.png`: transparent full lockup, 1903 × 442. Used by the app and PDF exports.
- `symbol.png`: transparent black/magenta symbol, 855 × 856.
- `icon-32.png`, `icon-48.png`, `icon-192.png`, `icon-512.png`: transparent symbols for browsers and installed web apps.
- `icon-maskable-512.png`, `apple-touch-icon.png`, `app-icon-1024.png`: white symbol on the approved magenta tile; the operating system supplies its icon mask.

The full lockup includes **by Croo.Studio**. Launcher icons use the symbol alone so they remain legible. Never squeeze, stretch or add a white rectangle behind the transparent files.

## Project organization

This `logos/` folder is the source of truth. `references/approved-proposal.png` preserves the approved proposal; it is not a transparent production asset. The generator copies the runtime PNGs to `public/brand/tredmeal/` and, when requested, to the native workspace. Edit or replace the masters here, then regenerate; do not edit runtime copies separately.

## Reproduce icon sizes

With project dependencies installed, run `node scripts/generate-brand-icons.mjs` from the repository root. Add `--native` only with the existing mobile workspace present and backed up; this updates Android density/adaptive assets, the iOS app icon and the mobile public logo. It preserves bundle IDs, URL schemes, authentication and signing configuration.

The original approved Higgsfield proposal was isolated into transparent full-logo and symbol masters with the image editor. Editing instructions: preserve the approved rounded black/magenta symbol, the exact Tred’meal wordmark and the by Croo.Studio signature; remove the proposal background, layout and icon examples; output true alpha with no shadows or backdrop. Production PNGs only trim transparent margins. Icon exports resize this symbol and use its alpha silhouette for the white version; they do not redraw it.

No service worker or private-data offline cache is introduced by the web manifest.
