# API Endpoints (Supabase Edge Functions)

All endpoints live under `https://<supabase-project>.supabase.co/functions/v1/*`. Auth is via Supabase service role for the agent; anon key works for read-only calls allowed by RLS (public links/avatars).

## estate-db-query (POST)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/estate-db-query` |
| Method | POST |
| Purpose | Property search and detail fetch that powers the avatar menus and property overlay. |
| Request payload | ```json\n{ \"query\": \"string?\", \"filters\": { \"location\": \"string?\", \"max_budget\": number?, \"bedrooms\": number? }, \"property_id\": \"uuid?\", \"include_faq\": boolean? }\n``` |
| Response (search) | ```json\n{ \"properties\": [ {\"id\": \"uuid\", \"name\": \"string\", \"location\": \"string\", \"base_price\": number, \"amenities\": [\"string\"], \"unit_types\": [\"string\"], \"availability\": \"string\", \"highlights\": \"string\", \"hero_image\": \"string?\", \"bedrooms\": number?, \"bathrooms\": number?, \"area_sqft\": number?, \"project_status\": \"string?\"} ] }\n``` |
| Response (detail) | ```json\n{ \"property\": { ...single property fields... }, \"faqs\": [ {\"question\": \"string\", \"answer\": \"string\"} ] }\n``` |
| Status codes | 200 on success, 400 on bad input, 500 on server error. |
| Auth | Service role recommended (agent); anon allowed only where RLS permits. |

## estate-crm-create-lead (POST)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/estate-crm-create-lead` |
| Method | POST |
| Purpose | Create a lead record from the avatar flow or external intake. |
| Request payload | ```json\n{ \"full_name\": \"string\", \"phone\": \"string\", \"email\": \"string\", \"property_type\": \"string\", \"preferred_location\": \"string\", \"budget\": number, \"intent_level\": \"low\"|\"medium\"|\"high\", \"conversion_probability\": {\"3m\": number, \"6m\": number, \"9m\": number}, \"summary\": \"string?\" }\n``` |
| Response | `{ "lead_id": "uuid" }` |
| Status codes | 200 success, 500 on failure. |
| Auth | Service role or authenticated (RLS permits insert). |

## estate-crm-log-activity (POST)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/estate-crm-log-activity` |
| Method | POST |
| Purpose | Append a CRM activity/note tied to a lead. |
| Request payload | ```json\n{ \"lead_id\": \"uuid\", \"type\": \"note\"|\"task\"|\"status\", \"message\": \"string\", \"due_at\": \"iso-datetime|null\" }\n``` |
| Response | `{ "ok": true }` |
| Status codes | 200 success, 500 on failure. |
| Auth | Service role or authenticated. |

## conversation-summary (POST)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/conversation-summary` |
| Method | POST |
| Purpose | Uses OpenAI to turn a transcript into structured CRM fields and writes back to `conversations` (and optionally `leads`). |
| Request payload | ```json\n{ \"transcript\": \"string\", \"conversationId\": \"uuid?\", \"leadId\": \"uuid?\" }\n``` |
| Response | ```json\n{ \"success\": true, \"summary\": { \"person_name\": \"string\", \"flat_specification\": \"string\", \"facing_preference\": \"string\", \"interest_level\": \"Low\"|\"Medium\"|\"High\", \"period_to_buy\": \"string\", \"responsibility\": \"string\", \"key_action_points\": \"string\", \"preferred_floor\": \"string\", \"conversation_summary\": \"string\", \"sentiment_topics\": \"string\" } }\n``` |
| Status codes | 200 success, 400 missing transcript, 500 on OpenAI/DB error. |
| Auth | Service role (edge function owns the write). |

## livekit-token (POST/GET)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/livekit-token` |
| Method | POST (preferred) or GET |
| Purpose | Mint a LiveKit access token for visitors. |
| Request | Body or query: `{ "room": "string", "participant": "string", "metadata": "string", "ttl": "5m|15m|..." }` |
| Response | `{ "token": "jwt", "serverUrl": "wss://...", "room": "string", "identity": "string" }` |
| Status codes | 200 success, 500 missing LiveKit creds or mint failure. |
| Auth | Service role (function has env secrets). |

## livekit-request-agent (POST)
| Field | Details |
| --- | --- |
| URL | `/functions/v1/livekit-request-agent` |
| Method | POST |
| Purpose | Idempotently dispatch the `estate-avatar` agent to a LiveKit room and create the room if needed. |
| Request payload | ```json\n{ \"room\": \"string\", \"agentConfig\": { \"visitorName\": \"string\", ...optional prompt/model overrides... } }\n``` |
| Response | `{ "success": true, "agentConfig": { ...echoed overrides... } }` |
| Status codes | 200 success, 400 missing room, 500 on dispatch error or missing LiveKit creds. |
| Auth | Service role (function holds LiveKit API key/secret). |

---

## Database Model Map
- **properties** `1<-*` **property_faqs**: property listings with amenities, unit_types, base_price, hero_image.
- **leads** `1<-*` **conversations** `1<-*` **activities**: CRM core with sentiment/topics, summaries, tasks/notes.
- **admin_profiles**: user metadata seeded on signup.
- **ai_avatars** `1<-*` **public_links**: avatar prompt/config tied to public share slug and LiveKit room metadata.
- **reports**: generated HTML reports linked to conversations/leads.
- **Views**: `lead_overview`, `insight_intent_counts`, `insight_conversion_avgs`, `insight_sentiment_topics`, `insight_agent_performance` power dashboards without custom SQL in the client.
- **Security**: RLS enabled everywhere. Anon can only read enabled `public_links` and active `ai_avatars`; CRUD requires authenticated role or service key.
