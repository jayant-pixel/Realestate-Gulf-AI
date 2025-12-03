import { AgentDispatchClient } from "npm:livekit-server-sdk@2.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const roomName = String((body?.room ?? "") || "").trim();
    if (!roomName) {
      return json(400, { error: "Room name is required" });
    }

    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const agentName =
      Deno.env.get("AGENT_NAME") ??
      Deno.env.get("NEXT_PUBLIC_AGENT_NAME") ??
      "estate-agent";

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error("[livekit-stop-agent] Missing LiveKit credentials");
      return json(500, { error: "LiveKit configuration is missing" });
    }

    const dispatchClient = new AgentDispatchClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );

    const dispatches = await dispatchClient
      .listDispatch(roomName)
      .catch((error) => {
        console.warn("[livekit-stop-agent] listDispatch failed", error);
        return [];
      });

    const active = dispatches.filter(
      (dispatch) =>
        dispatch.agentName === agentName &&
        ((typeof dispatch.state?.deletedAt === "number" &&
          dispatch.state?.deletedAt === 0) ||
          dispatch.state?.deletedAt === undefined),
    );

    for (const dispatch of active) {
      await dispatchClient.deleteDispatch(dispatch.id).catch((error) => {
        console.warn("[livekit-stop-agent] deleteDispatch failed", error);
      });
    }

    return json(200, { success: true, closed: active.length });
  } catch (error) {
    console.error("[livekit-stop-agent] Error stopping agent", error);
    return json(500, {
      error: "Failed to stop agent",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
