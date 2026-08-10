# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, and any other tool that reads `AGENTS.md`) when working with code in this repository.

## Commands

- `npm run start` — Expo dev server (dev client, LAN). `start:tunnel` / `start:localhost` for other connectivity modes.
- `npm run android` / `npm run ios` — build and run on device/emulator (native `android/`/`ios/` dirs are prebuilt, not managed Expo Go).
- `npm run check` (= `check:architecture`) — runs `scripts/checar-arquitetura.sh`, which greps for architecture-rule violations (see below). Run this after touching any file in `app/`, `components/`, or `hooks/` that deals with data.
- `npx tsc --noEmit` — the real static check; there is no `typecheck` script. `tsconfig.json` excludes `supabase/functions` (Deno) — don't typecheck those with the app's TS config.
- No test suite exists yet (no Jest/Vitest, no `__tests__`, no `testID` on screens) and no lint script is configured — don't assume either is runnable. A testing plan is agreed but **not started** (`docs/project-context.md` §12: unit tests for all `services/`, Maestro E2E, manual checklist) — don't start it until the user says feature work is done.
- Adding a native module/plugin or changing permissions requires rebuilding via `npm run android` (regenerates the prebuilt `android/` dir); `npm run start` only pushes JS. Full "when to rebuild" logic in `SETUP.md`.
- `supabase/` has its own project (migrations, Edge Functions on Deno). Applying migrations or deploying functions requires Supabase CLI/MCP credentials not always present in a session — confirm with the user whether a new migration/function is actually live on the remote project before assuming it.

## Architecture

**Layering rule (enforced by `npm run check:architecture`, not just convention):** `app/`, `components/`, and `hooks/` must never import `@/lib/supabase` or `@/repositories/*`, and must never call `supabase.*` directly. All data access goes through a function in `services/*.ts`. `repositories/supabase.ts` re-exports the actual client from `lib/supabase.ts` (which wraps `fetch` with a timeout — 20s default, 120s for storage endpoints — since RN's `fetch` has no native timeout); only `services/` may import from `repositories/`.

**Storage:** the Vault uploads large files to **Backblaze B2** (`services/backblaze.ts`), not Supabase Storage. **Gotcha: the B2 `KEY_ID`/`APPLICATION_KEY`/`BUCKET_ID` are currently hardcoded — and committed — in that file; don't add more secrets to source code.** Secrets belong in `.env` (gitignored/untracked), which also holds the Supabase URL + anon key (those are public by design).

**Directory roles:**
- `app/` — Expo Router file-based routes, grouped: `(tabs)` (main nav), `(groups)`, `(auth)`, `(modals)`. Screens should be thin; logic belongs in `services/` or `hooks/`.
- `services/` — all Supabase/API/Edge Function calls, one file per domain (`sessions.ts`, `salas.ts`, `comunidade.ts`, `profileStats.ts`, etc.). This is the only layer allowed to talk to the backend.
- `hooks/` — React hooks, often thin wrappers around a `services/` call plus realtime subscription or the shared cache (`lib/cache.ts` + `useDadosCache.ts`).
- `lib/` — low-level infra (`supabase.ts` client, `cache.ts` stale-while-revalidate cache).
- `repositories/` — the one sanctioned door to `lib/supabase.ts` for `services/` to use.
- `supabase/migrations/` and `supabase/functions/` — SQL migrations and Deno Edge Functions. Business logic that must not be forgeable by the client (e.g. writing notifications, sending push) lives in triggers/RPCs or Edge Functions using the service-role key, not in `services/`.

**Timezone rule:** Postgres runs in UTC, but "study day" is always the **local** day (`America/Sao_Paulo`, hardcoded — this is a single-timezone local app, not a general SaaS). App code must use `paraDataISO()` from `utils/tempo.ts`; SQL must use `(now() at time zone 'America/Sao_Paulo')::date`. Never use `toISOString().split("T")[0]` or a bare `CURRENT_DATE`/`now()` for session dates, streak, or period-based ranking — both silently shift by hours around 21:00 local time.

**Group aggregation rule:** never aggregate study data by `grupo_id` alone — always join against `membros`. A user who leaves a group must stop counting toward that group's stats; a stored `grupo_id` on a session/local-storage value can otherwise leak across accounts on the same device or outlive membership.

**IA (Gemini):** every Gemini call happens inside an Edge Function (`gerar-quiz-foco`, `analisar-anexo-sessao`) — the API key is a server secret (`supabase secrets set GEMINI_API_KEY`), never in the client bundle. App-side `services/quizIA.ts` must always keep a local fallback (fixed quiz / anexo kept without analysis): an AI failure must never block ending a focus session. `supabase/functions/` is Deno and excluded from the root `tsconfig.json`.

**Cache:** navigation cache is a bespoke stale-while-revalidate module (`lib/cache.ts` + `hooks/useDadosCache.ts`), not `@tanstack/react-query` — deliberate choice, not an oversight. Data that changes after a focus session (profile, agenda, sessions, group progress) uses `tempoFresco: 0` (always revalidate on focus, no skeleton flash since old data stays visible); stable data (subjects, plans, members) gets longer windows. Screens with local autosave or realtime/presence hooks (`(modals)/settings.tsx`, `useIncentivos`, `useOnlineUsers`, `session-preview`, `invite`) intentionally don't use this cache.

**Design system:** most of the UI has been migrated to a design system called HADES (`constants/hades.ts`). A few shared primitives (`components/ui/ImagePickerAvatar.tsx`, `components/form/PrimaryButton.tsx`, `components/form/InputField.tsx`) serve both HADES screens and the still-legacy `app/(auth)/onboarding-welcome.tsx` via an opt-in `hades` boolean prop — don't flip the default or retheme onboarding without checking with the user.

**Focus session engine (`app/(tabs)/focus.tsx`):** the most complex screen. It walks a generic `ItemFila[]` queue rather than a fixed Pomodoro state machine — the queue can be a synthetic solo Pomodoro sequence (`utils/pomodoroSequence.ts`) or the day's remaining blocks of an active plan (`services/agenda.ts`). Group sessions open a `salas_foco` row (`services/salas.ts`) that is deliberately separate from `sessoes_foco` (`services/sessions.ts`): `sessoes_foco` is what a *person* studied, `salas_foco` is *where* — conflating them previously caused a bug where the host ending their own session killed the room for everyone.

**Full product context:** `docs/project-context.md` is a living PRD with per-feature rationale (comunidade feed consent model, notification categories, badges/duelo, testing plan, etc.) — read it before any non-trivial feature work, and suggest updates to it when scope changes. It also holds the monetização plan and the roadmap (§8, §14): the app is heading to a Play Store launch with **Premium/AI features** (e.g. IA on attached question forms) — check those sections before proposing new features.
