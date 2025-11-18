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
from pathlib import Path
from typing import Any, Dict, Optional, TYPE_CHECKING

import httpx
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobRequest,
    RoomOutputOptions,
    RunContext,
    WorkerOptions,
    WorkerType,
    cli,
)
from livekit.agents.llm import function_tool
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import openai
from livekit.plugins.anam import avatar as anam_avatar
from openai.types.beta.realtime.session import TurnDetection

if TYPE_CHECKING:
    RunCtxParam = Optional[RunContext]
else:
    RunCtxParam = Optional[Any]

load_dotenv(dotenv_path=Path(__file__).resolve().with_name("secreat.env"))

logger = logging.getLogger("estate-buddy-agent")
logger.setLevel(logging.INFO)

DEFAULT_PROMPT = os.getenv("ESTATE_AGENT_PROMPT", "").strip()
FALLBACK_PROMPT = """# Role
You are Estate Buddy, the always-on concierge for Gulf Estate AI. Greet every visitor, learn their goals, surface matching properties, and guide them toward a clear next action such as scheduling a tour or requesting a follow-up.

# Persona
- Speak like a confident, helpful property consultant.
- Reference concrete facts about price, availability, amenities, and timelines.
- Keep responses focused, acknowledge what the visitor said, and invite follow-up questions.

# Flow
1. Welcome and confirm the visitor name when known.
2. Ask about budget, location preferences, property type, move-in timing, and must-have features.
3. Call `list_properties` before describing options so the carousel matches the conversation.
4. When the visitor prefers a listing, call `show_property_detail` and narrate the highlights you see.
5. After confirming their name plus phone or email, call `create_lead` and reassure them about follow-up.
6. Use `log_activity` for promised brochures, tours, or custom requirements so the CRM stays current.
7. Summarize next steps, thank the visitor, and stay available for final questions.

# Tool Guidance
- `list_properties`: Run after discovery questions or whenever the visitor asks for options. Include filters such as location, max budget, or bedrooms when available.
- `show_property_detail`: Trigger once the visitor focuses on a specific listing and invite their feedback.
- `create_lead`: Use only after confirming the visitor's name and a contact method.
- `log_activity`: Record promised actions (brochures, tours, follow-ups) so the sales team stays aligned.

# Guardrails
- Never invent data; if unsure, promise to verify with the sales team.
- Avoid guarantees about pricing or discounts; stay factual and balanced.
- Ask the visitor to repeat themselves when audio is unclear.
- Keep the UI synchronized with the conversation by refreshing property lists when preferences change.
"""

TOOL_GUIDE = r"""
# Available Tools
- `list_properties(query, location, max_budget, bedrooms)`: Search Supabase for matching listings and update the visitor UI with property cards.
- `show_property_detail(property_id)`: Pull expanded information for a specific property and highlight it in the UI.
- `create_lead(full_name, email, phone, preferred_location, property_type, budget, intent_level, summary)`: Capture the visitor's contact details and create a CRM record for follow up.
- `log_activity(lead_id, message, activity_type, due_at)`: Append internal notes or follow-up tasks tied to the most recent lead.
"""


