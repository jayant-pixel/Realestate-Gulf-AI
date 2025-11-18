'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, Loader2, Plus, Save, Share2, XCircle } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { AIAvatar, PublicLink } from '@/types/db';

type Feedback = { type: 'success' | 'error'; text: string } | null;

interface AvatarFormState {
  id?: string;
  name: string;
  system_prompt: string;
  anam_avatar_id: string;
  openai_voice: string;
  openai_realtime_model: string;
  is_active: boolean;
}

interface ShareFormState {
  id?: string;
  slug: string;
  title: string;
  welcomeMessage: string;
  livekit_room: string;
  agent_identity: string;
  rate_limit_per_min: number;
  is_enabled: boolean;
}

const DEFAULT_MODEL = 'gpt-realtime-2025-08-28';
const DEFAULT_VOICE = 'alloy';
const DEFAULT_ANAM_AVATAR = '6cc28442-cccd-42a8-b6e4-24b7210a09c5';
const DEFAULT_ROOM = 'estate-buddy';
const DEFAULT_AGENT_IDENTITY = 'Estate Buddy';
const DEFAULT_RATE_LIMIT = 30;

const DEFAULT_PROMPT = [
  '# Role',
  'You are Estate Buddy, the always-on concierge for Gulf Estate AI. Greet every visitor, learn their goals, surface matching properties, and guide them toward a clear next action such as scheduling a tour or requesting a follow-up.',
  '',
  '# Persona',
  '- Speak like a confident, helpful property consultant.',
  '- Reference concrete facts about price, availability, amenities, and timelines.',
  '- Keep responses focused, acknowledge what the visitor said, and invite follow-up questions.',
  '',
  '# Flow',
  '1. Welcome and confirm the visitor name when known.',
  '2. Ask about budget, location preferences, property type, move-in timing, and must-have features.',
  '3. Call `list_properties` before describing options so the carousel matches the conversation.',
  '4. When the visitor prefers a listing, call `show_property_detail` and narrate the highlights you see.',
  '5. After confirming their name plus phone or email, call `create_lead` and reassure them about follow-up.',
  '6. Use `log_activity` for promised brochures, tours, or custom requirements so the CRM stays current.',
  '7. Summarize next steps, thank the visitor, and stay available for final questions.',
  '',
  '# Tool Guidance',
  '- `list_properties`: Run after discovery questions or whenever the visitor asks for options. Include filters such as location, max budget, or bedrooms when available.',
  '- `show_property_detail`: Trigger once the visitor focuses on a specific listing and invite their feedback.',
  '- `create_lead`: Use only after confirming the visitor\'s name and a contact method.',
  '- `log_activity`: Record promised actions (brochures, tours, follow-ups) so the sales team stays aligned.',
  '',
  '# Guardrails',
  '- Never invent data; if unsure, promise to verify with the sales team.',
  '- Avoid guarantees about pricing or discounts; stay factual and balanced.',
  '- Ask the visitor to repeat themselves when audio is unclear.',
  '- Keep the UI synchronized with the conversation by refreshing property lists when preferences change.',
].join('\n');

const REALTIME_MODELS = [
  { value: 'gpt-realtime-2025-08-28', label: 'GPT Realtime (2025-08-28)' },
  { value: 'gpt-realtime-mini-2025-10-06', label: 'GPT Realtime Mini (2025-10-06)' },
];

const REALTIME_VOICES = [
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'nova', label: 'Nova' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
];

type AnamAvatarChoice = {
  id: string;
  name: string;
  variant: string;
  image: string;
};

