/*
  # Add AI Avatars Table

  ## New Tables
  - `ai_avatars` - Store multiple AI avatar configurations
    - `id` (uuid, primary key)
    - `name` (text) - Avatar name/title
    - `heygen_avatar_id` (text) - HeyGen avatar identifier
    - `system_prompt` (text) - Complete AI prompt following best practices
    - `is_active` (boolean) - Enable/disable toggle
    - `created_by` (uuid) - Creator user ID
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## Changes to public_links
  - Add `avatar_id` column to link avatars to public links
  - Remove prompt from config (now in avatars table)

  ## Security
  - Enable RLS on ai_avatars table
  - Authenticated users have full read/write access
*/

-- Create ai_avatars table
CREATE TABLE IF NOT EXISTS ai_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  heygen_avatar_id text NOT NULL DEFAULT 'Wayne_20240711',
  system_prompt text NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add avatar_id column to public_links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'public_links' AND column_name = 'avatar_id'
  ) THEN
    ALTER TABLE public_links ADD COLUMN avatar_id uuid REFERENCES ai_avatars(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_avatars_created_by ON ai_avatars(created_by);
CREATE INDEX IF NOT EXISTS idx_ai_avatars_is_active ON ai_avatars(is_active);
CREATE INDEX IF NOT EXISTS idx_public_links_avatar_id ON public_links(avatar_id);

-- Enable Row Level Security
ALTER TABLE ai_avatars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_avatars'
      AND policyname = 'Authenticated users can read ai_avatars'
  ) THEN
    CREATE POLICY "Authenticated users can read ai_avatars"
      ON ai_avatars FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_avatars'
      AND policyname = 'Authenticated users can insert ai_avatars'
  ) THEN
    CREATE POLICY "Authenticated users can insert ai_avatars"
      ON ai_avatars FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_avatars'
      AND policyname = 'Authenticated users can update ai_avatars'
  ) THEN
    CREATE POLICY "Authenticated users can update ai_avatars"
      ON ai_avatars FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_avatars'
      AND policyname = 'Authenticated users can delete ai_avatars'
  ) THEN
    CREATE POLICY "Authenticated users can delete ai_avatars"
      ON ai_avatars FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
