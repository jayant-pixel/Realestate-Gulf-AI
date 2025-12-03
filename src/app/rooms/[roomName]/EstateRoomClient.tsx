'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, type LocalUserChoices } from '@livekit/components-react';
import { Room, type RoomConnectOptions, type RoomOptions } from 'livekit-client';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { AIAvatar, PublicLink } from '@/types/db';

import EstateVideoConference from './EstateVideoConference';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_TOKEN = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FALLBACK_ROOM = 'estate-buddy';

interface EstateRoomClientProps {
  roomName: string;
  slug?: string;
}

interface ConnectionDetails {
  token: string;
  serverUrl: string;
  identity: string;
  room: string;
}

export default function EstateRoomClient({ roomName, slug }: EstateRoomClientProps) {
  const router = useRouter();
  const resolvedRoom = roomName?.trim().length ? roomName.trim() : FALLBACK_ROOM;

  const [link, setLink] = useState<PublicLink | null>(null);
  const [avatar, setAvatar] = useState<AIAvatar | null>(null);
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | null>(null);
  const [userChoices, setUserChoices] = useState<LocalUserChoices | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stopAgent = useCallback(async () => {
    if (!SUPABASE_URL) return;
    try {
      const headers = buildSupabaseHeaders();
      await fetch(`${SUPABASE_URL}/functions/v1/livekit-stop-agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ room: resolvedRoom }),
      });
    } catch (err) {
      console.warn('[EstateRoomClient] Unable to stop agent', err);
    }
  }, [SUPABASE_URL, buildSupabaseHeaders, resolvedRoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = slug ? `estate-visitor:${slug}` : `estate-visitor:${resolvedRoom}`;
    try {
      const existing = window.sessionStorage.getItem(key);
      if (existing) {
        setVisitorName(existing);
        return;
      }
      const alias = createVisitorAlias();
      window.sessionStorage.setItem(key, alias);
      setVisitorName(alias);
    } catch (err) {
      console.warn('[EstateRoomClient] Unable to persist visitor alias', err);
      setVisitorName((prev) => prev || createVisitorAlias());
    }
  }, [resolvedRoom, slug]);

  const buildSupabaseHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SUPABASE_TOKEN) {
      headers.Authorization = `Bearer ${SUPABASE_TOKEN}`;
      headers.apikey = SUPABASE_TOKEN;
    }
    return headers;
  }, []);

  useEffect(() => {
    if (!visitorName) return;

    if (!SUPABASE_URL) {
      setError('Supabase configuration is missing.');
      setLoading(false);
      return;
    }

    if (!slug) {
      setError('Missing avatar link identifier.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const prepareRoom = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: publicLink, error: linkError } = await supabase
          .from('public_links')
          .select('*')
          .eq('slug', slug)
          .maybeSingle();

        if (cancelled) return;
        if (linkError) throw linkError;
        if (!publicLink) {
          throw new Error('Unable to locate this avatar session.');
        }
        if (!publicLink.is_enabled) {
          throw new Error('This avatar session is currently disabled.');
        }
        if (!publicLink.avatar_id) {
          throw new Error('No avatar is linked to this experience yet.');
        }

        const { data: avatarRecord, error: avatarError } = await supabase
          .from('ai_avatars')
          .select('*')
          .eq('id', publicLink.avatar_id)
          .maybeSingle();

        if (cancelled) return;
        if (avatarError) throw avatarError;
        if (!avatarRecord) {
          throw new Error('The linked avatar is no longer available.');
        }
        if (!avatarRecord.is_active) {
          throw new Error('This avatar is currently inactive.');
        }

        const headers = buildSupabaseHeaders();

        const agentPayload: Record<string, unknown> = {
          room: resolvedRoom,
        };

        if (publicLink.config || visitorName) {
          agentPayload.agentConfig = {
            ...(publicLink.config ?? {}),
            visitorName,
          };
          agentPayload.metadata = {
            slug: publicLink.slug,
            linkId: publicLink.id,
            visitorName,
          };
        }

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/livekit-request-agent`, {
            method: 'POST',
            headers,
            body: JSON.stringify(agentPayload),
          });
        } catch (dispatchError) {
          console.warn('[EstateRoomClient] Failed to ensure agent dispatch', dispatchError);
        }

        const metadataPayload: Record<string, unknown> = {
          slug: publicLink.slug,
          linkId: publicLink.id,
          avatarId: avatarRecord.id,
          visitorName,
        };
        if (publicLink.agent_identity) {
          metadataPayload.agentIdentity = publicLink.agent_identity;
        }
        if (publicLink.config) {
          metadataPayload.config = publicLink.config;
        }

        const tokenResponse = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            room: resolvedRoom,
            participant: visitorName,
            metadata: JSON.stringify(metadataPayload),
            ttl: '15m',
          }),
        });

        if (cancelled) return;
        if (!tokenResponse.ok) {
          let message = 'Failed to prepare LiveKit connection.';
          try {
            const payload = (await tokenResponse.json()) as { error?: string };
            if (payload?.error) {
              message = payload.error;
            }
          } catch (err) {
            console.warn('[EstateRoomClient] Unable to parse token error response', err);
          }
          throw new Error(message);
        }

        const details = (await tokenResponse.json()) as Partial<ConnectionDetails>;
        if (!details.token || !details.serverUrl) {
          throw new Error('Token endpoint did not return connection details.');
        }

        if (cancelled) return;

        setLink(publicLink);
        setAvatar(avatarRecord);
        setConnectionDetails({
          token: details.token,
          serverUrl: details.serverUrl,
          identity: details.identity ?? visitorName,
          room: details.room ?? resolvedRoom,
        });
        setUserChoices({
          username: visitorName,
          audioEnabled: true,
          videoEnabled: false,
          audioDeviceId: '',
          videoDeviceId: '',
        });
      } catch (err) {
        if (cancelled) return;
        console.error('[EstateRoomClient] Failed to prepare room', err);
        const message =
          err instanceof Error ? err.message : 'We were unable to prepare the session. Please try again later.';
        setError(message);
        setConnectionDetails(null);
        setUserChoices(null);
        setLink(null);
        setAvatar(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void prepareRoom();

    return () => {
      cancelled = true;
    };
  }, [buildSupabaseHeaders, resolvedRoom, slug, visitorName]);

  const handleLeave = useCallback(() => {
    void stopAgent();
    if (slug) {
      router.push(`/avatar/${encodeURIComponent(slug)}`);
    } else {
      router.push('/');
    }
  }, [router, slug, stopAgent]);

  const roomOptions = useMemo<RoomOptions>(() => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [],
      },
      adaptiveStream: { pixelDensity: 'screen' },
    };
  }, []);

  const connectOptions = useMemo<RoomConnectOptions>(() => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  useEffect(() => {
    return () => {
      void stopAgent();
    };
  }, [stopAgent]);

  if (loading) {
    return (
      <main className="estate-room flex min-h-screen items-center justify-center px-6 text-white">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/10 px-8 py-6 text-center shadow-2xl backdrop-blur">
          <Loader className="h-6 w-6 animate-spin text-cyan-200" />
          <p className="text-lg font-semibold">Preparing your Estate Buddy concierge suite…</p>
          <p className="text-sm text-white/70">
            We&rsquo;re arranging the LiveKit room and warming up the avatar. This usually takes just a moment.
          </p>
        </div>
      </main>
    );
  }

  if (error || !connectionDetails || !userChoices) {
    return (
      <main className="estate-room flex min-h-screen items-center justify-center px-6 text-white">
        <div className="max-w-md space-y-4 rounded-3xl bg-white/10 px-8 py-6 text-center shadow-2xl backdrop-blur">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-300" />
          <h2 className="text-2xl font-semibold">We couldn&rsquo;t launch the experience</h2>
          <p className="text-sm text-white/70">
            {error ?? 'The avatar session could not be prepared. Please refresh and try again.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/30"
          >
            Return to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="estate-room">
      <LiveKitRoom
        connect
        room={room}
        token={connectionDetails.token}
        serverUrl={connectionDetails.serverUrl}
        connectOptions={connectOptions}
        video={false}
        audio={userChoices.audioEnabled}
        onDisconnected={handleLeave}
        data-lk-theme="default"
      >
        <EstateVideoConference
          visitorName={visitorName}
          roomName={connectionDetails.room}
          link={link}
          avatar={avatar}
        />
      </LiveKitRoom>
    </main>
  );
}

function createVisitorAlias() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `Visitor-${crypto.randomUUID().split('-')[0].slice(0, 4).toUpperCase()}`;
    }
  } catch (err) {
    console.warn('[EstateRoomClient] Failed to generate alias via crypto', err);
  }
  return `Visitor-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
