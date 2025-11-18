import { supabase } from './supabase';

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned');

  if (data.session) {
    await upsertAdminProfile(data.user.id, displayName);
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getAdminProfile(userId: string) {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertAdminProfile(userId: string, displayName: string) {
  const { error } = await supabase
    .from('admin_profiles')
    .upsert(
      {
        user_id: userId,
        display_name: displayName,
      },
      {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      },
    );

  if (error) throw error;
}
