"""
Outbound Caller Agent
---------------------
LiveKit Phone-only agent that handles outbound calls triggered from form submissions.
Reuses Supabase-backed tools (lead creation, activity logging, stage updates).
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

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

logger = logging.getLogger("outbound-caller-agent")
logger.setLevel(logging.INFO)
load_dotenv(dotenv_path=Path(__file__).resolve().with_name("secreat.env"))

OUTBOUND_PROMPT = """
You are the outbound concierge for Realestate Gulf AI. You call leads who submitted a form.

Context (if provided): {{SESSION_CONTEXT}}

Rules:
- Phone only. No UI overlays. Keep responses concise (1–2 sentences).
- Introduce yourself, confirm you're calling about their property interest, and verify their name.
- Confirm or gather: budget, preferred location, move-in timeline, property type, contact preference.
- Summarize what you heard and propose a next step (tour, brochure, follow-up time).
- If uninterested or wrong number, apologize and end politely.
- If no answer/voicemail, leave a short message and log the attempt.
- Never promise discounts. Do not repeat sensitive data more than needed.

Flow:
1) Greet and confirm identity.
2) Reiterate their interest and ask 1–2 qualifying questions.
3) Confirm or capture phone/email if missing.
4) Log intent level and next action.
5) Summarize and close.
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
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    agent_name: str = "Outbound Concierge"
    agent_identity_prefix: str = "outbound-agent"

    @classmethod
    def from_env(cls) -> "AgentConfig":
        return cls(
            livekit_url=os.getenv("LIVEKIT_URL", ""),
            livekit_api_key=os.getenv("LIVEKIT_API_KEY", ""),
            livekit_api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            google_model=os.getenv("GOOGLE_MODEL", "gemini-2.0-flash-exp"),
            deepgram_api_key=os.getenv("DEEPGRAM_API_KEY", ""),
            cartesia_api_key=os.getenv("CARTESIA_API_KEY", ""),
            cartesia_voice_id=os.getenv("CARTESIA_VOICE_ID", "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30"),
            supabase_url=os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            supabase_anon_key=os.getenv("SUPABASE_ANON_KEY") or "",
            agent_name=os.getenv("AGENT_NAME", "Outbound Concierge"),
            agent_identity_prefix=os.getenv("AGENT_IDENTITY_PREFIX", "outbound-agent"),
        )

    def agent_identity(self, job_id: Optional[str]) -> str:
        return f"{self.agent_identity_prefix}:{job_id or secrets.token_hex(4)}"

    def agent_metadata(self, agent_identity: str) -> Dict[str, Any]:
        return {
            "role": "agent",
            "agentIdentity": agent_identity,
            "agentName": self.agent_name,
            "agentType": "phone",
            "googleModel": self.google_model,
            "cartesiaVoiceId": self.cartesia_voice_id,
        }


class OutboundTools:
    def __init__(self, config: AgentConfig, room: Optional[RunContext]):
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
        return data if isinstance(data, dict) else {"data": data}

    @function_tool(
        name="create_lead",
        description="Create or update a lead with contact details and preferences.",
    )
    async def create_lead(
        self,
        full_name: str,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        preferred_location: Optional[str] = None,
        property_type: Optional[str] = None,
        budget: Optional[float] = None,
        intent_level: Optional[str] = None,
        summary: Optional[str] = None,
    ) -> str:
        payload = {
            "full_name": full_name,
            "phone": phone,
            "email": email,
            "preferred_location": preferred_location,
            "property_type": property_type,
            "budget": budget,
            "intent_level": intent_level,
            "summary": summary,
        }
        await self._call_supabase_function("estate-crm-create-lead", payload)
        return "Lead created or updated."

    @function_tool(
        name="log_activity",
        description="Log a call note or follow-up task for a lead.",
    )
    async def log_activity(
        self,
        lead_id: Optional[str],
        message: str,
        activity_type: str = "call",
        due_at: Optional[str] = None,
    ) -> str:
        payload = {
            "lead_id": lead_id,
            "message": message,
            "activity_type": activity_type,
            "due_at": due_at,
        }
        await self._call_supabase_function("estate-crm-log-activity", payload)
        return "Activity logged."

    @function_tool(
        name="update_stage",
        description="Update a lead pipeline stage with optional reason.",
    )
    async def update_stage(
        self,
        lead_id: str,
        stage: str,
        note: Optional[str] = None,
    ) -> str:
        url = f"{self.config.supabase_url.rstrip('/')}/rest/v1/leads"
        headers = {
            "apikey": self.config.supabase_service_role_key or self.config.supabase_anon_key,
            "Authorization": f"Bearer {self.config.supabase_service_role_key or self.config.supabase_anon_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.patch(
                url,
                params={"id": f"eq.{lead_id}"},
                json={"stage": stage.lower()},
                headers=headers,
            )
        resp.raise_for_status()
        if note:
            await self.log_activity(lead_id=lead_id, message=note, activity_type="note")
        return f"Stage updated to {stage}"


