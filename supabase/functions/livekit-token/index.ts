import { AccessToken, VideoGrant } from "npm:livekit-server-sdk@2.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

  try {
    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error("[livekit-token] Missing LiveKit credentials");
      return json(500, { error: "Missing LiveKit credentials" });
    }

    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    let requestBody: Record<string, unknown> = {};

    if (method === "POST") {
      requestBody = await req.json();
    }

    const roomName =
      (requestBody.room as string | undefined) ??
      url.searchParams.get("room") ??
      "estate-buddy";
    const participantName =
      (requestBody.participant as string | undefined) ??
      url.searchParams.get("participant") ??
      "guest";
    const rawMetadata =
      requestBody.metadata ?? url.searchParams.get("metadata") ?? "";
    const metadata =
      typeof rawMetadata === "string"
        ? rawMetadata
        : JSON.stringify(rawMetadata ?? {});
    const ttl = (requestBody.ttl as string | undefined) ?? "5m";
    const region =
      (requestBody.region as string | undefined) ??
      url.searchParams.get("region") ??
      undefined;

    const randomSuffix = crypto.randomUUID().split("-")[0];
    const identity = `${participantName}-${randomSuffix}`;

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: participantName,
      metadata,
    });
    token.ttl = ttl;

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    if (region) {
      grant.region = region;
    }

    token.addGrant(grant);

    const jwt = await token.toJwt();

    return json(200, {
      token: jwt,
      serverUrl: LIVEKIT_URL,
      room: roomName,
      identity,
    });
  } catch (error) {
    console.error("[livekit-token] Error generating token", error);
    return json(500, {
      error: "Failed to mint LiveKit token",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
