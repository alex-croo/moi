# Application languages

Tred’meal supports French (Canada), English (Canada), Spanish for Central America (`es`, number/date conventions `es-GT`) and Brazilian Portuguese (`pt-BR`). The language selector and Preferences both preserve the current screen; the choice is remembered on this browser.

Interface translations live in `src/lib/translations`. `npm run build` checks coverage before compiling and never calls an AI service. To prepare future interface additions, `scripts/build-translations.mjs` is an explicit development helper; review its output before committing.

Private recipe and assigned lesson translations are display copies, cached in `public.content_translations` under the authenticated owner and a hash of the original content. Apply `20261024021000_content_translations.sql` before deployment. Row-level security denies anonymous access and isolates all accounts, including administrators. Translation requests preserve numeric literals, SI tokens and reference URLs, and fail visibly without replacing the original text when validation fails. Original recipes, quantities, nutrition and journal writing are not overwritten. Personal journal entries and confirmed memories are never sent to the translation endpoint. New Marie responses and receipt analysis follow the selected language using the existing Fireworks access policy.

The daily program remains limited to one new step per local calendar day. An unfinished step resumes where the user left it. A completed step permits the next published step on the following date; the program view refreshes after midnight or when returning to the window.

Validation: `npx playwright test -c languages-tests.config.ts` covers language conventions, fractions, receipt inputs, immutable recipe tokens, translation-cache isolation, program progression and receipt safeguards. Browser flows are also checked with the connected browser using fictional local demo data and read-only production navigation.