@dataclass
class AgentConfig:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    openai_api_key: str
    anam_api_key: str
    anam_avatar_id: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    agent_name: str = "Estate Buddy"
    agent_identity_prefix: str = "estate-agent"
    controller_identity_prefix: str = "estate-controller"
    openai_realtime_model: str = ""
    openai_realtime_voice: str = ""

    @classmethod
    def from_env(cls) -> "AgentConfig":
        livekit_url = os.getenv("LIVEKIT_URL")
        livekit_api_key = os.getenv("LIVEKIT_API_KEY")
        livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")
        openai_api_key = os.getenv("OPENAI_API_KEY")
        anam_api_key = os.getenv("ANAM_API_KEY")
        supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")

        missing = [
            name
            for name, value in [
                ("LIVEKIT_URL", livekit_url),
                ("LIVEKIT_API_KEY", livekit_api_key),
                ("LIVEKIT_API_SECRET", livekit_api_secret),
                ("OPENAI_API_KEY", openai_api_key),
                ("ANAM_API_KEY", anam_api_key),
                ("SUPABASE_URL", supabase_url),
            ]
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

        default_model_env = os.getenv("OPENAI_REALTIME_MODEL")
        default_model = (default_model_env.strip() if default_model_env else "") or "gpt-realtime-2025-08-28"

        default_voice_env = os.getenv("OPENAI_REALTIME_VOICE")
        default_voice = (default_voice_env.strip() if default_voice_env else "") or "alloy"

        return cls(
            livekit_url=livekit_url,
            livekit_api_key=livekit_api_key,
            livekit_api_secret=livekit_api_secret,
            openai_api_key=openai_api_key,
            anam_api_key=anam_api_key,
            anam_avatar_id=os.getenv("ANAM_AVATAR_ID", ""),
            supabase_url=supabase_url,
            supabase_service_role_key=supabase_service_role_key,
            supabase_anon_key=supabase_anon_key,
            agent_name=os.getenv("AGENT_NAME", "Estate Buddy"),
            agent_identity_prefix=os.getenv("AGENT_IDENTITY_PREFIX", "estate-agent"),
            controller_identity_prefix=os.getenv("CONTROLLER_IDENTITY_PREFIX", "estate-controller"),
            openai_realtime_model=default_model,
            openai_realtime_voice=default_voice,
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
        model_override = _string_override("openaiRealtimeModel", "openaiModel", "model")
        openai_realtime_model = model_override or self.openai_realtime_model

        voice_override = _string_override("openaiVoice", "openaiRealtimeVoice", "voice")
        openai_realtime_voice = voice_override or self.openai_realtime_voice

        anam_avatar_id = (
            _string_override("anamAvatarId", "anam_avatar_id", "avatarId", "avatarID") or self.anam_avatar_id
        )
        agent_name = _string_override("avatarName", "agentDisplayName") or agent_name

        return AgentConfig(
            livekit_url=self.livekit_url,
            livekit_api_key=self.livekit_api_key,
            livekit_api_secret=self.livekit_api_secret,
            openai_api_key=self.openai_api_key,
            anam_api_key=self.anam_api_key,
            anam_avatar_id=anam_avatar_id,
            supabase_url=self.supabase_url,
            supabase_service_role_key=self.supabase_service_role_key,
            supabase_anon_key=self.supabase_anon_key,
            agent_name=agent_name,
            agent_identity_prefix=agent_identity_prefix,
            controller_identity_prefix=controller_identity_prefix,
            openai_realtime_model=openai_realtime_model,
            openai_realtime_voice=openai_realtime_voice,
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
            "openaiModel": self.openai_realtime_model,
            "openaiVoice": self.openai_realtime_voice,
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


def build_agent_instructions(base_prompt: str) -> str:
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
    return prompt_body


class EstateTools:
    def __init__(self, config: AgentConfig, room: RunCtxParam) -> None:
        self.config = config
        self.room = room

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
    ) -> str:
        payload = {
            "query": query or "",
            "filters": {
                "location": location,
                "max_budget": max_budget,
                "bedrooms": bedrooms,
            },
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
                "title": prop.get("name"),
                "subtitle": prop.get("location"),
                "price": price_value,
                "amenities": prop.get("amenities", []),
                "highlights": prop.get("highlights"),
                "availability": prop.get("availability"),
                "media": prop.get("hero_image"),
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
    async def show_property_detail(self, property_id: str) -> str:
        if not property_id:
            return "Property detail not shown because no property_id was provided."
        result = await self._call_supabase_function(
            "estate-db-query", {"property_id": property_id, "include_faq": True}
        )
        detail = result.get("property") or result.get("data") or {}
        if not detail:
            return "Unable to load that property right now."

        await self._publish_overlay("properties.detail", {"property": detail})
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
    ) -> str:
        if not full_name or (not email and not phone):
            return "Lead not created. Make sure you have a name plus phone or email before calling this tool."

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
    ) -> str:
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
            },
        )
        return "Activity captured. Let the visitor know their preference is on file."


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

    llm = openai.realtime.RealtimeModel(
        api_key=config.openai_api_key,
        model=config.openai_realtime_model,
        voice=config.openai_realtime_voice,
        temperature=0.7,
        modalities=["text", "audio"],
        turn_detection=TurnDetection(
            type="server_vad",
            threshold=0.5,
            prefix_padding_ms=400,
            silence_duration_ms=400,
            create_response=True,
            interrupt_response=True,
        ),
    )

    session = AgentSession(
        llm=llm,
        resume_false_interruption=False,
        use_tts_aligned_transcript=True,
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

    @ctx.room.on("participant_disconnected")
    def _on_participant_disconnected(participant):  # noqa: ANN001
        identity = getattr(participant, "identity", "") or ""
        if identity.startswith("Visitor"):
            asyncio.create_task(_submit_conversation_summary())

    @ctx.room.on("disconnected")
    def _on_room_closed(_reason):  # noqa: ANN001
        asyncio.create_task(_submit_conversation_summary())

    instructions_source = system_prompt_override or DEFAULT_PROMPT or FALLBACK_PROMPT
    instructions = build_agent_instructions(instructions_source)

    logger.info(
        "Configured realtime session with model=%s voice=%s avatar=%s",
        config.openai_realtime_model,
        config.openai_realtime_voice,
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
            ],
        )

        await session.start(
            agent=agent,
            room=ctx.room,
            room_input_options=RoomInputOptions(video_enabled=False, close_on_disconnect=False),
            room_output_options=RoomOutputOptions(audio_enabled=True),
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
