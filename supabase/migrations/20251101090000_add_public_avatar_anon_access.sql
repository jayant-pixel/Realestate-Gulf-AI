/*
  # Allow anonymous visitors to load public avatar experiences

  ## Overview
  The public avatar landing page queries `public_links` and `ai_avatars` using the
  anonymous Supabase key. Existing RLS policies only grant the `authenticated`
  role read access, so anonymous users fail to load the experience. These
  policies allow anonymous visitors to read enabled public links and active
  avatars while keeping disabled records hidden.
*/

-- Allow anonymous reads of enabled public links
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'public_links'
      AND policyname = 'Anonymous can read enabled public_links'
  ) THEN
    CREATE POLICY "Anonymous can read enabled public_links"
      ON public_links FOR SELECT
      TO anon
      USING (is_enabled = true);
  END IF;
END $$;

-- Allow anonymous reads of active avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_avatars'
      AND policyname = 'Anonymous can read active ai_avatars'
  ) THEN
    CREATE POLICY "Anonymous can read active ai_avatars"
      ON ai_avatars FOR SELECT
      TO anon
      USING (is_active = true);
  END IF;
END $$;
