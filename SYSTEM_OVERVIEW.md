# System Overview

Realestate Gulf AI pairs a Next.js admin console with a LiveKit/Anam avatar that runs on OpenAI Realtime. Every environment variable points to **your personal Supabase project** (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`), so nothing depends on Bolt-hosted infrastructure. This document is the single source of truth for how the system fits together and which legacy assets were removed.

## High-Level Architecture

- **Next.js 16 App Router** supplies all pages. Authenticated areas live under `src/app/(dashboard)` and are wrapped in `AuthProvider` + `Layout`. Public experiences (`/avatar/[slug]` and `/rooms/[roomName]`) are lightweight client components that anonymous visitors can access.
- **Supabase** handles authentication, data storage (properties, leads, activities, public links, etc.), row-level security, and Edge Functions that behave as our HTTP API surface.
- **LiveKit + Anam + OpenAI Realtime** power the avatar. Browsers join a LiveKit room, an Anam persona streams video, and the Python worker (`agents/estate_avatar.py`) drives the conversation through OpenAI's Realtime interface while calling Supabase Edge Functions.
- **Edge Functions as APIs** (`estate-db-query`, `estate-crm-create-lead`, `estate-crm-log-activity`, `conversation-summary`, `livekit-token`, `livekit-request-agent`) are the only way UI components and the worker mutate server data.
- **Overlay data channel**: the worker publishes LiveKit data messages (`ui.overlay`) that the React overlay consumes to show menus, property detail cards, lead confirmations, and activity toasts in real time.

```
Visitor Browser
  -> /avatar/[slug] -> Supabase (public_links + ai_avatars)
  -> /rooms/[roomName]
       -> fetch livekit-token edge function -> LiveKit cloud
       -> fetch livekit-request-agent (LiveKit Dispatch)

Admin Browser
  -> /dashboard/* -> Supabase tables/views (authenticated session)

Python Agent (LiveKit worker)
  -> Supabase Edge Functions (db query + CRM actions)
  -> Publishes ui.overlay messages -> EstateOverlay component
```

## Frontend Surfaces & Backend Usage

### Auth + Layout
- `src/contexts/AuthContext.tsx` boots Supabase Auth, ensures each admin receives an `admin_profiles` row, and exposes `user`, `profile`, and `signOut`.
- `src/app/layout.tsx` loads global styles and wraps the tree with `Providers`.
- `src/app/(dashboard)/layout.tsx` guards every admin view; anonymous users are redirected to `/auth`.
- `src/components/Layout.tsx` renders navigation, surfaces the admin display name, and provides sign-out buttons.

### Navigation Routes

| Route | Purpose | Backend touchpoints |
| --- | --- | --- |
| `/auth` | Email/password registration and login. | Calls `supabase.auth.signUp/signIn`; the context then inserts/updates `admin_profiles`. |
| `/dashboard` | KPI tiles, charts, and activity feed. | Reads `lead_overview`, `insight_intent_counts`, `insight_conversion_avgs`, and the `activities` table. |
| `/leads` | Lead table with drawer for editing and manual notes/tasks. | Reads/writes `leads` and `activities`. CSV export happens entirely in the browser. |
| `/conversations` | Transcript browser driven by the avatar. | Reads `conversations`; filtering/searching is client side. |
| `/reports` | Reporting mockups. | Uses static `sampleData` only (no backend dependency). |
| `/kb` | Property + FAQ management. | Full CRUD against `properties` and `property_faqs`. |
| `/avatars` | Configure AI avatars plus shareable public links. | Reads and updates `ai_avatars`/`public_links`, encodes prompt metadata, controls LiveKit defaults. |
| `/avatar/[slug]` | Public landing page for a visitor. | Anonymous Supabase reads on `public_links` + `ai_avatars`; POSTs to `livekit-request-agent` to spin up a worker. |
| `/rooms/[roomName]?slug=...` | Full LiveKit room with overlay. | Reads `public_links`/`ai_avatars`, calls `livekit-token` for a JWT, re-requests the worker via `livekit-request-agent`, and publishes visitor selections via LiveKit data channels. |

**Summary:** every admin view except `/reports` depends directly on Supabase data. Public-facing routes rely on Supabase reads plus the two LiveKit helper functions. `/reports` is the only navigation item that does not hit the backend today.

## Data Model (Supabase)

| Table/View | Description | Used by |
| --- | --- | --- |
| `properties` | Canonical property listings (amenities, unit types, hero media, pricing). | `/kb`, avatar tools via `estate-db-query`, overlay detail panel. |
| `property_faqs` | FAQs tied to a property. | `/kb`, `estate-db-query` when `include_faq` is true. |
| `leads` | CRM leads with intent, conversion probability, stage, and budget. | `/leads`, dashboard KPIs, agent `create_lead`. |
| `activities` | Notes/tasks/status entries for leads. | `/leads` drawer, manual logging, agent `log_activity`. |
| `conversations` | Transcript store enriched by `conversation-summary`. | `/conversations`. |
| `admin_profiles` | Display names for admins (FK to Supabase Auth users). | Navigation header via `useAuth`. |
| `public_links` | Shareable configuration for the public avatar: slug, LiveKit room, prompts, defaults, rate limits. | `/avatars`, `/avatar/[slug]`, `/rooms/*`. |
| `ai_avatars` | Prompt, Anam persona, model/voice metadata, activation flag. | `/avatars`, public experiences. |
| Views (`lead_overview`, `insight_intent_counts`, `insight_conversion_avgs`, `insight_sentiment_topics`, `insight_agent_performance`) | Aggregations for dashboards. | `/dashboard`. |

All tables enforce row-level security. Anonymous visitors can only read enabled `public_links` and active `ai_avatars`; every other table requires an authenticated session.

## Edge Functions & External APIs

| Function / API | Role | Callers |
| --- | --- | --- |
| `estate-db-query` | Queries `properties` with search filters or loads a single property + FAQs. | Python worker (`list_properties`, `show_property_detail`). |
| `estate-crm-create-lead` | Inserts a `leads` row and optional summary note. | Python worker (`create_lead`). |
| `estate-crm-log-activity` | Logs follow-up actions in `activities`. | Python worker (`log_activity`). |
| `conversation-summary` | Sends a transcript to OpenAI Chat (`gpt-4o-mini`), stores structured metadata back into `conversations`, and optionally upserts a `leads` record. | Python worker after each visitor session. |
| `livekit-token` (LiveKit Server SDK) | Issues browser JWTs to join a room. | `/rooms/[roomName]`. |
| `livekit-request-agent` (LiveKit Dispatch API) | Ensures a room exists, then assigns the worker with session overrides (prompt, avatar, etc.). | `/avatar/[slug]`, `/rooms/[roomName]`. |
| Supabase JS client | Auth, table CRUD, and invoking edge functions from the browser. | All React pages/components. |
| LiveKit Browser SDK (`@livekit/components-react`) | Renders audio/video tracks and exposes microphones + data channels. | `/rooms/[roomName]` via `EstateVideoConference`. |
| Anam Streaming Avatar API | Streams the visual persona inside the worker. | `agents/estate_avatar.py`. |
| OpenAI Realtime API | Drives dialogue + tool calling inside the worker. | `agents/estate_avatar.py`. |

## Agent Implementation (`agents/estate_avatar.py`)

1. **Configuration** - `AgentConfig.from_env()` reads LiveKit, Supabase, OpenAI, and Anam secrets. `with_session_overrides` merges overrides supplied by the public link (prompt, model, avatar id, etc.). Helper methods (`agent_identity`, `controller_identity`, `agent_metadata`) keep room metadata consistent.
2. **EstateTools helper** - wraps `_call_supabase_function` (HTTP POST with the service-role key) and `_publish_overlay` (LiveKit data channel) so each tool can focus on payload logic.
3. **Tool functions exposed to OpenAI Realtime**  
   - `list_properties(query, location, max_budget, bedrooms)` -> calls `estate-db-query`, emits a `properties.menu` overlay payload with card metadata, and returns a spoken summary.  
   - `show_property_detail(property_id)` -> fetches a single property (+FAQs) and publishes `properties.detail` so the overlay highlights that listing.  
   - `create_lead(full_name, email?, phone?, preferred_location?, property_type?, budget?, intent_level?, summary?, conversion_probability?)` -> validates contact info, calls `estate-crm-create-lead`, and emits `leads.created`.  
   - `log_activity(lead_id, message, activity_type, due_at?)` -> calls `estate-crm-log-activity` and emits `leads.activity`.
4. **Session management** - `entrypoint()` waits for a visitor, starts Anam + OpenAI sessions, attaches LiveKit transcription listeners, and triggers an opening greeting. `_submit_conversation_summary()` collects buffered transcripts and invokes the `conversation-summary` function when a visitor disconnects.
5. **Dispatch mode** - `request_fnc()` responds to LiveKit Dispatch requests so that `livekit-request-agent` can auto-scale the worker.

### Agent <-> Backend & Overlay Data

- Every tool call hits a Supabase Edge Function authenticated with the service-role key (fallback to anon key if necessary).
- LiveKit data messages carry overlay updates shaped as `{ type: "ui.overlay", payload: { kind, ... } }`. Current kinds are:  
  `properties.menu` (list of cards + filters),  
  `properties.detail` (single property with hero data),  
  `leads.created` (confirmation bubble), and  
  `leads.activity` (timeline note/task).
- Visitors can publish their own selections by sending JSON on the `"visitor"` topic, allowing bi-directional UI sync without extra HTTP APIs.

## Backend Usage Matrix

| Area | Uses backend? | Notes |
| --- | --- | --- |
| Dashboard KPIs / charts | Yes | Direct Supabase queries (views + `activities`). |
| Leads module | Yes | CRUD on `leads`/`activities`; CSV export is local. |
| Conversations | Yes | Read-only view of `conversations`. |
| Reports | No (mock data) | Placeholder dataset until native reporting is wired. |
| Knowledge Base | Yes | Full CRUD on `properties` + `property_faqs`. |
| AI Avatars | Yes | CRUD on `ai_avatars`/`public_links`; encodes prompt metadata. |
| Public avatar landing / room | Yes | Anonymous reads + edge functions (`livekit-request-agent`, `livekit-token`). |

## Cleanup Summary

| Item removed | Reason |
| --- | --- |
| `API_DOCUMENTATION.md`, `audit.md`, `Conversations.md`, `DEPLOYMENT_GUIDE.md`, `IMPLEMENTATION_GUIDE.md`, `IMPLEMENTATION_PLAN.md`, `PROJECT_SUMMARY.md`, `Prompting Guide.md`, `TESTING_GUIDE.md` | All referenced the old Vite/React-Router build or duplicated outdated instructions; consolidating into this doc + README satisfies the "1-2 docs" requirement. |
| `src/pages/_app.tsx`, `src/routes/` | Remnants from the Pages Router era; App Router now owns navigation and auth. |
| `src/components/LiveKitAvatar.tsx` | Obsolete client that was replaced by `/rooms/[roomName]/EstateVideoConference`. |
| `src/lib/fetch.ts` | Timeout helpers were unused everywhere. |
| `src/assistant/contracts.ts` | Legacy Assistant contract; the Python worker is the only agent implementation now. |
| `supabase/functions/generate-report/` | Edge function was never invoked by the UI. |
| `image/`, `dev.log`, `dev.err` | Empty artifact folder and transient logs. |

Only `README.md` and this `SYSTEM_OVERVIEW.md` remain as documentation.

---

Questions about any section above often mean a schema or API change is needed. Confirm requirements first, because the Python worker expects these exact payloads and table columns.
