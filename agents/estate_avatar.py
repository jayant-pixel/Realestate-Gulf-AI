"""
Estate Buddy Agent
------------------
LiveKit realtime worker that runs the Estate Buddy concierge persona.
The agent joins a LiveKit room, streams an Anam avatar, talks through OpenAI
Realtime, and calls Supabase Edge Functions for property search and CRM actions.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import httpx
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobRequest,
    RunContext,
    WorkerOptions,
    WorkerType,
    cli,
)
from livekit.agents.llm import function_tool
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import google, deepgram, cartesia, silero
from livekit.plugins.anam import avatar as anam_avatar

if TYPE_CHECKING:
    RunCtxParam = Optional[RunContext]
else:
    RunCtxParam = Optional[Any]

load_dotenv(dotenv_path=Path(__file__).resolve().with_name("secreat.env"))

logger = logging.getLogger("estate-buddy-agent")
logger.setLevel(logging.INFO)

DEFAULT_PROMPT = os.getenv("ESTATE_AGENT_PROMPT", "").strip()
FALLBACK_PROMPT = """
You are Estate Buddy, the Gulf Estate AI concierge. You host visitors in a LiveKit room with an avatar voice. Keep your replies concise, confident, and focused on real properties from Supabase.

Session context: {{SESSION_CONTEXT}}. If missing, ask for the visitor name. Use only Supabase-backed data and the provided tools; never rely on in-code knowledge.

Output rules:
- Speak in short paragraphs or bullets (1–3 sentences). Use natural tone, not robotic.
- Keep the UI in sync: whenever you surface options or details, call the relevant tool so overlays/RPCs match what you say.
- Confirm when you capture contact info or log an action.

Guided flow:
1) Welcome: greet, use the visitor name if present, ask about budget, preferred locations, property type, move-in timing, and must-have amenities.
2) List: call `list_properties` with filters before describing options; narrate 2–3 matches and invite a choice.
3) Detail: when a property is chosen (via the visitor or RPC), call `show_property_detail` and walk through highlights, price, availability, amenities, and unit types. Offer FAQs.
4) Commit: confirm visitor name + phone/email; then call `create_lead`. Use `log_activity` for tours/brochures/special asks.
5) Next steps: summarize agreed actions, directions if relevant, and keep the line open.

Tool rules:
- list_properties: include filters (location, budget, bedrooms/type). Always call before describing a set of options so cards align.
- show_property_detail: call after the visitor picks a listing or sends visitor.selectProperty. Mention what you see in the detail card.
- create_lead: only after you have full name + phone/email. Confirm the lead was created.
- log_activity: record promised tours, brochures, follow-ups, or direction shares; mention it back to the visitor.

UI sync & overlays:
- Each tool returns overlayIds; keep responding to the same overlayId until cleared or replaced.
- When an overlay renders, expect agent.overlayAck from the client. If not received, you may resend the overlay once.
- Keep overlays lean: properties.menu → grid, properties.detail → hero + FAQs, directions → pickup/office directions, leads → confirmation.

