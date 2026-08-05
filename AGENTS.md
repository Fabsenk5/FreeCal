# AGENTS.md — FreeCal

Guidance for AI coding agents working in this repository. Assumes no prior project knowledge.

## Project Overview

FreeCal is a calendar and availability manager for partners/families: users create (optionally recurring) events, connect with each other via email-based relationships, share events as **attendees** (the event blocks their calendar) or **viewers** (visible, but does not block time), and use a **Free Time Finder** to compute shared free slots across multiple users' calendars. Additional features: travel locations on a world map (Leaflet), ICS import, OCR import of calendar screenshots (tesseract.js), birthday/valentine special events, feature wishlist, and web push notifications. It is a PWA ("Family Calendar") with offline caching and auto-updating service worker.

The project originated on the Altan platform and was migrated to local development; some docs still reference Altan. New users must be approved by an admin before they can use the app (`/pending-approval` flow). The admin account (`fabiank5@hotmail.com`) bypasses approval checks in the frontend.

## Repository Layout

```
├── src/                    # Frontend (React + TypeScript + Vite)
│   ├── components/         # UI components
│   │   ├── ui/             # shadcn/ui design system (no business logic)
│   │   ├── calendar/       # Feature components per domain (auth, map, profile, ...)
│   ├── contexts/           # React Contexts (AuthContext, BirthdayContext, ValentineContext)
│   ├── hooks/              # Custom data hooks (useEvents, useRelationships, ...)
│   ├── lib/                # api.ts (data layer), supabase.ts (client), utils.ts, notifications.ts
│   ├── pages/              # Route-level pages (CalendarView, CreateEvent, FreeTimeFinderV2, ...)
│   ├── routes.tsx          # React Router route definitions
│   ├── test/               # Vitest setup + e2e test
│   └── utils/              # Pure logic: recurrence.ts, icsParser.ts, calendarOCR.ts, dateUtils.ts
├── backend/                # Express + Drizzle ORM API (own package.json)
│   ├── src/
│   │   ├── index.ts        # Server entry (keep-alive ping, /health endpoint, JSON error middleware, graceful shutdown)
│   │   ├── controllers/    # Remaining: authController (register/me), userController (search/admin),
│   │   │                   # eventDetailsController (comments/checklists), pushController, passwordResetController.
│   │   │                   # Legacy domain controllers (events/relationships/travel/wishes) were removed —
│   │   │                   # the frontend talks to Supabase directly for those.
│   │   ├── routes/         # authRoutes.ts, apiRoutes.ts
│   │   ├── db/             # schema.ts (Drizzle), connectionPool.ts (single shared pool), supabaseAdmin.ts
│   │   └── middleware/     # auth.ts (Supabase token verification), rateLimit.ts
│   └── scripts/            # Migration/import scripts (tsx)
├── supabase/               # SQL migrations (migration.sql, fix_rls.sql, security_hardening.sql)
├── native/                 # Expo iOS wrapper app (own package.json): WebView hosting the web app
│   │                       # + expo-calendar bridge for direct iOS calendar read/write.
│   │                       # src/bridgeTypes.ts defines the wire protocol; the web mirror is
│   │                       # src/lib/nativeBridge.ts + src/utils/nativeEventMapper.ts (keep in sync).
├── public/                 # Static assets incl. push-sw.js (push notification SW)
└── *.md                    # Extensive docs: ARCHITECTURE.md, DEVELOPMENT.md, NATIVE_APP.md, etc.
```

Note: several `*.backup.tsx` files exist in `src/pages/` — they are historical snapshots, not part of the build's active flow. Do not edit or "fix" them. They are excluded from `tsconfig.app.json`.

## Tech Stack

**Frontend** (`package.json`, ESM):
- React 18 + TypeScript + Vite 5 (`@vitejs/plugin-react-swc`)
- Tailwind CSS 3 + shadcn/ui (Radix UI primitives; `components.json`: style "default", base color slate, CSS variables)
- React Router v6, TanStack Query v5 (active data layer, see below), React Hook Form + Zod
- date-fns, rrule (recurrence), Leaflet/react-leaflet (maps), tesseract.js (OCR; lazy-loaded)
- `@supabase/supabase-js` — the frontend talks **directly to Supabase** (Altan-hosted) for data and auth
- vite-plugin-pwa (Workbox; imports `push-sw.js` into the service worker)

**Backend** (`backend/package.json`, CommonJS):
- Node.js + Express 5, Drizzle ORM + `pg` (single shared pool from `connectionPool.ts`), PostgreSQL
- Auth: requests are verified against Supabase (`auth.getUser`) in `middleware/auth.ts`; legacy custom-JWT login was removed. Zod validation, web-push, `express-rate-limit` on auth/push routes
- Database is switchable between **Neon** (currently active) and **Supabase** transaction pooler — see `DATABASE_SWITCHING.md`
- Dev via `tsx watch`, build via `tsc` → `dist/`