const ANAM_AVATAR_CHOICES: AnamAvatarChoice[] = [
  { id: '6cc28442-cccd-42a8-b6e4-24b7210a09c5', name: 'Gabriel', variant: 'Table', image: 'https://lab.anam.ai/persona_thumbnails/gabriel_table.png' },
  { id: 'edf6fdcb-acab-44b8-b974-ded72665ee26', name: 'Mia', variant: 'Studio', image: 'https://lab.anam.ai/persona_thumbnails/mia_studio.png' },
  { id: '19d18eb0-5346-4d50-a77f-26b3723ed79d', name: 'Richard', variant: 'Table', image: 'https://lab.anam.ai/persona_thumbnails/richard_table.png' },
  { id: '071b0286-4cce-4808-bee2-e642f1062de3', name: 'Liv', variant: 'Home', image: 'https://lab.anam.ai/persona_thumbnails/liv_home.png' },
  { id: '81b70170-2e80-4e4b-a6fb-e04ac110dc4b', name: 'William', variant: 'Lean', image: 'https://lab.anam.ai/persona_thumbnails/william_lean.png' },
  { id: 'edcb8f1a-334f-4cdb-871c-5c513db806a7', name: 'Julia', variant: 'Sofa', image: 'https://lab.anam.ai/persona_thumbnails/julia_sofa.png' },
  { id: '8a339c9f-0666-46bd-ab27-e90acd0409dc', name: 'Finn', variant: 'Lean', image: 'https://lab.anam.ai/persona_thumbnails/finn_lean.png' },
  { id: '27e12daa-50fc-4384-93c2-ebca73f1f78d', name: 'Anne', variant: 'Home', image: 'https://lab.anam.ai/persona_thumbnails/anne_home.png' },
  { id: 'ecfb2ddb-80ec-4526-88a7-299a4738957c', name: 'Hunter', variant: 'Table', image: 'https://lab.anam.ai/persona_thumbnails/hunter_table.png' },
  { id: 'dc9aa3e1-32f2-499e-9921-ecabac1076fc', name: 'Bella', variant: 'Sofa', image: 'https://lab.anam.ai/persona_thumbnails/bella_sofa.png' },
  { id: 'ccf00c0e-7302-455b-ace2-057e0cf58127', name: 'Kevin', variant: 'Table', image: 'https://lab.anam.ai/persona_thumbnails/kevin_table.png' },
  { id: 'ae2ea8c1-db28-47e3-b6ea-493e4ed3c554', name: 'Layla', variant: 'Home', image: 'https://lab.anam.ai/persona_thumbnails/layla_home.png' },
  { id: '6dbc1e47-7768-403e-878a-94d7fcc3677b', name: 'Sophie', variant: 'Sofa', image: 'https://lab.anam.ai/persona_thumbnails/sophie_sofa.png' },
  { id: 'c1785d08-9825-4ead-89b3-171d3f667c47', name: 'Alister', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/alister_desk.png' },
  { id: '5701b9ca-c474-4b28-b108-4ca81911ca16', name: 'Alister', variant: 'Window Sofa', image: 'https://lab.anam.ai/persona_thumbnails/alister_windowsofa.png' },
  { id: 'e36f16d8-7ad1-423b-b9c9-70d49f5eaac6', name: 'Alister', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/alister_windowdesk.png' },
  { id: 'bdaaedfa-00f2-417a-8239-8bb89adec682', name: 'Astrid', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/astrid_desk.png' },
  { id: 'e717a556-2d44-4213-96ec-27d0b94dc198', name: 'Astrid', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/astrid_windowdesk.png' },
  { id: '972e0055-4a8a-4ba5-8b77-39bc0dfb6a1c', name: 'Astrid', variant: 'Window Sofa Corner', image: 'https://lab.anam.ai/persona_thumbnails/astrid_windowsofacorner.png' },
  { id: '960f614f-ea88-47c3-9883-f02094f70874', name: 'Cara', variant: 'Window Sofa', image: 'https://lab.anam.ai/persona_thumbnails/cara_windowsofa.png' },
  { id: '30fa96d0-26c4-4e55-94a0-517025942e18', name: 'Cara', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/cara_desk.png' },
  { id: 'd9ebe82e-2f34-4ff6-9632-16cb73e7de08', name: 'Cara', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/cara_windowdesk.png' },
  { id: '195d733e-58a9-40bb-a049-ac344fa70b7f', name: 'Evelyn', variant: 'Window Sofa Corner', image: 'https://lab.anam.ai/persona_thumbnails/evelyn_windowsofacorner.png' },
  { id: '290ef1d5-9201-40f4-8c88-394a6317f10d', name: 'Evelyn', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/evelyn_desk.png' },
  { id: 'bb4f5306-ffdb-4437-a837-da6fdc23cbff', name: 'Evelyn', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/evelyn_windowdesk.png' },
  { id: 'd73415e3-d624-45a6-a461-0df1580e73d6', name: 'Leo', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/leo_windowdesk.png' },
  { id: '121d5df1-3f3e-4a48-a237-8ff488e9eed8', name: 'Leo', variant: 'Window Sofa Corner', image: 'https://lab.anam.ai/persona_thumbnails/leo_windowsofacorner.png' },
  { id: 'aa5d6abd-416f-4dd4-a123-b5b29bf1644a', name: 'Leo', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/leo_desk.png' },
  { id: '92b91f2a-4159-411f-b092-3e1b8663f6b9', name: 'Pablo', variant: 'Window Desk', image: 'https://lab.anam.ai/persona_thumbnails/pablo_windowdesk.png' },
  { id: '8dd64886-ce4b-47d5-b837-619660854768', name: 'Pablo', variant: 'Desk', image: 'https://lab.anam.ai/persona_thumbnails/pablo_desk.png' },
  { id: '2fbdec6f-86fd-47d6-8bcc-e8a69270e75b', name: 'Pablo', variant: 'Window Sofa', image: 'https://lab.anam.ai/persona_thumbnails/pablo_windowsofa.png' },
];

const INITIAL_FORM: AvatarFormState = {
  name: 'Estate Buddy Concierge',
  system_prompt: DEFAULT_PROMPT,
  anam_avatar_id: DEFAULT_ANAM_AVATAR,
  openai_voice: DEFAULT_VOICE,
  openai_realtime_model: DEFAULT_MODEL,
  is_active: true,
};

const INITIAL_SHARE: ShareFormState = {
  slug: 'estate-buddy',
  title: 'Estate Buddy Concierge',
  welcomeMessage:
    'Launch your Estate Buddy concierge to explore curated listings, ask questions, and capture your preferences in real time.',
  livekit_room: DEFAULT_ROOM,
  agent_identity: DEFAULT_AGENT_IDENTITY,
  rate_limit_per_min: DEFAULT_RATE_LIMIT,
  is_enabled: true,
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function randomSegment(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length).toLowerCase();
}

function generateSlug(base: string): string {
  const cleaned = slugify(base).replace(/-+$/g, '');
  const prefix = cleaned || 'estate-avatar';
  return `${prefix}-${randomSegment(5)}`;
}

const PROMPT_METADATA_PREFIX = '<!--ESTATE-AVATAR-CONFIG:';
const PROMPT_METADATA_SUFFIX = '-->';

type PromptMetadata = {
  model: string;
  voice: string;
  persona: string;
};

function encodePrompt(prompt: string, metadata: PromptMetadata): string {
  const metaBlock = `${PROMPT_METADATA_PREFIX}${JSON.stringify(metadata)}${PROMPT_METADATA_SUFFIX}`;
  return `${metaBlock}\n${prompt.trim()}`;
}

function decodePrompt(stored: string | null | undefined): { prompt: string; metadata: Partial<PromptMetadata> } {
  if (!stored) {
    return { prompt: DEFAULT_PROMPT, metadata: {} };
  }
  if (stored.startsWith(PROMPT_METADATA_PREFIX)) {
    const suffixIndex = stored.indexOf(PROMPT_METADATA_SUFFIX);
    if (suffixIndex > PROMPT_METADATA_PREFIX.length) {
      const metaRaw = stored.slice(PROMPT_METADATA_PREFIX.length, suffixIndex).trim();
      try {
        const metadata = JSON.parse(metaRaw) as Partial<PromptMetadata>;
        const promptBody = stored.slice(suffixIndex + PROMPT_METADATA_SUFFIX.length).trimStart();
        return { prompt: promptBody || DEFAULT_PROMPT, metadata };
      } catch (error) {
        console.warn('[avatars] Unable to parse prompt metadata', error);
      }
    }
  }
  return { prompt: stored, metadata: {} };
}

function toAvatarForm(avatar: AIAvatar | null): AvatarFormState {
  if (!avatar) {
    return { ...INITIAL_FORM };
  }

  const decoded = decodePrompt(avatar.system_prompt);
  return {
    id: avatar.id,
    name: avatar.name ?? INITIAL_FORM.name,
    system_prompt: decoded.prompt ?? DEFAULT_PROMPT,
    anam_avatar_id: decoded.metadata.persona ?? avatar.anam_avatar_id ?? DEFAULT_ANAM_AVATAR,
    openai_voice: decoded.metadata.voice ?? avatar.openai_voice ?? DEFAULT_VOICE,
    openai_realtime_model: decoded.metadata.model ?? avatar.openai_realtime_model ?? DEFAULT_MODEL,
    is_active: avatar.is_active ?? true,
  };
}

function toShareForm(avatar: AIAvatar | null, link: PublicLink | null): ShareFormState {
  const baseTitle = avatar?.name ?? INITIAL_SHARE.title;
  if (!link) {
    return {
      ...INITIAL_SHARE,
      title: baseTitle,
      slug: generateSlug(baseTitle),
    };
  }

  return {
    id: link.id,
    slug: link.slug ?? slugify(baseTitle),
    title: link.title ?? baseTitle,
    welcomeMessage:
      (link.config && typeof link.config.welcomeMessage === 'string'
        ? link.config.welcomeMessage
        : INITIAL_SHARE.welcomeMessage) ?? INITIAL_SHARE.welcomeMessage,
    livekit_room: link.livekit_room ?? DEFAULT_ROOM,
    agent_identity: link.agent_identity ?? DEFAULT_AGENT_IDENTITY,
    rate_limit_per_min: Number(link.rate_limit_per_min ?? DEFAULT_RATE_LIMIT),
    is_enabled: link.is_enabled ?? true,
  };
}

export default function AvatarsPage(): JSX.Element {
  const { user } = useAuth();
  const [avatars, setAvatars] = useState<AIAvatar[]>([]);
  const [linksByAvatar, setLinksByAvatar] = useState<Record<string, PublicLink>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AvatarFormState>({ ...INITIAL_FORM });
  const [share, setShare] = useState<ShareFormState>({ ...INITIAL_SHARE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const currentAvatar = useMemo(
    () => (selectedId ? avatars.find((item) => item.id === selectedId) ?? null : null),
    [avatars, selectedId],
  );

  const currentLink = useMemo(
    () => (currentAvatar ? linksByAvatar[currentAvatar.id] ?? null : null),
    [currentAvatar, linksByAvatar],
  );

  const personaOptions = useMemo<AnamAvatarChoice[]>(() => {
    if (!form.anam_avatar_id) {
      return ANAM_AVATAR_CHOICES;
    }
    if (ANAM_AVATAR_CHOICES.some((choice) => choice.id === form.anam_avatar_id)) {
      return ANAM_AVATAR_CHOICES;
    }
    return ANAM_AVATAR_CHOICES.concat({
      id: form.anam_avatar_id,
      name: 'Custom Avatar',
      variant: form.anam_avatar_id,
      image: '',
    });
  }, [form.anam_avatar_id]);

  const selectedPersona = useMemo(
    () => personaOptions.find((choice) => choice.id === form.anam_avatar_id) ?? null,
    [personaOptions, form.anam_avatar_id],
  );

  const modelOptions = useMemo(() => {
    const base = [...REALTIME_MODELS];
    if (form.openai_realtime_model && !base.some((option) => option.value === form.openai_realtime_model)) {
      base.push({ value: form.openai_realtime_model, label: form.openai_realtime_model });
    }
    return base;
  }, [form.openai_realtime_model]);

  const voiceOptions = useMemo(() => {
    const base = [...REALTIME_VOICES];
    if (form.openai_voice && !base.some((option) => option.value === form.openai_voice)) {
      base.push({ value: form.openai_voice, label: form.openai_voice });
    }
    return base;
  }, [form.openai_voice]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: avatarRows, error: avatarError }, { data: linkRows, error: linkError }] = await Promise.all([
          supabase.from('ai_avatars').select('*').order('created_at', { ascending: true }),
          supabase.from('public_links').select('*'),
        ]);

        if (avatarError) throw avatarError;
        if (linkError) throw linkError;
        if (cancelled) return;

        const avatarList = (avatarRows ?? []) as AIAvatar[];
        const linkMap: Record<string, PublicLink> = {};
        (linkRows ?? []).forEach((item) => {
          if (item.avatar_id) {
            linkMap[item.avatar_id] = item as PublicLink;
          }
        });

        setAvatars(avatarList);
        setLinksByAvatar(linkMap);

        if (avatarList.length > 0) {
          const first = avatarList[0];
          setSelectedId(first.id);
          setForm(toAvatarForm(first));
          setShare(toShareForm(first, linkMap[first.id] ?? null));
        } else {
          setSelectedId(null);
          setForm({ ...INITIAL_FORM });
          setShare({ ...INITIAL_SHARE });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[avatars] load error', error);
          setFeedback({ type: 'error', text: 'Unable to load avatars. Please try again shortly.' });
        }
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
  }, []);

  useEffect(() => {
    setForm(toAvatarForm(currentAvatar));
    setShare(toShareForm(currentAvatar, currentLink));
    setShareOpen(false);
    setFeedback(null);
  }, [currentAvatar, currentLink]);

  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleSelectAvatar = useCallback(
    (avatar: AIAvatar | null) => {
      setSelectedId(avatar?.id ?? null);
      setFeedback(null);
    },
    [setSelectedId],
  );

  const handleSave = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim()) {
        setFeedback({ type: 'error', text: 'Avatar name is required.' });
        return;
      }
      if (!form.anam_avatar_id.trim()) {
        setFeedback({ type: 'error', text: 'Anam avatar ID is required.' });
        return;
      }
      if (!form.system_prompt.trim()) {
        setFeedback({ type: 'error', text: 'System prompt cannot be empty.' });
        return;
      }

      setSaving(true);
      setFeedback(null);
      try {
        const persistedPrompt = encodePrompt(form.system_prompt, {
          model: form.openai_realtime_model,
          voice: form.openai_voice,
          persona: form.anam_avatar_id,
        });

        const basePayload = {
          name: form.name.trim(),
          system_prompt: persistedPrompt,
          is_active: form.is_active,
        };

        if (form.id) {
          const { data, error } = await supabase
            .from('ai_avatars')
            .update(basePayload)
            .eq('id', form.id)
            .select('*')
            .single();
          if (error) throw error;
          const updated = data as AIAvatar;
          setAvatars((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          setFeedback({ type: 'success', text: 'Avatar updated successfully.' });
        } else {
          const insertPayload = {
            ...basePayload,
            created_by: user?.id ?? null,
          };
          const { data, error } = await supabase.from('ai_avatars').insert(insertPayload).select('*').single();
          if (error) throw error;
          const created = data as AIAvatar;
          setAvatars((prev) => [...prev, created]);
          setSelectedId(created.id);
          setFeedback({ type: 'success', text: 'Avatar created successfully.' });
        }
      } catch (error) {
        console.error('[avatars] save error', error);
        setFeedback({ type: 'error', text: 'Unable to save avatar. Please try again.' });
      } finally {
        setSaving(false);
      }
    },
    [form, user?.id],
  );

  const handleShareToggle = useCallback(() => {
    if (!form.id) {
      setFeedback({ type: 'error', text: 'Save the avatar before generating a share link.' });
      return;
    }
    setShare((prev) => {
      if (!prev.slug) {
        return { ...prev, slug: generateSlug(form.name || 'estate-avatar') };
      }
      return prev;
    });
    setShareOpen((prev) => !prev);
  }, [form.id, form.name]);

  const handleShareSave = useCallback(async () => {
    if (!form.id || !currentAvatar) {
      setFeedback({ type: 'error', text: 'Save the avatar before generating a share link.' });
      return;
    }

    const slugCandidate = share.slug.trim() || generateSlug(currentAvatar.name ?? 'estate-avatar');

    setShareSaving(true);
    setFeedback(null);
    try {
      const { data: slugCollision, error: slugLookupError } = await supabase
        .from('public_links')
        .select('id, avatar_id')
        .eq('slug', slugCandidate)
        .maybeSingle();

      if (slugLookupError && slugLookupError.code !== 'PGRST116') {
        throw slugLookupError;
      }

      if (slugCollision && slugCollision.avatar_id !== currentAvatar.id && slugCollision.id !== share.id) {
        setFeedback({
          type: 'error',
          text: 'This slug is already used by another avatar. Choose a different slug.',
        });
        setShareSaving(false);
        return;
      }

      const payload = {
        avatar_id: currentAvatar.id,
        slug: slugCandidate,
        title: share.title.trim() || currentAvatar.name,
        livekit_room: share.livekit_room.trim() || DEFAULT_ROOM,
        agent_identity: share.agent_identity.trim() || currentAvatar.name,
        rate_limit_per_min: Number.isFinite(share.rate_limit_per_min) ? share.rate_limit_per_min : DEFAULT_RATE_LIMIT,
        is_enabled: share.is_enabled,
        config: {
          assistantPrompt: form.system_prompt,
          model: form.openai_realtime_model,
          voice: form.openai_voice,
          avatarId: form.anam_avatar_id,
          welcomeMessage: share.welcomeMessage,
          ...(selectedPersona
            ? {
                avatarName: selectedPersona.name,
                avatarVariant: selectedPersona.variant,
                avatarImage: selectedPersona.image,
              }
            : {}),
        },
      };

      let updated: PublicLink;
      if (share.id) {
        const { data, error } = await supabase
          .from('public_links')
          .update(payload)
          .eq('id', share.id)
          .select('*')
          .single();
        if (error) throw error;
        updated = data as PublicLink;
      } else {
        const insertPayload = {
          ...payload,
          created_by: user?.id ?? null,
        };
        const { data, error } = await supabase.from('public_links').insert(insertPayload).select('*').single();
        if (error) throw error;
        updated = data as PublicLink;
      }

      setLinksByAvatar((prev) => ({ ...prev, [currentAvatar.id]: updated }));
      setShare((prev) => ({ ...prev, id: updated.id, slug: updated.slug }));
      setFeedback({ type: 'success', text: 'Share link saved successfully.' });
    } catch (error) {
      console.error('[avatars] share error', error);
      const message =
        error instanceof Error && /duplicate key value/.test(error.message)
          ? 'That slug is already in use. Please choose another.'
          : 'Unable to save the share link. Please try again.';
      setFeedback({ type: 'error', text: message });
    } finally {
      setShareSaving(false);
    }
  }, [
    currentAvatar,
    form.anam_avatar_id,
    form.id,
    form.openai_realtime_model,
    form.openai_voice,
    form.system_prompt,
    selectedPersona,
    share.agent_identity,
    share.id,
    share.is_enabled,
    share.livekit_room,
    share.rate_limit_per_min,
    share.slug,
    share.title,
    share.welcomeMessage,
    user?.id,
  ]);

  const shareUrl = useMemo(() => {
    if (!share.slug) return '';
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/avatar/${share.slug}`;
  }, [share.slug]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
      if (!share.id) {
        setFeedback({
          type: 'error',
          text: 'Link copied. Save the share link to publish it for visitors.',
        });
      }
    } catch (error) {
      console.warn('[avatars] copy error', error);
      setFeedback({ type: 'error', text: 'Unable to copy link. Copy it manually from the field below.' });
    }
  }, [setFeedback, share.id, shareUrl]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Avatars</h1>
          <p className="text-sm text-gray-600">
            Tune the Estate Buddy concierge, update its prompt, and publish public share links.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleSelectAvatar(null)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New avatar
        </button>
      </header>

      {feedback ? (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-none" />
          ) : (
            <XCircle className="h-4 w-4 flex-none" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
            Loading avatars...
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Avatar library</h2>
              <p className="text-xs text-gray-500">Select an avatar to edit settings or share links.</p>
            </div>
            <ul className="max-h-[540px] divide-y divide-gray-100 overflow-y-auto">
              {avatars.length === 0 ? (
                <li className="px-5 py-5 text-sm text-gray-500">No avatars yet. Create one to get started.</li>
              ) : (
                avatars.map((avatar) => {
                  const active = selectedId === avatar.id;
                  const link = linksByAvatar[avatar.id];
                  return (
                    <li key={avatar.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectAvatar(avatar)}
                        className={`flex w-full flex-col gap-1 px-5 py-3 text-left text-sm transition ${
                          active ? 'bg-cyan-50 text-cyan-700' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-semibold">{avatar.name}</span>
                        <span className="text-xs text-gray-500">
                          {avatar.is_active ? 'Active' : 'Inactive'} · {avatar.openai_realtime_model ?? DEFAULT_MODEL}
                        </span>
                        {link ? (
                          <span className="text-xs text-cyan-600">/avatar/{link.slug}</span>
                        ) : (
                          <span className="text-xs text-gray-400">No share link yet</span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </aside>

          <section className="space-y-6">
            <form onSubmit={handleSave} className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {form.id ? 'Edit avatar' : 'Create new avatar'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Update the personality prompt, LiveKit voice, and avatar identity for the concierge.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleShareToggle}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-cyan-200 hover:text-cyan-600 disabled:opacity-40"
                    disabled={!form.id}
                  >
                    <Share2 className="h-4 w-4" />
                    Share link
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-gray-700">Avatar name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-gray-700">Realtime model</span>
                  <select
                    value={form.openai_realtime_model}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, openai_realtime_model: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-gray-700">Realtime voice</span>
                  <select
                    value={form.openai_voice}
                    onChange={(event) => setForm((prev) => ({ ...prev, openai_voice: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  >
                    {voiceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-gray-700">Anam persona</span>
                  <select
                    value={form.anam_avatar_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, anam_avatar_id: event.target.value }))}
                    className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  >
                    {personaOptions.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name} · {persona.variant}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedPersona ? (
                  <div className="flex items-center gap-4 rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    {selectedPersona.image ? (
                      <Image
                        src={selectedPersona.image}
                        alt={`${selectedPersona.name} avatar`}
                        width={72}
                        height={72}
                        className="h-16 w-16 rounded-2xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-100 text-sm font-semibold text-cyan-700">
                        {selectedPersona.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{selectedPersona.name}</div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">{selectedPersona.variant}</div>
                      <div className="text-xs text-gray-500 break-all">{selectedPersona.id}</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-gray-700">System prompt</span>
                <textarea
                  value={form.system_prompt}
                  onChange={(event) => setForm((prev) => ({ ...prev, system_prompt: event.target.value }))}
                  rows={12}
                  className="w-full rounded-3xl border border-gray-200 px-3 py-3 text-sm leading-relaxed outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                />
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>Activate avatar</span>
                <span className="text-xs font-normal text-gray-500">
                  Active avatars can be dispatched to LiveKit rooms.
                </span>
              </label>
            </form>

            {shareOpen && form.id ? (
              <div className="space-y-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Public share link</h3>
                    <p className="text-sm text-gray-500">
                      Publish the concierge experience at a dedicated URL visitors can join instantly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    aria-label="Close share link settings"
                    className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:border-rose-200 hover:text-rose-500"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">Slug</span>
                    <input
                      type="text"
                      value={share.slug}
                      onChange={(event) =>
                        setShare((prev) => ({ ...prev, slug: slugify(event.target.value) || prev.slug }))
                      }
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">Landing title</span>
                    <input
                      type="text"
                      value={share.title}
                      onChange={(event) => setShare((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">LiveKit room</span>
                    <input
                      type="text"
                      value={share.livekit_room}
                      onChange={(event) => setShare((prev) => ({ ...prev, livekit_room: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">Agent identity</span>
                    <input
                      type="text"
                      value={share.agent_identity}
                      onChange={(event) => setShare((prev) => ({ ...prev, agent_identity: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="font-medium text-gray-700">Rate limit (requests per minute)</span>
                    <input
                      type="number"
                      min={1}
                      value={share.rate_limit_per_min}
                      onChange={(event) =>
                        setShare((prev) => ({
                          ...prev,
                          rate_limit_per_min: Number(event.target.value) || DEFAULT_RATE_LIMIT,
                        }))
                      }
                      className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={share.is_enabled}
                      onChange={(event) => setShare((prev) => ({ ...prev, is_enabled: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>Enable public access</span>
                  </label>
                </div>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-gray-700">Welcome message</span>
                  <textarea
                    value={share.welcomeMessage}
                    onChange={(event) => setShare((prev) => ({ ...prev, welcomeMessage: event.target.value }))}
                    rows={4}
                    className="w-full rounded-3xl border border-gray-200 px-3 py-3 text-sm leading-relaxed outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
                  />
                </label>

                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  {selectedPersona ? (
                    <div className="flex items-center gap-3">
                      {selectedPersona.image ? (
                        <Image
                          src={selectedPersona.image}
                          alt={`${selectedPersona.name} avatar`}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-700">
                          {selectedPersona.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{selectedPersona.name}</div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{selectedPersona.variant}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Select an Anam persona to include it in the public link.</div>
                  )}
                  <div className="text-sm text-gray-600 sm:text-right">
                    <div>
                      <span className="font-medium text-gray-800">Model:</span> {form.openai_realtime_model}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">Voice:</span> {form.openai_voice}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium text-gray-700">Public URL</div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <span className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                      {shareUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold transition hover:border-cyan-200 hover:text-cyan-600 ${
                        share.id ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      <Copy className="h-4 w-4" />
                      {copyState === 'copied' ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleShareSave}
                    disabled={shareSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
                  >
                    {shareSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    {shareSaving ? 'Saving...' : 'Save share link'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
