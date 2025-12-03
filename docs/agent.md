# Avatar Experience Comparison & Blueprint

## Architecture Comparison
- **Reference (Icecream kiosk)**: Next.js frontend joins LiveKit, renders video, overlay layer, and product showcase via RPC/data-channel. Python `avatar_anam.py` holds full KB (`SCOOP_KB`), rich prompt, and tools that emit `client.products`, `client.directions`, plus legacy `ui.overlay`. LiveKit API routes handle token + agent dispatch; room RPCs support add-to-cart and overlay acks.
- **Real-estate (current)**: Next.js frontend similar LiveKit shell but slimmer overlay. KB is in Supabase tables (`properties`, `property_faqs`); agent (`estate_avatar.py`) queries DB through edge fn `estate-db-query` and publishes `ui.overlay` payloads (`properties.menu/detail`, `leads.*`). No cart-style dual-panel overlay; minimal RPC (visitor.selectProperty) and no client.products/client.directions RPC parity.
- **Sessions/rooms**: Both dispatch agent before room join. Reference also exposes stop-agent route and RPC handlers for cart/directions; real-estate relies solely on data channel updates and has no agent-stop endpoint.

## System Instruction Prompts
- **Reference prompt (SCOOP_PROMPT)**: Identity-heavy, short-text outputs, strict tool-calling recipes, phased flow (category grid -> detail -> flavors -> toppings -> add_to_cart), Quick Order branch, guardrails, and UI sync guidance with `{{SESSION_CONTEXT}}`.
- **Real-estate prompt (DEFAULT_PROMPT + Avatars UI)**: Short concierge script (welcome, discover, list_properties, show_property_detail, create_lead, log_activity, guardrails). Lacks phased flow, UI sync specifics, and overlay/RPC guidance.
- **Proposed real-estate prompt (match reference rigor, DB-backed KB)**:
```
You are **Estate Buddy**, the showroom concierge for Gulf Estate AI. You speak as a real person, not an AI.

# Output
- Plain text only, 1-3 sentences, one question at a time.
- Stay factual: prices, availability, amenities, timelines from Supabase responses; never invent.
- Keep UI in lockstep with speech using {{SESSION_CONTEXT}} and tool results.

# Flow (Guided)
1) Greet and learn their name, budget, preferred area, property type, move-in timing, must-haves.
2) Run `list_properties` with available filters before describing options so the carousel matches your words.
3) When they focus on a listing, run `show_property_detail(property_id)`; narrate highlights you see on screen.
4) Confirm interest and invite next steps (tour, brochure, follow-up). After you have name + phone/email, call `create_lead`.
5) Log promises (brochure, tour, custom unit) with `log_activity`.
6) Summarize agreed next step and keep the session open for final questions.

# Tool Rules
- Always pass `query`/`location`/`max_budget`/`bedrooms` when known to `list_properties`.
- After any preference change, refresh the carousel with `list_properties`.
- Use `show_property_detail` only after the user singles out a listing (voice or selection event).
- `create_lead` only after a contact method is confirmed.
- `log_activity` only for explicit promises or actions.

# Guardrails
- Do not guess prices/availability; say you will verify if missing.
- If audio is unclear, ask to repeat.
- Keep the overlay and verbal state synchronized; re-show detail if the user returns to a listing.
```

## Function / Tool Calls
- **Reference tools**:
  - `list_menu(kind, category?, size?, query?, view?, product_id?)` -> emits overlay + RPC `client.products` and `client.{flavors|toppings}Loaded`.
  - `choose_flavors(product_id, flavor_ids[])`, `choose_toppings(product_id, topping_ids[])` -> refresh detail overlay, track free vs extra.
  - `add_to_cart(product_id, qty)` -> emits `client.products` action `added` + cart overlay.
  - `get_directions(display_name)` -> emits `client.directions` and overlay.
- **Real-estate tools**:
  - `list_properties(query?, location?, max_budget?, bedrooms?)` -> publishes `properties.menu` overlay.
  - `show_property_detail(property_id)` -> publishes `properties.detail` overlay.
  - `create_lead(...)`, `log_activity(...)` -> persist to Supabase, minimal UI feedback (lead badge).
