'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AdminProfile } from '../types/db';
import { getAdminProfile, upsertAdminProfile } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  profile: AdminProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(
    async (nextUser: User | null) => {
      if (!nextUser) {
        setProfile(null);
        return;
      }

      try {
        const existing = await getAdminProfile(nextUser.id);
        if (existing) {
          setProfile(existing);
          return;
        }

        const fallbackName =
          (typeof nextUser.user_metadata?.display_name === 'string' && nextUser.user_metadata.display_name) ||
          nextUser.email?.split('@')[0] ||
          'Admin';

        await upsertAdminProfile(nextUser.id, fallbackName);
        const created = await getAdminProfile(nextUser.id);
        setProfile(created ?? null);
      } catch (err) {
        console.error('Failed to ensure admin profile', err);
      }
    },
    [],
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      await ensureProfile(nextUser);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        await ensureProfile(nextUser);
      })();
    });

    return () => subscription.unsubscribe();
  }, [ensureProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
