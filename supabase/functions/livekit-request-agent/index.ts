import {
  AgentDispatchClient,
  RoomServiceClient,
} from "npm:livekit-server-sdk@2.14.0";

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

async function ensureRoomExists(
  client: RoomServiceClient,
  roomName: string,
): Promise<void> {
  try {
    const rooms = await client.listRooms([roomName]);
    if (rooms.some((room) => room.name === roomName)) {
      return;
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && code !== "not_found") {
      throw error;
    }
  }

  try {
    await client.createRoom({ name: roomName });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && code !== "already_exists") {
      throw error;
    }
  }
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

    const rawAgentConfig = body?.agentConfig;
    const agentConfig =
      rawAgentConfig && typeof rawAgentConfig === "object" && !Array.isArray(rawAgentConfig)
        ? Object.fromEntries(
            Object.entries(rawAgentConfig as Record<string, unknown>).filter(
              ([, value]) => value !== undefined && value !== null && value !== "",
            ),
          )
        : undefined;

    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error("[livekit-request-agent] Missing LiveKit credentials");
      return json(500, { error: "LiveKit configuration is missing" });
    }

    const agentName =
      Deno.env.get("AGENT_NAME") ?? Deno.env.get("NEXT_PUBLIC_AGENT_NAME") ??
      "estate-agent";

    const agentDispatchClient = new AgentDispatchClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );
    const roomServiceClient = new RoomServiceClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    );

    await ensureRoomExists(roomServiceClient, roomName);

    const existing = await agentDispatchClient
      .listDispatch(roomName)
      .then((dispatches) => {
        return dispatches.find((dispatch) => {
          if (dispatch.agentName !== agentName) return false;
          const deletedAt = dispatch.state?.deletedAt;
          if (deletedAt === undefined) return true;
          if (typeof deletedAt === "bigint") {
            return Number(deletedAt) === 0;
          }
          return deletedAt === 0;
        });
      })
      .catch((error) => {
        console.warn(
          "[livekit-request-agent] Failed to list dispatches",
          error,
        );
        return undefined;
      });

    if (!existing) {
      const metadataPayload: Record<string, unknown> = {
        requestedBy: "estate-public-avatar",
      };
      if (agentConfig) {
        metadataPayload.agentConfig = agentConfig;
      }

      await agentDispatchClient.createDispatch(roomName, agentName, {
        metadata: JSON.stringify(metadataPayload),
      });
    }

    return json(200, {
      success: true,
      ...(agentConfig ? { agentConfig } : {}),
    });
  } catch (error) {
    console.error("[livekit-request-agent] Error requesting agent", error);
    return json(500, {
      error: "Failed to request LiveKit agent",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
