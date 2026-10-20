# Iamable in the Croo.Studio family

The web application shares Croo.Studio's graphite text, off-white surfaces,
magenta accents, system sans-serif typography, generous space and rounded
controls. Iamable retains its sprout mark and personal wellbeing vocabulary.
`src/app/studio.css` defines the family tokens and component treatment.
`public/brand/` contains three original Higgsfield interface illustrations.
Recipe photography remains food-focused; shared card rows keep titles,
descriptions and actions aligned across the library and recipe picker.

## Daily program

Reading completion and saved reflection are independent steps. The next reading
unlocks immediately after the previous reading. Journaling remains optional.
The resume panel suggests the first unfinished step and always offers the next
available reading when the suggestion is journaling. Milestones count readings;
complete days count both steps.

Known French/English prompts identify existing reflections, including several
lessons on one calendar page. Opening or saving an unanswered prompt does not
complete a reflection. Saving an answer records its journal date atomically in
`program.reflections` alongside the journal; resuming returns to that date without
adding duplicate prompts. Existing text and reading dates are preserved.

The progress and links stay in the personal workspace. In enhanced protection,
matching and updates run on the device before encryption; no new plaintext
telemetry, shared-circle fields or administrative journal access is introduced.

### Journal library and pages

“Mon journal” in the navigation opens the complete library, grouped by month. A Higgsfield glass-notebook cover uses the same magenta/silver art direction as the Croo.Studio family. Search runs locally over the user's already available entries. Open pages become tabs. Title, text (including blank pages), mood and accepted AI edits save automatically after a 500 ms typing pause. The existing one-page-per-date data model and revision checks are retained.

Pending changes are checkpointed in owner-scoped sessionStorage on every edit so refreshing the same browser tab before the server responds does not discard them. Standard-mode checkpoints are synchronous. Enhanced-mode checkpoints contain only AES-GCM ciphertext under the existing non-exportable vault key with an owner-bound, separate authentication context; no key is stored. Refreshing a protected workspace still requires unlocking it. Confirmed checkpoints are removed. This recovery copy is not a backup: closing the tab, clearing browser storage, or private-browser restrictions can remove it.

The editor keeps accepting input during uploads and serializes writes, retaining any newer text when an older response arrives. Failed uploads retry automatically, including on reconnect/visibility changes. A lost acknowledgement or an unrelated workspace change can be reconciled against fresh server content; a different version of the same journal page is never silently replaced. The status distinguishes saved, saving, offline and conflicting versions. If browser recovery storage fails, the UI reports it and a pending, unprotected exit triggers a browser warning. Privacy activation waits for pending journal writes before migrating data.

Writing pages omit the large cover, decorative icon and repeated program explanation. Compact metadata and a quiet autosave indicator replace both manual save buttons. The contextual AI toolbar measures selected lines and its own dimensions, tracks scrolling/resizing/visual viewport changes, and stays clear of the tab bar. It remains disabled under enhanced protection; review, accept/reject and undo semantics are preserved.

Interaction references: [Notion writing and editing](https://www.notion.com/help/writing-and-editing-basics) (selection-driven toolbar) and [page customization](https://www.notion.com/help/customize-and-style-your-content) (cover and spacious writing canvas). This is an independent implementation; Notion block storage and collaboration are not reproduced.
