# System Analysis - Realestate Gulf AI

## What the SaaS Does
A voice-first CRM for in-house real-estate walk-ins. Admins manage leads, conversations, reports, properties/FAQs, and configure AI avatars plus shareable kiosk links. Visitors launch a public avatar experience that joins a LiveKit room where the agent surfaces property options from Supabase and can capture leads.

## Frontend Architecture
- **Framework**: Next.js 16 App Router with client components; Tailwind + custom CSS for dashboard and avatar/kiosk styling.
- **Routing & shells**:
  - `/auth` standalone auth page (email/password) using Supabase auth helpers.
  - `/dashboard/*` behind `AuthContext` and `(dashboard)/layout.tsx` with nav + sidebar.
  - Admin modules: `/dashboard` (KPIs + charts), `/leads` (LeadTable + LeadDrawer), `/conversations`, `/reports` (static sample), `/kb` (properties + FAQs), `/avatars` (avatar builder + share links).
  - Public funnel: `/avatar/[slug]` landing hero -> `/rooms/[roomName]` LiveKit experience.
- **State management**: Local React state + effects; `AuthContext` tracks session/profile via supabase client. No global store.
- **Data access**: Supabase JS (anon key) directly queries views/tables on the client for dashboard/CRM, and for public link resolution. Export/download flows build CSV client-side.
- **Styling & UI patterns**:
  - Dashboard uses card grid (ChartCard, KPI, ActivityList) with Lucide icons and Recharts.
  - KB view uses two-pane list/detail, badge chips for unit_types/amenities, inline FAQ cards.
  - Avatar builder provides persona/model/voice selectors, prompt editor, metadata encoding in prompt, share-link controls with preview badges.
  - Room UI (`EstateVideoConference` + `EstateOverlay`) places video fullscreen, overlay card bottom-center with conversation timeline + property panel, and a floating control bar.
- **Backend communication from UI**:
  - Supabase table reads: lead_overview, insight_* views, leads, activities, conversations, properties, property_faqs, ai_avatars, public_links.
  - LiveKit React components connect via token from edge fn and exchange overlay data on `ui.overlay`; RPC from visitor (`visitor.selectProperty`) or agent.

## Backend Structure
- **Supabase Edge Functions**: `estate-db-query`, `estate-crm-create-lead`, `estate-crm-log-activity`, `conversation-summary`, `livekit-token`, `livekit-request-agent`. They encapsulate service-role operations (property search/detail, CRM mutations, OpenAI summarization, LiveKit dispatch/token).
- **Supabase schema**: Tables for properties, property_faqs, leads, conversations (extended with person/interest/summary fields), activities, admin_profiles, ai_avatars, public_links, reports; plus analytical views for KPIs.
- **Agent runtime**: `agents/estate_avatar.py` (Python LiveKit agent). Uses OpenAI Realtime + Anam avatar. Tools: list_properties, show_property_detail, create_lead, log_activity. Publishes overlays on data channel and calls Supabase functions for DB-backed KB and CRM writes.

## Data Models & Relationships
- `properties 1<-* property_faqs`
- `leads 1<-* conversations 1<-* activities`
- `ai_avatars 1<-* public_links` (share slug + room metadata)
- `admin_profiles` keyed by auth.user_id; `reports` optional link to conversations/leads.
- Views supply aggregates for KPIs and charts.

## Integration & Flow Notes
- **LiveKit**: Room join via `livekit-token` fn; `livekit-request-agent` ensures agent dispatch. Data channel topic `ui.overlay` carries property menus/details and lead events to `EstateOverlay`.
- **Anam avatar + OpenAI Realtime**: Run inside the Python agent to render the video feed and speech.
- **Performance**:
  - Dashboard fetches multiple Supabase queries in parallel; no caching. Charts render client-side.
  - Room overlay updates rely on data-channel; no reconnection replay beyond latest state in memory.
  - CSV exports built client-side; safe for small datasets.

## Strengths, Weaknesses, Opportunities
- **Strengths**
  - Clear separation of admin console vs visitor flow.
  - DB-backed KB (properties + FAQs) so content is dynamic without code edits.
  - Edge functions isolate privileged actions (token minting, summarization, CRM writes).
  - Avatar builder already maps prompt/model/voice/persona to share links and LiveKit rooms.
- **Weaknesses**
  - Client-side Supabase reads everywhere; no server components or caching; RLS must stay tight.
  - Avatar overlay is simpler than reference (single card with menu + detail; no dual-panel carts or RPC parity).
  - Room UX does not replay overlay state on reconnect; no explicit error channel or typing indicators.
  - Limited validation on forms (CSV imports not implemented; edit modals stubbed).
  - Agent tools return plain strings; UI/tool schemas are not as rich as reference RPC payloads.
- **Opportunities**
  - Add server actions or API routes to cache dashboards and protect anon reads.
  - Align overlay schemas and RPCs with reference (menu/detail/cart/directions) to enable richer UI and resilience.
  - Implement CSV import/export for KB and leads; add pagination to large tables.
  - Add telemetry (latency, dispatch status) and retries around LiveKit data publishing.
  - Harden prompt/versioning storage (metadata header is present; can enforce parsing and validation on save).