- **Unified tooling spec for real estate (to mirror reference)**:
  1) Retain current tools but extend outputs:
     - `list_properties` returns `items[]` with `price`, `location`, `image`, `availability`, and emits **RPC `client.properties`** `{ action: "menu", items, filters, query }` plus legacy `ui.overlay` for backward compatibility.
     - `show_property_detail` emits **RPC `client.properties`** `{ action: "detail", item, faqs }` and `ui.overlay` detail payload.
     - Add `client.leads` RPC events for `{ action: "created" }` and `{ action: "activity" }`.
  2) Add visitor -> agent RPCs like reference:
     - `visitor.selectProperty` (already present) should set `contextProductId` and request detail refresh.
     - Optional `visitor.requestTour` / `visitor.shareContact` RPC hooks to map buttons to tools.
  3) Mirror overlay ack logic: include `overlayId` in payloads and let client send `agent.overlayAck` RPC.

## UI Overlay & Product Showcase
- **Reference UI**:
  - OverlayLayer renders cards up to 520px wide, radius 32px, with panel layouts: product grid, detail, flavors/toppings side panels, cart panel, directions panel. Active layer selection drives layout. ProductShowcase at bottom shows menu/detail/toast state with category pills and add-to-cart CTA.
  - Data sources: RPC `client.products` / `client.directions` plus `ui.overlay` mirror; menus cached for side-by-side grid+detail view. Cart indicator shows count/total.
- **Real-estate UI (current)**:
  - Single overlay card with conversation timeline + property panel (menu on left, detail on right). No cart/toast concept; no RPC-based ProductShowcase component. PropertyShowcase component exists but only used in admin (different styling).
- **Spec to match reference for properties**:
  - Reuse reference layout: two-card flex at bottom of video. Card widths: detail up to 520px, menu panel 360-520px, radius 32px, shadowed white background, padding 24-28px.
  - Implement `OverlayLayer`-like state machine with layers: `properties` (grid/detail), `leads` (status chips), `directions` (pickup/office map), `clear`.
  - Build `ProductShowcase` variant for properties: category tabs (by location/type), grid of property cards (image, price, badges), detail view with hero image, amenities chips, unit types, FAQs, CTA buttons (book tour, request brochure). Show toast when lead captured.
  - Accept both RPC (`client.properties`) and data-channel `ui.overlay` payloads for resilience; cache last menu to re-render after reconnect.

## Conference Room / Kiosk UI
- **Reference**: Video centered, overlay layer floats near top-right, ProductShowcase anchored bottom-center, control bar bottom floating pill. Uses RPC handlers for directions and overlay ack.
- **Real-estate**: Video fullscreen, overlay centered bottom with timeline + property panel, control bar bottom; no separate showcase component.
- **Target alignment**:
  - Place ProductShowcase (property carousel + detail) at bottom like reference; move conversation timeline into a slimmer right column inside overlay or a collapsible drawer.
  - Keep control bar pill at bottom; ensure LiveKit theme matches reference padding/spacing.
  - Add RPC handlers for `client.properties`, `client.directions`, `client.leads` to drive overlay/showcase without relying solely on `ui.overlay`.

## Implementation Plan
1) **Prompt**: Replace avatar prompt defaults with the proposed prompt; enforce metadata parsing (model/voice/persona) and surface prompt preview in `/dashboard/avatars`.
2) **Tool schema**: Extend `list_properties` and `show_property_detail` to emit RPC payloads compatible with reference `client.products` schema (rename action to `client.properties`). Add overlayId and include `contextProductId` for ack/selection flows. Add lead/activity RPC events.
3) **UI overlays**: Port reference `OverlayLayer`/`ProductShowcase` structure into `src/app/rooms/[roomName]` using property fields (price, location, availability, unit_types, amenities, FAQs). Match sizing (32px radius, 24-28px padding, dual-column grid) and spacing.
4) **Session lifecycle**: Add stop-agent endpoint (mirror reference) or room disconnect hook to delete dispatch; handle reconnection by caching last overlay state and rehydrating after LiveKit reconnect.
5) **KB sourcing**: Keep Supabase-backed KB but introduce a lightweight cache in the agent (recent queries) to reduce round trips; preload default featured properties on dispatch to mimic reference’s in-memory KB speed.
6) **Telemetry & acks**: Send overlay ack RPCs (`agent.overlayAck`) from the client; log UI RPC results in the agent (`last_rpc_method` already tracked in reference).
7) **Visitor UI controls**: Wire CTA buttons (book tour, request brochure, share contact) to visitor -> agent RPCs that call `create_lead`/`log_activity`, so UI and CRM stay synchronized.
