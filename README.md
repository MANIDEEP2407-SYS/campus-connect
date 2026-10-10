# CampusConnect Amrita

**One Campus. Every Connection. Every Opportunity.**
A unified collaboration and smart-campus platform prototype for Amrita Vishwa Vidyapeetham, Coimbatore — communities with realtime chat, social feed, people discovery, clubs & events, research & consultancy, academic resources, **CampusPulse** issue reporting, **Lost & Found**, **Amrita Microsoft 365 sign-in** and **CampusShield** AI-assisted moderation.

**Live demo:** https://campus-connect-nu-nine.vercel.app

> Prototype. Not an official university system. All demo people, clubs, events, incidents and listings are **fictional**. CampusPulse is not an emergency service.
>
> The hosted demo uses development sign-in (Microsoft sign-in awaits university configuration) and the development moderation mock (no AI key configured). Hosted demo accounts use a private password, not the one in `.env.example`.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, shadcn/ui on Base UI, Lucide icons, Sonner, Leaflet + OpenStreetMap |
| Forms | React Hook Form + Zod 4 (same schemas validate on client and in server actions) |
| Backend | Supabase — PostgreSQL with Row Level Security, Auth, Storage, Realtime |
| Auth | Supabase Auth: Microsoft Entra ID (OIDC + PKCE) for production, email/password for development |
| AI moderation | Provider interface: OpenAI `omni-moderation-latest`, or a clearly labelled development mock |
| Testing | Vitest (unit + integration against the local database) |
| Hosting | Vercel + hosted Supabase |

Architecture: a modular monolith. Server components read data as the signed-in user; mutations are Zod-validated **server actions**; every rule that matters is enforced **in the database** (RLS, triggers, `SECURITY DEFINER` RPCs), because the anon key is public.

## Quick start (local)

Requirements: Node 20.9+ (tested on 24) and Docker Desktop running.

```bash
npm install
npm run db:start             # local Supabase in Docker; prints the URL and keys
cp .env.example .env.local   # fill in the URL, anon key and service-role key from db:start
npm run db:reset             # apply migrations + seed fictional demo data
npm run build && npm start   # or: npm run dev
```

Open http://localhost:3000. Local auth emails land in Mailpit (http://127.0.0.1:54324); Supabase Studio is at http://127.0.0.1:54323.

> ⚠️ `npm run db:reset` deletes **every** local account and all data. `npm run db:seed` only replaces the `@demo.campusconnect.test` demo accounts.

### Demo accounts

All on `@demo.campusconnect.test`, password = `DEMO_PASSWORD` from `.env.local` (see `.env.example`). Email/password sign-in is development-only.

| Handle | Role in the demo |
|---|---|
| `aditi`, `rahul`, `sneha`, `arjun`, `vikram`, `nikhil` | Undergraduates |
| `fatima`, `divya` | Postgraduates |
| `karthik` | Doctoral scholar (can publish research) |
| `anand`, `priya` | Verified faculty |
| `security`, `maintenance` | CampusPulse safety responders |
| `moderator` | Safety moderator (CampusShield, Lost & Found) |
| `admin` | Platform admin (roles, verification, audit log) |

### Scripts

| Script | Purpose |
|---|---|
| `db:start` / `db:stop` | Start / stop local Supabase |
| `db:reset` | Recreate the database from migrations and seed (destroys local data) |
| `db:seed` | Re-seed demo accounts only |
| `db:types` | Regenerate `src/lib/database.types.ts` |
| `typecheck`, `lint`, `build` | Quality gates |
| `test:unit` | Logic tests (no database needed) |
| `test:integration` | Authorization and workflow tests against the seeded local database |

## Features

- **Profiles & auth** — Microsoft college-account sign-in, onboarding, skills/interests/goals, visibility controls, DM opt-out, block and mute. Privileged roles are granted only by admins (audited); signing in never grants a role.
- **Home feed** — posts with images, likes, comments, bookmarks, follows, filters, club announcements, reporting.
- **Discover** — server-side search and transparent, rules-based recommendations.
- **Communities** — public/private servers, invites, join requests, channels, roles, realtime messages with typing indicators, replies, edits and moderation.
- **Direct messages** — private realtime conversations.
- **Clubs & events** — official vs student clubs, membership approval, events with capacity-safe registration, reminders.
- **Research & consultancy** — listings, applications and decisions; restricted budget details.
- **Academic resources** — official vs student-contributed material and course communities.
- **CampusPulse** — issue and safety reports with map, duplicate detection, responder desk, enforced status lifecycle, campus alerts; reporters stay anonymous publicly.
- **Lost & Found** — suggested matches, private verification details, claim → review → handover, sensitive-item handling, moderation.
- **CampusShield** — AI-assisted moderation queue for posts, comments and community messages (see below).