async def entrypoint(ctx: JobContext) -> None:
    config = AgentConfig.from_env()
    raw_metadata = getattr(ctx.job, "metadata", None)
    session_overrides: Dict[str, Any] = {}
    if raw_metadata:
        try:
            session_overrides = json.loads(raw_metadata) if isinstance(raw_metadata, str) else raw_metadata
        except Exception:
            logger.warning("Failed to parse job metadata: %s", raw_metadata)
            session_overrides = {}

    agent_identity = config.agent_identity(ctx.job.id if ctx.job else None)

    logger.info("Connecting outbound caller as %s", agent_identity)
    await ctx.connect()
    await ctx.wait_for_participant()

    stt = deepgram.STT(model="nova-3", api_key=config.deepgram_api_key)
    vad = silero.VAD.load()
    llm = google.LLM(model=config.google_model, api_key=config.google_api_key)
    tts = cartesia.TTS(model="sonic-3", voice=config.cartesia_voice_id, api_key=config.cartesia_api_key)

    session = AgentSession(
        stt=stt,
        vad=vad,
        llm=llm,
        tts=tts,
    )

    tools = OutboundTools(config, ctx.room)
    session_context = {
        "lead_id": session_overrides.get("lead_id"),
        "submission_id": session_overrides.get("submission_id"),
        "form_id": session_overrides.get("form_id"),
        "phone": session_overrides.get("phone"),
        "name": session_overrides.get("name") or session_overrides.get("full_name"),
        "email": session_overrides.get("email"),
        "budget": session_overrides.get("budget"),
        "location": session_overrides.get("location"),
        "notes": session_overrides.get("notes"),
    }
    instructions = f"{OUTBOUND_PROMPT}\n\n[SESSION_CONTEXT]\n{json.dumps(session_context)}"

    # Add metadata into logs for tracing
    ctx.log_context_fields = {
        "lead_id": session_context.get("lead_id"),
        "submission_id": session_context.get("submission_id"),
        "form_id": session_context.get("form_id"),
        "phone": session_context.get("phone"),
        "room": getattr(ctx.room, "name", None),
    }

    agent = Agent(
        instructions=instructions,
        tools=[
            tools.create_lead,
            tools.log_activity,
            tools.update_stage,
        ],
    )

    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(audio_enabled=True, video_enabled=False),
    )


async def request_fnc(req: JobRequest) -> None:
    config = AgentConfig.from_env()
    metadata_payload = config.agent_metadata(config.agent_identity(req.id))
    await req.accept(
        name=config.agent_name,
        identity=config.agent_identity(req.id),
        metadata=json.dumps(metadata_payload),
    )


def main() -> None:
    cfg = AgentConfig.from_env()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            worker_type=WorkerType.ROOM,
            request_fnc=request_fnc,
            agent_name=cfg.agent_name,
        )
    )


if __name__ == "__main__":
    main()
