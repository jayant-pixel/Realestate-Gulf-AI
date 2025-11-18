/*
  # LiveKit Migration

  Adds LiveKit configuration columns to AI avatars and public links,
  paving the way for the Estate Buddy avatar experience.
*/

-- Extend ai_avatars with LiveKit + Anam metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_avatars'
      AND column_name = 'anam_avatar_id'
  ) THEN
    ALTER TABLE ai_avatars
      ADD COLUMN anam_avatar_id text DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_avatars'
      AND column_name = 'openai_voice'
  ) THEN
    ALTER TABLE ai_avatars
      ADD COLUMN openai_voice text DEFAULT 'alloy';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_avatars'
      AND column_name = 'openai_realtime_model'
  ) THEN
    ALTER TABLE ai_avatars
      ADD COLUMN openai_realtime_model text DEFAULT 'gpt-4o-realtime-preview-2024-12-17';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ai_avatars'
      AND column_name = 'heygen_avatar_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ai_avatars
      ALTER COLUMN heygen_avatar_id DROP NOT NULL;
  END IF;
END $$;

-- Extend public_links with LiveKit configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_links'
      AND column_name = 'livekit_room'
  ) THEN
    ALTER TABLE public_links
      ADD COLUMN livekit_room text DEFAULT 'estate-buddy';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_links'
      AND column_name = 'agent_identity'
  ) THEN
    ALTER TABLE public_links
      ADD COLUMN agent_identity text DEFAULT 'Estate Buddy';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_links'
      AND column_name = 'default_property_id'
  ) THEN
    ALTER TABLE public_links
      ADD COLUMN default_property_id uuid REFERENCES properties(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_links'
      AND column_name = 'livekit_metadata'
  ) THEN
    ALTER TABLE public_links
      ADD COLUMN livekit_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_public_links_livekit_room ON public_links(livekit_room);
CREATE INDEX IF NOT EXISTS idx_public_links_default_property_id ON public_links(default_property_id);