## Microsoft sign-in (Amrita Microsoft 365)

Sign-in uses Supabase Auth's `azure` provider (OAuth 2.0 / OpenID Connect, authorization-code flow with PKCE). Institutional membership is established only from the **verified tenant in the ID token's issuer** — never from an email domain:

1. Supabase Auth is configured with the tenant-specific issuer, so tokens from any other tenant are rejected.
2. `/auth/callback` re-checks the stored issuer against `MICROSOFT_TENANT_ID` and signs the user out on mismatch (fails closed if unset).
3. A database trigger records the verified tenant on the profile; users cannot edit it. Profiles from the approved tenant show a *Verified Amrita Microsoft account* badge.

Setup:

1. **Register an app** in Microsoft Entra ID (Azure portal → App registrations → New registration), single tenant, in the Amrita tenant. This normally needs the university's IT administrators.
2. **Redirect URI** (Web): `https://<your-supabase-project>.supabase.co/auth/v1/callback` (local: `http://127.0.0.1:54321/auth/v1/callback`).
3. Create a **client secret**; note the **Application (client) ID** and **Directory (tenant) ID**. Grant `openid`, `email`, `profile` (User.Read); an admin may need to grant consent.
4. **Supabase** → Authentication → Providers → Azure: enable, enter client ID and secret, and set the URL to `https://login.microsoftonline.com/<tenant-id>/v2.0` (never `common`). Locally, set the `SUPABASE_AUTH_EXTERNAL_AZURE_*` variables and enable `[auth.external.azure]` in `supabase/config.toml`.
5. **App env**: `NEXT_PUBLIC_MICROSOFT_AUTH_ENABLED=true`, `MICROSOFT_TENANT_ID=<tenant-id>`.
6. In production, **disable the Email provider** in Supabase Auth and keep `ALLOW_DEV_LOGIN=false`.

## CampusShield (AI-assisted moderation)

- **Pipeline:** every post, comment and community message gets a scan job from a database trigger (it cannot be skipped). A server-only worker sends the redacted text to the provider, applies the configurable policy, and opens or updates a moderation case. Moderators decide; the AI never does.
- **Separate fields:** model scores, policy risk level, human review status and the final decision are stored separately. Model scores describe text, not people.
- **Risk levels:** low (publish) · review · high priority · critical (temporarily withheld for others until reviewed — only threats, hate, sexual harassment, content involving minors and self-harm risk).
- **False positives:** quotes, reports and academic discussion lower the risk one level; repeated-bullying is inferred only from prior *reviewed* outcomes, never from one message.
- **Privacy:** private DMs are never scanned unless a participant reports one message. Phone numbers, emails and ID numbers are redacted before text leaves the server. Reporter identities stay hidden. Routine scans are deleted after 90 days.
- **Moderator tools** (`/shield`): filtered queue, case context, model output, linked reports, decisions (dismiss, warning, edit request, removal, temporary posting restriction, escalation) with confirmation and audit, appeals.
- **User tools** (`/safety`): AI-moderation disclosure, decisions on your content, appeals, blocked users; report categories on posts, comments and DMs; gentle pre-post suggestions.
- **Provider:** `MODERATION_PROVIDER=openai` with `OPENAI_API_KEY`, or `mock` for development (always labelled "not AI"). Provider errors and timeouts are recorded without inventing classifications and never block posting.
- **Scheduled worker:** `/api/shield/sweep` (protected by `CRON_SECRET`) retries queued scans and applies retention; `vercel.json` runs it daily.

## Deploying (Vercel + hosted Supabase)

1. Create a Supabase project, then `npx supabase login`, `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. Supabase → Authentication → URL configuration: Site URL = your Vercel URL; add `https://<your-app>/**` to redirect URLs.
3. Vercel → import the repo and set environment variables (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, used by the moderation worker), `MODERATION_PROVIDER`, `OPENAI_API_KEY`, `CRON_SECRET`, Microsoft variables, `ALLOW_DEV_LOGIN`.
4. Optionally seed demo data: point `.env.local` at the hosted project and run `npm run db:seed`.

## Before real students use it

- University approval for Microsoft sign-in (app registration, tenant, consent).
- Institutional approval for sending post text to the moderation provider, the retention policy, and the moderation/appeals process.
- Disable email/password sign-in in production.

## Known limitations

- Uploaded photos are not re-encoded, so EXIF metadata (including GPS) is not stripped.
- Typing indicators use public Realtime broadcast channels (they reveal that someone is typing, never message content).
- Rate limits are per user in the database; there is no IP-level throttling.
- Event reminders and expiry sweeps run on page visits and the daily cron.
- Not built: per-channel unread counts, voice/video, doctoral committee and NIRF/NAAC/NBA evidence modules.