### Data architecture (important)

The frontend's data layer is `src/lib/api.ts`, the "Supabase Edition": it queries Supabase directly and replaced the old axios→Express API. The Express backend in `backend/` is still deployed (Render) and used for: web push (`/api/push/*`), event comments/checklists, password reset, `/api/auth/register` + `/api/auth/me`, and health checks/keep-alive (see `getApiUrl()` in `src/lib/api.ts`, driven by `VITE_API_URL`). When changing data access, follow the Supabase pattern in `api.ts`, not the old Express endpoints, unless the feature genuinely lives in the backend (push notifications, comments/checklists, password reset emails).

Core tables (see `ARCHITECTURE.md` and `backend/src/db/schema.ts`): `profiles`, `relationships` (pending/accepted/rejected), `events` (with recurrence fields), `event_attendees` (block time; have status + is_attendee/is_editor flags), `event_viewers` (do not block time), plus travel locations and feature wishes. Supabase tables have RLS enabled.

**Key domain rule:** only `event_attendees` block time in the Free Time Finder; `event_viewers` never do.

## Build, Run, and Test Commands

Frontend (from repo root):

```bash
npm install            # install deps (npm is the documented package manager)
npm run dev            # Vite dev server → http://localhost:5173 (PWA enabled in dev)
npm run build          # production build → dist/
npm run build:dev      # build in development mode
npm test               # Vitest (watch mode; use `npx vitest run` for single pass)
npm run lint           # ESLint (flat config, eslint.config.js)
npm run type-check     # WARNING: effectively a no-op (root tsconfig has files: [])
npx tsc -p tsconfig.app.json --noEmit   # real type check (use this one)
```

Backend (from `backend/`):

```bash
npm install
npm run dev            # tsx watch src/index.ts → port 3000
npm run build          # tsc → dist/
npm start              # node dist/index.js
npm run db:push        # drizzle-kit push (apply schema to DATABASE_URL)
```

