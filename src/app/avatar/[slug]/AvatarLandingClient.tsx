'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader, Mic } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { AIAvatar, PublicLink } from '@/types/db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_TOKEN = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FALLBACK_ROOM = 'estate-buddy';

interface AvatarLandingClientProps {
  slug: string;
}

export function AvatarLandingClient({ slug }: AvatarLandingClientProps) {
  const router = useRouter();
  const [link, setLink] = useState<PublicLink | null>(null);
  const [avatar, setAvatar] = useState<AIAvatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState('');

  const roomName = useMemo(
    () => (link?.livekit_room?.trim()?.length ? link.livekit_room.trim() : FALLBACK_ROOM),
    [link],
  );

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    const load = async () => {
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
          setError('We could not find this avatar link.');
          return;
        }

        if (!publicLink.is_enabled) {
          setError('This avatar link is currently disabled.');
          return;
        }

        setLink(publicLink);

        if (!publicLink.avatar_id) {
          setError('No avatar is linked to this experience yet.');
          return;
        }

        const { data: avatarRecord, error: avatarError } = await supabase
          .from('ai_avatars')
          .select('*')
          .eq('id', publicLink.avatar_id)
          .maybeSingle();

        if (cancelled) return;
        if (avatarError) throw avatarError;

        if (!avatarRecord) {
          setError('The linked avatar is no longer available.');
          return;
        }

        if (!avatarRecord.is_active) {
          setError('The linked avatar is currently inactive.');
          return;
        }

        setAvatar(avatarRecord);
      } catch (err) {
        if (cancelled) return;
        console.error('[AvatarLanding] Failed to load link', err);
        setError('We ran into a problem loading this avatar. Please try again later.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    const storageKey = `estate-visitor:${slug}`;
    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) {
        setVisitorName(existing);
        return;
      }
      const alias = createVisitorAlias();
      window.sessionStorage.setItem(storageKey, alias);
      setVisitorName(alias);
    } catch (err) {
      console.warn('[AvatarLanding] Failed to persist visitor alias', err);
      setVisitorName((prev) => prev || createVisitorAlias());
    }
  }, [slug]);

  const ensureAgentReady = useCallback(async () => {
    if (!SUPABASE_URL || !slug || !link) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (SUPABASE_TOKEN) {
        headers.Authorization = `Bearer ${SUPABASE_TOKEN}`;
        headers.apikey = SUPABASE_TOKEN;
      }
      const body: Record<string, unknown> = {
        room: roomName,
      };
      if (link.config || visitorName) {
        body.agentConfig = {
          ...(link.config ?? {}),
          visitorName,
        };
      }

      await fetch(`${SUPABASE_URL}/functions/v1/livekit-request-agent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn('[AvatarLanding] Unable to pre-dispatch agent', err);
    }
  }, [link, roomName, slug, visitorName]);

  useEffect(() => {
    if (!link || !visitorName) return;
    void ensureAgentReady();
  }, [ensureAgentReady, link, visitorName]);

  const handleStart = useCallback(async () => {
    if (!link || !avatar) return;
    setStarting(true);
    setConnectionError(null);

    try {
      await ensureAgentReady();
      const target = `/rooms/${encodeURIComponent(roomName)}?slug=${encodeURIComponent(slug)}`;
      router.push(target);
    } catch (err) {
      console.error('[AvatarLanding] Failed to start session', err);
      setConnectionError(
        err instanceof Error ? err.message : 'Unable to prepare the session. Please try again.',
      );
      setStarting(false);
    }
  }, [avatar, ensureAgentReady, link, roomName, router, slug]);

  if (loading) {
    return (
      <section className="estate-hero h-full">
        <div className="estate-hero__glow" />
        <div className="estate-hero__content">
          <div className="flex items-center justify-center gap-3 text-sm uppercase tracking-[0.4em] text-cyan-200/85">
            <span>Estate Buddy</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200/80" />
            <span>AI Concierge</span>
          </div>
          <h1 className="text-4xl font-semibold sm:text-6xl">Preparing your concierge...</h1>
          <p className="text-base text-slate-100/90 sm:text-lg">
            We are gathering the most relevant property insights for you.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-100/80">
            <Loader className="h-5 w-5 animate-spin text-cyan-200" />
            Loading experience
          </div>
        </div>
      </section>
    );
  }

  if (error || !link || !avatar) {
    return (
      <section className="estate-hero h-full">
        <div className="estate-hero__glow" />
        <div className="estate-hero__content">
          <div className="flex items-center justify-center gap-3 text-sm uppercase tracking-[0.4em] text-cyan-200/85">
            <span>Estate Buddy</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200/80" />
            <span>AI Concierge</span>
          </div>
          <h1 className="text-4xl font-semibold sm:text-6xl">We hit a snag</h1>
          <p className="text-base text-slate-100/90 sm:text-lg">
            {error ?? 'The avatar linked to this experience could not be loaded.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="estate-hero h-full">
      <div className="estate-hero__glow" />
      <div className="estate-hero__content space-y-6">
        <div className="flex items-center justify-center gap-3 text-sm uppercase tracking-[0.4em] text-cyan-200/85">
          <span>Estate Buddy</span>
          <span className="h-1 w-1 rounded-full bg-cyan-200/80" />
          <span>AI Concierge</span>
        </div>
        <h1 className="text-4xl font-semibold sm:text-6xl">{link.title ?? avatar.name}</h1>
        <p className="max-w-2xl text-base text-slate-100/90 sm:text-lg">
          {link.config?.welcomeMessage ??
            'Launch your virtual property concierge to explore listings, ask questions, and capture your preferences in real time.'}
        </p>
        <div>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={starting}
            className="estate-hero__cta estate-hero__cta--primary"
          >
            {starting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Preparing your room...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Start Conversation
              </>
            )}
          </button>
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/60">
            Room: {roomName} | Visitor ID: {visitorName}
          </p>
        </div>
        {connectionError && (
          <div className="max-w-md rounded-2xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100 shadow-inner shadow-rose-500/25">
            {connectionError}
          </div>
        )}
      </div>
    </section>
  );
}

function createVisitorAlias() {
  try {
    const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
    const rawSegment = hasCrypto ? crypto.randomUUID().split('-')[0] : Math.random().toString(36).slice(2, 8);
    return `Visitor-${rawSegment.slice(0, 4).toUpperCase()}`;
  } catch {
    return `Visitor-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
}
