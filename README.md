# Realestate Gulf AI

Voice-first real estate CRM that combines a Supabase-backed admin console with a LiveKit/Anam avatar powered by OpenAI Realtime. The app now relies on **your personal Supabase project** (set via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for auth, storage, and public experiences.

## Highlights

- Next.js 16 App Router UI with Tailwind CSS, Lucide icons, and gated admin layout.
- Dashboard modules for KPIs, leads, conversations, reporting mockups, and property/FAQ management.
- AI avatar builder that maps prompts, Anam personas, and LiveKit rooms to public share links.
- Visitor funnel: `/avatar/[slug]` landing -> `/rooms/[roomName]` overlay with LiveKit audio plus agent telemetry.
- Supabase Edge Functions for property search, CRM mutations, LiveKit token minting, and conversation summarization.

For a full architectural breakdown (components, data model, APIs, and cleanup log), read [`SYSTEM_OVERVIEW.md`](./SYSTEM_OVERVIEW.md).

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create `.env` (use `.env.example` as a template)** and fill in *your* credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
   SUPABASE_SERVICE_ROLE_KEY=service-role-key
   LIVEKIT_URL=wss://your-livekit-host
   LIVEKIT_API_KEY=lk_api_key
   LIVEKIT_API_SECRET=lk_api_secret
   OPENAI_API_KEY=sk-live
   ANAM_API_KEY=anam_key
   ```
   > Important: point those Supabase keys at your personal project (not Bolt's). The browser only needs the anon key; edge functions and the Python worker use the service-role key.

3. **Provision Supabase**
   ```bash
   supabase db push
   supabase functions deploy estate-db-query estate-crm-create-lead estate-crm-log-activity conversation-summary livekit-token livekit-request-agent
   ```

4. **Run the Next.js app**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000, create an admin at `/auth`, seed the Knowledge Base, then configure an avatar and public link.

5. **Start the LiveKit agent**
   ```bash
   pip install -r agents/requirements.txt
   python agents/estate_avatar.py
   ```
   Copy the same environment values into `agents/secreat.env` so the worker can reach Supabase, LiveKit, OpenAI, and Anam.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Produce a production build. |
| `npm run start` | Run the compiled build. |
| `npm run lint` | ESLint with warnings treated as errors. |
| `npm run typecheck` | TypeScript project check. |

## Repository Layout

```
src/
  app/                # App Router routes (auth, dashboard, public avatar, LiveKit room)
  components/         # Reusable UI (lead table, overlay, etc.)
  contexts/           # Auth provider backed by Supabase
  lib/                # Supabase client + auth helpers
  styles/             # Tailwind + custom CSS
  types/              # Shared DB-shaped types
agents/               # LiveKit/OpenAI/Anam worker (Python)
supabase/             # Migrations, seed data, Edge Functions, config
```

## Documentation

Only two documentation files remain:

- [`README.md`](./README.md) - setup and runbook (this file)
- [`SYSTEM_OVERVIEW.md`](./SYSTEM_OVERVIEW.md) - architecture, data flow, APIs, agent internals, and cleanup notes