Environment variables:
- Frontend (`.env.local` in root, see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (Express backend URL, e.g. `https://freecal-backend.onrender.com`; empty = relative `/api` requests, which breaks push/comments)
- Backend (`backend/.env`, see `backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT` (default 3000), `NODE_ENV`, `FRONTEND_URL` (CORS whitelist + reset links), `SUPABASE_SERVICE_ROLE_KEY` (required for push/comments), VAPID keys

## Code Style Guidelines

Language: all code, comments, and docs are in English.

From `DEVELOPMENT.md` and observed conventions:

- **TypeScript**: explicit types on function params and fetched data. `interface` for object shapes, `type` for unions. Interfaces/types/enums in PascalCase. Note: the root `tsconfig.json` is lenient (`noImplicitAny: false`, `strictNullChecks: false`) — don't introduce `strict: true` assumptions.
- **Files**: components PascalCase (`CalendarView.tsx`), hooks camelCase with `use` prefix (`useEvents.ts`), utils camelCase (`dateUtils.ts`).
- **Database**: snake_case — tables plural (`event_attendees`), columns (`user_id`, `created_at`), enums.
- **Imports**: use the `@/` path alias for `src/` (configured in `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`).
- **Components**: order = imports → types/interfaces → component (hooks, then handlers, then render). Page components fetch data at page level; `components/ui/` holds the design system with no business logic; feature components live in `components/{feature}/`.
- **Data fetching**: TanStack Query v5. Data hooks live in `src/hooks/` (`useEvents`, `useRelationships`, `useRelationshipRequests`) and wrap `useQuery` around functions from `src/lib/api.ts`; they return domain-named shapes like `{ events, loading, refreshEvents }` where `refresh*` invalidates the relevant query keys. The shared `QueryClient` is created in `src/lib/queryClient.ts` (staleTime 60s) and provided in `src/App.tsx`. After calling mutation functions from `api.ts` directly, call the hook's `refresh*` to invalidate.
- **Errors**: throw on Supabase `error`, surface to the user via toast (`sonner`), `console.error` for debugging. (The shadcn `use-toast` system was removed as unused; only `sonner` remains, with a single `<Toaster>` in `App.tsx`.)
- **Styling**: Tailwind utility classes; use design-system components (`@/components/ui/...`) and theme CSS variables (`bg-primary`, `text-primary-foreground`, `border-border`) instead of hard-coded colors.
- **Linting**: `react-hooks` rules enforced; `@typescript-eslint/no-unused-vars` is off.

## Testing Instructions

- Framework: **Vitest 4** + jsdom + Testing Library (`@testing-library/react`, `jest-dom`, `user-event`). Config: `vitest.config.ts` (globals on, setup at `src/test/setup.ts` which mocks `window.matchMedia` and cleans up after each test).
- Tests are **co-located** with source: `src/utils/recurrence.test.ts`, `src/utils/icsParser.test.ts`, `src/pages/pages.test.tsx`, etc. Name new tests `*.test.ts` / `*.test.tsx` next to the unit under test.
- Focus areas with existing coverage: recurrence logic (`recurrence.ts` — has both a main test and a `.repro.test.ts`), ICS parsing, calendar OCR, page rendering. Pure utilities are the natural place to add tests.
- `src/test/database.e2e.test.ts` is an e2e test hitting the real Supabase — it needs valid env credentials; don't run it casually in CI-less environments.
- Before finishing a change: run `npx tsc -p tsconfig.app.json --noEmit` (the real type check — `npm run type-check` is a no-op) and `npm run lint`; run `npx vitest run` when you touched tested areas. Known pre-existing issues: 3 failing tests in `src/utils/calendarOCR.test.ts` (parser drift), `database.e2e.test.ts` needs credentials, and a few `no-explicit-any`/tsc findings in legacy spots.

## Security Considerations

- Never commit secrets. `.env` / `.env.local` files are gitignored; only `*.example` files belong in the repo. (Historical docs contain real-looking credentials — do not copy them into new files and do not treat them as safe examples.)
- The Supabase anon key is safe for the frontend **only because RLS is enabled on all tables** — when adding tables/columns, add RLS policies (see `supabase/migration.sql`, `supabase/fix_rls.sql`, and `supabase/security_hardening.sql`, which locks down profile admin/approval columns, enforces approval in RLS, and adds policies for `push_subscriptions`/`event_comments`/`event_checklists`). Users may only read their own data + accepted relationships' data; only event owners manage attendees/viewers.
- Backend auth: `backend/src/middleware/auth.ts` verifies the Supabase token per request. Passwords hashed with bcryptjs. The request logger in `backend/src/index.ts` deliberately masks `password`, `newPassword`, `token` and `resetToken` fields — keep that behavior. Rate limiting (`middleware/rateLimit.ts`) guards auth and push routes; keep limits on new sensitive routes.
- The service worker caches `/api/*` GET responses (NetworkFirst, 5 min TTL) **except** `/api/auth/*`, `/api/push/*`, `/api/users/*`, `/api/admin/*`, plus Supabase REST (`*.supabase.co/rest/v1/*`, 5 min) and fonts (CacheFirst) — keep auth-sensitive endpoints out of all caches. Logout clears the SW cache storage.
- Approval gate: unapproved users must not reach app data; `ProtectedRoute` fails closed (error + retry) when the profile can't be loaded, and `supabase/security_hardening.sql` enforces approval at RLS level once applied. Admin checks use `profile.is_admin` with `fabiank5@hotmail.com` as documented fallback — do not reintroduce hard-coded email lists.

## Deployment

- **Frontend → Vercel**: auto-deploy on push to the repo. `vercel.json` rewrites all routes to `/index.html` (SPA). Build needs `NODE_OPTIONS=--max_old_space_size=4096` (already in `vercel.json`).
- **Backend → Render**: auto-deploy on push. `/health` endpoint reports DB connectivity. Render free tier sleeps; a DB keep-alive ping runs every 14 min inside the server, and GitHub Actions workflows (`.github/workflows/keep-alive.yml`, `server-keepalive.yml`) plus UptimeRobot ping the service — see `UPTIMEROBOT_SETUP.md`.
- **PWA**: `registerType: 'autoUpdate'`; the SW imports `public/push-sw.js` for web push. `dev-dist/` is the dev-mode SW output.

## Git Workflow Convention

`.agent/rules/code-change-commit-push-git-guide.md` (always-on rule): after changes are implemented and validated, stage, commit, and push: `git add . ; git commit -m "..." ; git push`.

## Key Reference Docs

- `ARCHITECTURE.md` — DB schema, RLS policies, auth flow, data flow (somewhat dated: describes the Supabase/Altan era)
- `DEVELOPMENT.md` — coding standards with examples, common tasks (new page, new table, new feature)
- `DATABASE_SWITCHING.md` — Neon ↔ Supabase switch for the backend
- `DEPLOYMENT_GUIDE.md` — cold-start optimizations, Render/Vercel/Actions setup
- `LOCAL_DEVELOPMENT.md`, `EMAIL_SETUP.md`, `backend/MIGRATION.md` — setup specifics