Guardrails:
- Do not invent inventory, pricing, or timelines. If data is missing, say you’ll verify and log it.
- Avoid promises/discounts. Offer ranges and next steps.
- If speech is unclear, ask to repeat. Keep safety and professionalism.
"""

TOOL_GUIDE = r"""
# Available Tools
- `list_properties(query, location, max_budget, bedrooms, overlay_id, context_property_id)`: Search Supabase for listings and push a properties.menu overlay + RPC payload. Include filters you know.
- `show_property_detail(property_id, overlay_id)`: Load one listing with FAQs and push properties.detail overlay + RPC payload. Use the propertyId from the menu or visitor.selectProperty.
- `create_lead(full_name, email, phone, preferred_location, property_type, budget, intent_level, summary)`: Create a CRM lead and emit a lead confirmation RPC.
- `log_activity(lead_id, message, activity_type, due_at)`: Record a promised tour/brochure/note and emit a lead activity RPC.
- `show_directions(locations, notes, overlay_id)`: Share labeled pickup/office directions with the visitor and show the overlay.
"""


@dataclass
class AgentConfig:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    google_api_key: str
    google_model: str
    deepgram_api_key: str
    cartesia_api_key: str
    cartesia_voice_id: str
    anam_api_key: str
    anam_avatar_id: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    agent_name: str = "Estate Buddy"
    agent_identity_prefix: str = "estate-agent"
    controller_identity_prefix: str = "estate-controller"
    prompt_version: str = "v1"
    prompt_updated_at: Optional[str] = None

    @classmethod
    def from_env(cls) -> "AgentConfig":
        livekit_url = os.getenv("LIVEKIT_URL")
        livekit_api_key = os.getenv("LIVEKIT_API_KEY")
        livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
        google_api_key = os.getenv("GOOGLE_API_KEY")
        anam_api_key = os.getenv("ANAM_API_KEY")
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")
        deepgram_api_key = os.getenv("DEEPGRAM_API_KEY")
        cartesia_api_key = os.getenv("CARTESIA_API_KEY")
        cartesia_voice_id = os.getenv("CARTESIA_VOICE_ID", "")

        missing = [
            name
            for name, value in [
                ("LIVEKIT_URL", livekit_url),
                ("LIVEKIT_API_KEY", livekit_api_key),
                ("LIVEKIT_API_SECRET", livekit_api_secret),
                ("GOOGLE_API_KEY", google_api_key),
                ("DEEPGRAM_API_KEY", deepgram_api_key),
                ("CARTESIA_API_KEY", cartesia_api_key),
                ("ANAM_API_KEY", anam_api_key),
                ("SUPABASE_URL", supabase_url),
            ]
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

        default_model_env = os.getenv("GOOGLE_MODEL") or os.getenv("GOOGLE_LLM_MODEL")
        default_model = (default_model_env.strip() if default_model_env else "") or "gemini-2.0-flash-exp"

        default_voice_env = cartesia_voice_id or os.getenv("DEFAULT_CARTESIA_VOICE_ID")
        default_voice = (default_voice_env.strip() if default_voice_env else "") or "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30"

        prompt_version = (os.getenv("PROMPT_VERSION") or "v1").strip() or "v1"
        prompt_updated_at = _clean_str(os.getenv("PROMPT_UPDATED_AT"))

        return cls(
            livekit_url=livekit_url,
            livekit_api_key=livekit_api_key,
            livekit_api_secret=livekit_api_secret,
            google_api_key=google_api_key,
            google_model=default_model,
            deepgram_api_key=deepgram_api_key,
            cartesia_api_key=cartesia_api_key,
            cartesia_voice_id=default_voice,
            anam_api_key=anam_api_key,
            anam_avatar_id=os.getenv("ANAM_AVATAR_ID", ""),
            supabase_url=supabase_url,
            supabase_service_role_key=supabase_service_role_key,
            supabase_anon_key=supabase_anon_key,
            agent_name=os.getenv("AGENT_NAME", "Estate Buddy"),
            agent_identity_prefix=os.getenv("AGENT_IDENTITY_PREFIX", "estate-agent"),
            controller_identity_prefix=os.getenv("CONTROLLER_IDENTITY_PREFIX", "estate-controller"),
            prompt_version=prompt_version,
            prompt_updated_at=prompt_updated_at,
        )

    def with_session_overrides(self, overrides: Dict[str, Any]) -> "AgentConfig":
        if not overrides:
            return self

        def _string_override(*keys: str) -> Optional[str]:
            for key in keys:
                value = overrides.get(key)
                cleaned = _clean_str(value)
                if cleaned:
                    return cleaned
            return None

        agent_name = _string_override("agentName") or self.agent_name
        agent_identity_prefix = _string_override("agentIdentityPrefix") or self.agent_identity_prefix
        controller_identity_prefix = (
            _string_override("controllerIdentityPrefix") or self.controller_identity_prefix
        )
        model_override = _string_override("googleModel", "openaiRealtimeModel", "openaiModel", "model")
        if model_override and "gemini" not in model_override.lower():
            model_override = None  # ignore incompatible model strings
        google_model = model_override or self.google_model

        voice_override = _string_override("cartesiaVoiceId", "voice", "openaiVoice", "openaiRealtimeVoice")
        if voice_override and "-" not in voice_override:
            voice_override = None  # avoid invalid Cartesia voices from legacy overrides
        cartesia_voice_id = voice_override or self.cartesia_voice_id

        anam_avatar_id = (
            _string_override("anamAvatarId", "anam_avatar_id", "avatarId", "avatarID") or self.anam_avatar_id
        )
        agent_name = _string_override("avatarName", "agentDisplayName") or agent_name
        prompt_version = _string_override("promptVersion") or self.prompt_version
        prompt_updated_at = _string_override("promptUpdatedAt") or self.prompt_updated_at

        return AgentConfig(
            livekit_url=self.livekit_url,
            livekit_api_key=self.livekit_api_key,
            livekit_api_secret=self.livekit_api_secret,
            google_api_key=self.google_api_key,
            google_model=google_model,
            deepgram_api_key=self.deepgram_api_key,
            cartesia_api_key=self.cartesia_api_key,
            cartesia_voice_id=cartesia_voice_id,
            anam_api_key=self.anam_api_key,
            anam_avatar_id=anam_avatar_id,
            supabase_url=self.supabase_url,
            supabase_service_role_key=self.supabase_service_role_key,
            supabase_anon_key=self.supabase_anon_key,
            agent_name=agent_name,
            agent_identity_prefix=agent_identity_prefix,
            controller_identity_prefix=controller_identity_prefix,
            prompt_version=prompt_version,
            prompt_updated_at=prompt_updated_at,
        )

    def agent_identity(self, job_id: Optional[str]) -> str:
        suffix = job_id or secrets.token_hex(4)
        return f"{self.agent_identity_prefix}:{suffix}"

    def controller_identity(self, job_id: Optional[str]) -> str:
        suffix = job_id or secrets.token_hex(4)
        return f"{self.controller_identity_prefix}:{suffix}"

    def agent_metadata(self, agent_identity: str) -> Dict[str, Any]:
        return {
            "role": "agent",
            "agentIdentity": agent_identity,
            "agentName": self.agent_name,
            "agentType": "avatar",
            "avatarId": self.anam_avatar_id,
            "googleModel": self.google_model,
            "cartesiaVoiceId": self.cartesia_voice_id,
            "promptVersion": self.prompt_version,
            "promptUpdatedAt": self.prompt_updated_at,
        }


def _clean_str(value: Any) -> Optional[str]:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _extract_session_overrides(raw: Optional[str]) -> Dict[str, Any]:
    if not raw or not isinstance(raw, str):
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("[estate-buddy-agent] Unable to parse session metadata: %s", raw)
        return {}

    if not isinstance(data, dict):
        return {}

    overrides: Dict[str, Any] = {}
    for key in ("sessionOverrides", "agentConfig", "sessionConfig"):
        value = data.get(key)
        if isinstance(value, dict):
            overrides.update({k: v for k, v in value.items() if v is not None})

    if not overrides:
        filtered = {
            k: v
            for k, v in data.items()
            if k not in {"requestedBy", "requested_by"} and v is not None
        }
        overrides.update(filtered)

    return overrides


def build_agent_instructions(
    base_prompt: str, config: AgentConfig, session_overrides: Optional[Dict[str, Any]]
) -> str:
    prompt_body = (base_prompt or DEFAULT_PROMPT or "").strip()
    if not prompt_body:
        prompt_body = FALLBACK_PROMPT
    tool_section = TOOL_GUIDE.strip()
    if tool_section:
        normalized_body = "\n".join(line.strip().lower() for line in prompt_body.splitlines() if line.strip())
        normalized_tools = "\n".join(
            line.strip().lower() for line in tool_section.splitlines() if line.strip()
        )
        if normalized_tools not in normalized_body:
            prompt_body = f"{prompt_body.rstrip()}\n\n{tool_section}\n"
    meta_lines: List[str] = [
        f"[prompt_version::{config.prompt_version}]",
    ]
    if config.prompt_updated_at:
        meta_lines.append(f"[prompt_updated_at::{config.prompt_updated_at}]")
    if session_overrides:
        model_meta = _string_override("googleModel", "model", "openaiModel", "openaiRealtimeModel")
        voice_meta = _string_override("cartesiaVoiceId", "voice", "openaiVoice", "openaiRealtimeVoice")
        agent_name_meta = _string_override("agentName", "avatarName")
        for key, val in (("agentName", agent_name_meta), ("googleModel", model_meta), ("cartesiaVoiceId", voice_meta)):
            if val:
                meta_lines.append(f"[session::{key}::{val}]")
    metadata_header = "\n".join(meta_lines)
    return f"{metadata_header}\n{prompt_body}"


class EstateTools:
    def __init__(self, config: AgentConfig, room: RunCtxParam) -> None:
        self.config = config
        self.room = room
        self.unacked_overlays: set[str] = set()  # TODO: Phase 3 - replay if acks are missing on reconnect
        self.last_overlay_id: Optional[str] = None
        self.last_menu_overlay: Optional[Dict[str, Any]] = None
        self.last_detail_overlay: Optional[Dict[str, Any]] = None

    def register_ack(self, overlay_id: Optional[str]) -> None:
        if overlay_id:
            self.unacked_overlays.discard(overlay_id)

    async def _call_supabase_function(self, fn_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.supabase_service_role_key or self.config.supabase_anon_key}",
        }
        url = f"{self.config.supabase_url.rstrip('/')}/functions/v1/{fn_name}"
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, read=20.0)) as client:
            response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict):
            return data
        return {"data": data}

    async def _publish_overlay(self, kind: str, payload: Dict[str, Any]) -> None:
        if not self.room or not getattr(self.room, "local_participant", None):
            logger.debug("Room participant not ready; skipping overlay event %s", kind)
            return
        overlay_id = payload.get("overlayId") or f"ovr-{secrets.token_hex(4)}"
        payload["overlayId"] = overlay_id
        self.unacked_overlays.add(overlay_id)
        if kind.startswith("properties.menu"):
            self.last_menu_overlay = {"kind": kind, **payload}
        if kind.startswith("properties.detail"):
            self.last_detail_overlay = {"kind": kind, **payload}
        self.last_overlay_id = overlay_id
        message = json.dumps(
            {
                "type": "ui.overlay",
                "payload": {
                    "kind": kind,
                    **payload,
                },
            },
        ).encode("utf-8")
        await self.room.local_participant.publish_data(message, topic="ui.overlay", reliable=True)

    async def _publish_rpc(self, topic: str, payload: Dict[str, Any]) -> None:
        if not self.room or not getattr(self.room, "local_participant", None):
            return
        message = json.dumps({"type": topic, "payload": payload}).encode("utf-8")
        await self.room.local_participant.publish_data(message, topic=topic, reliable=True)

    @function_tool(
        name="list_properties",
        description="Search for available properties and update the visitor UI with menu cards.",
    )
    async def list_properties(
        self,
        query: Optional[str] = None,
        location: Optional[str] = None,
        max_budget: Optional[float] = None,
        bedrooms: Optional[int] = None,
        overlay_id: Optional[str] = None,
        context_property_id: Optional[str] = None,
    ) -> str:
        overlay_id = overlay_id or f"ovr-{secrets.token_hex(4)}"
        payload = {
            "query": query or "",
            "filters": {
                "location": location,
                "max_budget": max_budget,
                "bedrooms": bedrooms,
            },
            "context_property_id": context_property_id,
            "overlay_id": overlay_id,
        }
        result = await self._call_supabase_function("estate-db-query", payload)
        properties = result.get("properties") or result.get("results") or result.get("data") or []

        cards = []
        summaries = []
        for prop in properties:
            price_value = prop.get("base_price")
            if isinstance(price_value, str):
                try:
                    price_value = float(price_value)
                except ValueError:
                    price_value = None
            card = {
                "id": prop.get("id"),
                "name": prop.get("name"),
                "title": prop.get("name"),
                "subtitle": prop.get("location"),
                "location": prop.get("location"),
                "price": price_value,
                "amenities": prop.get("amenities", []),
                "highlights": prop.get("highlights"),
                "availability": prop.get("availability"),
                "hero_image": prop.get("hero_image"),
                "unit_types": prop.get("unit_types"),
            }
            cards.append(card)
            if isinstance(price_value, (int, float)):
                summaries.append(
                    f"{prop.get('name')} in {prop.get('location')} listed at ${price_value:,.0f}"
                )
            else:
                summaries.append(f"{prop.get('name')} in {prop.get('location')}")

        await self._publish_overlay(
            "properties.menu",
            {
                "items": cards,
                "query": query,
                "location": location,
                "maxBudget": max_budget,
                "filters": payload["filters"],
                "overlayId": overlay_id,
            },
        )
        await self._publish_rpc(
            "client.properties",
            {
                "action": "menu",
                "overlayId": overlay_id,
                "items": cards,
                "filters": payload["filters"],
                "query": query,
            },
        )

        if not summaries:
            return "No matching properties were found. Offer to adjust the budget or location."
        joined = "; ".join(summaries[:5])
        return (
            f"I found {len(cards)} option(s). Highlight a couple that fit the visitor and invite them to learn more. "
            f"Top matches: {joined}"
        )

    @function_tool(
        name="show_property_detail",
        description="Showcase a single property with detailed information in the visitor UI.",
    )
    async def show_property_detail(self, property_id: str, overlay_id: Optional[str] = None) -> str:
        if not property_id:
            return "Property detail not shown because no property_id was provided."
        overlay_id = overlay_id or f"ovr-{secrets.token_hex(4)}"
        result = await self._call_supabase_function(
            "estate-db-query", {"property_id": property_id, "include_faq": True, "overlay_id": overlay_id}
        )
        detail = result.get("property") or result.get("data") or {}
        faqs = result.get("faqs") or detail.get("faqs")
        if not detail:
            return "Unable to load that property right now."

        await self._publish_overlay("properties.detail", {"property": detail, "faqs": faqs, "overlayId": overlay_id})
        await self._publish_rpc(
            "client.properties",
            {
                "action": "detail",
                "overlayId": overlay_id,
                "item": detail,
                "faqs": faqs,
            },
        )
        highlights = detail.get("highlights") or ""
        price = detail.get("base_price")
        price_str = f" at ${price:,.0f}" if isinstance(price, (int, float)) else ""
        return f"Display the detailed view for {detail.get('name')}{price_str}. Mention the standout highlights: {highlights}"

    @function_tool(
        name="create_lead",
        description="Create a CRM lead for interested visitors. Requires a name and at least one contact method.",
    )
    async def create_lead(
        self,
        full_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        preferred_location: Optional[str] = None,
        property_type: Optional[str] = None,
        budget: Optional[float] = None,
        intent_level: Optional[str] = None,
        summary: Optional[str] = None,
        conversion_probability: Optional[float] = None,
        overlay_id: Optional[str] = None,
    ) -> str:
        if not full_name or (not email and not phone):
            return "Lead not created. Make sure you have a name plus phone or email before calling this tool."

        overlay_id = overlay_id or f"lead-{secrets.token_hex(4)}"
        payload = {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "preferred_location": preferred_location,
            "property_type": property_type,
            "budget": budget,
            "intent_level": intent_level.lower() if isinstance(intent_level, str) else intent_level,
            "conversion_probability": conversion_probability,
            "summary": summary,
        }
        payload = {key: value for key, value in payload.items() if value not in (None, "")}
        result = await self._call_supabase_function("estate-crm-create-lead", payload)
        lead_id = result.get("lead_id") or result.get("id")

        await self._publish_overlay(
            "leads.created",
            {
                "leadId": lead_id,
                "fullName": full_name,
                "email": email,
                "phone": phone,
                "preferredLocation": preferred_location,
                "propertyType": property_type,
                "overlayId": overlay_id,
            },
        )
        await self._publish_rpc(
            "client.leads",
            {
                "action": "created",
                "overlayId": overlay_id,
                "leadId": lead_id,
                "fullName": full_name,
                "email": email,
                "phone": phone,
            },
        )
        return (
            f"Lead created successfully for {full_name}. Confirm the visitor that we will follow up soon and offer a tour."
        )

    @function_tool(
        name="log_activity",
        description="Attach a note to the most recent lead. Use for follow-up actions or visitor preferences.",
    )
    async def log_activity(
        self,
        lead_id: Optional[str],
        message: str,
        activity_type: str = "note",
        due_at: Optional[str] = None,
        overlay_id: Optional[str] = None,
    ) -> str:
        overlay_id = overlay_id or f"lead-{secrets.token_hex(4)}"
        payload = {
            "lead_id": lead_id,
            "type": (activity_type or "note").lower(),
            "message": message,
            "due_at": due_at,
        }
        payload = {key: value for key, value in payload.items() if value not in (None, "")}
        await self._call_supabase_function("estate-crm-log-activity", payload)
        await self._publish_overlay(
            "leads.activity",
            {
                "leadId": lead_id,
                "message": message,
                "type": activity_type,
                "dueAt": due_at,
                "overlayId": overlay_id,
            },
        )
        await self._publish_rpc(
            "client.leads",
            {
                "action": "activity",
                "leadId": lead_id,
                "message": message,
                "type": activity_type,
                "overlayId": overlay_id,
            },
        )
        return "Activity captured. Let the visitor know their preference is on file."

    @function_tool(
        name="show_directions",
        description="Share driving or pickup directions with the visitor. Provide one or more labeled locations.",
    )
    async def show_directions(
        self,
        locations: Optional[List[Dict[str, Any]]] = None,
        notes: Optional[str] = None,
        overlay_id: Optional[str] = None,
    ) -> str:
        overlay_id = overlay_id or f"dir-{secrets.token_hex(4)}"
        clean_locations = locations or []
        await self._publish_overlay(
            "directions.show",
            {
                "overlayId": overlay_id,
                "locations": clean_locations,
                "notes": notes,
            },
        )
        await self._publish_rpc(
            "client.directions",
            {
                "action": "show",
                "overlayId": overlay_id,
                "locations": clean_locations,
                "notes": notes,
            },
        )
        return "Shared directions with the visitor and updated the overlay."


async def entrypoint(ctx: JobContext) -> None:
    base_config = AgentConfig.from_env()
    raw_metadata = None
    try:
        raw_metadata = getattr(ctx.job, "metadata", None)
    except AttributeError:
        raw_metadata = None

    session_overrides = _extract_session_overrides(raw_metadata)
    if session_overrides:
        logger.info("Session overrides received: %s", session_overrides)

    config = base_config.with_session_overrides(session_overrides)

    job_id = ctx.job.id if ctx.job else None
    agent_identity = _clean_str(session_overrides.get("agentIdentity")) or config.agent_identity(job_id)
    controller_identity = (
        _clean_str(session_overrides.get("agentControllerIdentity")) or config.controller_identity(job_id)
    )
    visitor_name = _clean_str(session_overrides.get("visitorName"))
    system_prompt_override = _clean_str(
        session_overrides.get("assistantPrompt")
        or session_overrides.get("systemPrompt")
        or session_overrides.get("prompt")
    )

    transcript_segments: list[str] = []
    estate_tools: Optional[EstateTools] = None  # will be assigned after room connects
    summary_sent = False

    async def _submit_conversation_summary() -> None:
        nonlocal summary_sent
        if summary_sent:
            return
        transcript_text = "\n".join(segment for segment in transcript_segments if segment).strip()
        if not transcript_text:
            return
        if estate_tools is None:
            return
        try:
            await estate_tools._call_supabase_function(
                "conversation-summary",
                {
                    "transcript": transcript_text,
                },
            )
            logger.info(
                "Conversation transcript forwarded to summary service (%d characters)",
                len(transcript_text),
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to submit conversation summary: %s", exc)
        finally:
            summary_sent = True

    logger.info(
        "Connecting to LiveKit (%s) as controller %s for agent %s",
        config.livekit_url,
        controller_identity,
        agent_identity,
    )
    await ctx.connect()
    await ctx.wait_for_participant()
    logger.info("Participant joined. Starting avatar session as %s", agent_identity)

    stt = deepgram.STT(model="nova-3", api_key=config.deepgram_api_key)
    vad = silero.VAD.load()
    llm = google.LLM(
        model=config.google_model,
        api_key=config.google_api_key,
    )
    tts = cartesia.TTS(
        model="sonic-3",
        voice=config.cartesia_voice_id,
        api_key=config.cartesia_api_key,
    )

    session = AgentSession(
        stt=stt,
        vad=vad,
        llm=llm,
        tts=tts,
    )

    avatar_session = anam_avatar.AvatarSession(
        persona_config=anam_avatar.PersonaConfig(
            name=config.agent_name,
            avatarId=config.anam_avatar_id or None,
        ),
        api_key=config.anam_api_key,
        avatar_participant_name=config.agent_name,
        avatar_participant_identity=agent_identity,
    )
    try:
        logger.info(
            "Starting Anam avatar session (avatar_id=%s, agent_identity=%s)",
            config.anam_avatar_id or "<default>",
            agent_identity,
        )
        await avatar_session.start(session, room=ctx.room)
        logger.info("Anam avatar session started successfully")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to start Anam avatar session: %s", exc)
        raise

    estate_tools = EstateTools(config, ctx.room)

    @ctx.room.on("text_received")
    def _on_text_received(*args, **kwargs):  # noqa: ANN001
        try:
            if "data" in kwargs:
                data = kwargs["data"]
                topic = kwargs.get("topic")
            elif len(args) >= 2:
                data = args[1]
                topic = args[2] if len(args) >= 3 else kwargs.get("topic")
            else:
                return
            message = getattr(data, "message", data)
            if isinstance(message, (bytes, bytearray)):
                message = message.decode("utf-8", errors="ignore")
            if not isinstance(message, str):
                message = str(message)
            attributes = getattr(data, "attributes", {}) or {}
            topic_name = topic or getattr(data, "topic", None)
            if topic_name != "lk.transcription":
                return
            final_flag = attributes.get("lk.transcription_final")
            if final_flag in {"false", "0", False}:
                return
            trimmed = message.strip()
            if trimmed:
                transcript_segments.append(trimmed)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to capture transcription payload: %s", exc)

    @ctx.room.on("data_received")
    def _on_data_received(payload, participant, kind, topic):  # noqa: ANN001
        if estate_tools is None:
            return
        try:
            decoded = payload.decode("utf-8")
            message = json.loads(decoded)
        except Exception:  # noqa: BLE001
            logger.debug("Failed to decode data payload from %s", getattr(participant, "identity", "unknown"))
            return

        event_type = message.get("type") or topic or ""
        data = message.get("payload") or {}
        overlay_id = data.get("overlayId") if isinstance(data, dict) else None

        if event_type == "agent.overlayAck":
            estate_tools.register_ack(overlay_id)
            return

        async def _handle() -> None:
            if event_type == "visitor.selectProperty":
                property_id = data.get("propertyId") if isinstance(data, dict) else None
                if property_id:
                    await estate_tools.show_property_detail(str(property_id), overlay_id=overlay_id)
            elif event_type == "visitor.requestTour":
                await estate_tools.log_activity(
                    lead_id=data.get("leadId") if isinstance(data, dict) else None,
                    message="Visitor requested a tour",
                    activity_type="tour",
                    overlay_id=overlay_id,
                )
            elif event_type == "visitor.requestBrochure":
                await estate_tools.log_activity(
                    lead_id=data.get("leadId") if isinstance(data, dict) else None,
                    message="Visitor requested a brochure",
                    activity_type="brochure",
                    overlay_id=overlay_id,
                )
            elif event_type == "visitor.shareContact":
                payload_data = data if isinstance(data, dict) else {}
                full_name = payload_data.get("fullName")
                phone = payload_data.get("phone")
                email = payload_data.get("email")
                if full_name and (phone or email):
                    await estate_tools.create_lead(
                        full_name=full_name,
                        phone=phone,
                        email=email,
                        summary="Visitor shared contact details from overlay CTA",
                        overlay_id=overlay_id,
                    )
                else:
                    await estate_tools.log_activity(
                        lead_id=payload_data.get("leadId"),
                        message="Visitor attempted to share contact without full details",
                        activity_type="note",
                        overlay_id=overlay_id,
                    )

        asyncio.create_task(_handle())

    @ctx.room.on("participant_disconnected")
    def _on_participant_disconnected(participant):  # noqa: ANN001
        identity = getattr(participant, "identity", "") or ""
        if identity.startswith("Visitor"):
            asyncio.create_task(_submit_conversation_summary())

    @ctx.room.on("disconnected")
    def _on_room_closed(_reason):  # noqa: ANN001
        asyncio.create_task(_submit_conversation_summary())

    instructions_source = system_prompt_override or DEFAULT_PROMPT or FALLBACK_PROMPT
    instructions = build_agent_instructions(instructions_source, config, session_overrides)
    session_context = {
        "visitorName": visitor_name,
        "linkConfig": session_overrides,
        "room": getattr(ctx.room, "name", None),
    }
    instructions = f"{instructions}\n\n[SESSION_CONTEXT]\n{json.dumps(session_context, default=str)}\n"

    logger.info(
        "Configured session with gemini=%s cartesia_voice=%s avatar=%s",
        config.google_model,
        config.cartesia_voice_id,
        config.anam_avatar_id or "<default>",
    )

    try:
        agent = Agent(
            instructions=instructions,
            tools=[
                estate_tools.list_properties,
                estate_tools.show_property_detail,
                estate_tools.create_lead,
                estate_tools.log_activity,
                estate_tools.show_directions,
            ],
        )

        await session.start(
            agent=agent,
            room=ctx.room,
            room_input_options=RoomInputOptions(audio_enabled=True, video_enabled=False, close_on_disconnect=False),
        )
        logger.info("Agent session started; awaiting realtime events")

        @ctx.room.on("track_subscribed")
        def _on_track_subscribed(track, publication, participant):  # noqa: ANN001
            logger.info(
                "Track subscribed: participant=%s track_sid=%s kind=%s source=%s",
                getattr(participant, "identity", "<unknown>"),
                getattr(publication, "track_sid", None),
                getattr(track, "kind", None),
                getattr(publication, "source", None),
            )

        opening_prompt = (
            "Greet the visitor to Estate Buddy, ask what they are looking for, and offer to recommend properties."
        )
        if visitor_name:
            opening_prompt = (
                f"Greet {visitor_name} and welcome them to Estate Buddy. Ask what they are looking for and offer to recommend properties."
            )

        await session.generate_reply(instructions=opening_prompt)
    finally:
        await _submit_conversation_summary()


async def request_fnc(req: JobRequest) -> None:
    base_config = AgentConfig.from_env()
    raw_metadata = getattr(req, "metadata", None)
    session_overrides = _extract_session_overrides(raw_metadata)
    if session_overrides:
        logger.info("Dispatch overrides received: %s", session_overrides)
    config = base_config.with_session_overrides(session_overrides)

    agent_identity = _clean_str(session_overrides.get("agentIdentity")) or config.agent_identity(req.id)
    controller_identity = (
        _clean_str(session_overrides.get("agentControllerIdentity")) or config.controller_identity(req.id)
    )

    metadata_payload = config.agent_metadata(agent_identity)
    if session_overrides:
        metadata_payload["sessionOverrides"] = session_overrides

    attributes = {
        "agentIdentity": agent_identity,
        "agentControllerIdentity": controller_identity,
        "agentName": config.agent_name,
    }
    if session_overrides:
        attributes["sessionOverrides"] = json.dumps(session_overrides)

    display_name = _clean_str(session_overrides.get("agentName")) or config.agent_name

    await req.accept(
        name=display_name,
        identity=controller_identity,
        metadata=json.dumps(metadata_payload),
        attributes=attributes,
    )
    logger.info(
        "Accepted LiveKit dispatch for room '%s' (job=%s, agent=%s)",
        getattr(req.room, "name", "<unknown>"),
        req.id,
        agent_identity,
    )


def main() -> None:
    config = AgentConfig.from_env()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            request_fnc=request_fnc,
            agent_name=config.agent_name,
        )
    )


if __name__ == "__main__":
    main()
