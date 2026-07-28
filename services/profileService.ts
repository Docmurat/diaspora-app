import { supabase } from '../lib/supabase';
import { removeAllUserAvatars } from './storageService';

export type DbUserProfile = {
  id: string;
  email: string | null;
  phone: string | null;
  phone_visible: boolean;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  profession: string | null;
  bio: string | null;
  telegram: string | null;
  extra_info: string | null;
  avatar_path: string | null;
  role: 'owner' | 'moderator' | 'user';
  moderation_status: 'pending' | 'approved' | 'rejected';
  is_blocked: boolean;
  is_deleted: boolean;
  invited_by_user_id: string | null;
  invite_code_used: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyProfile(): Promise<DbUserProfile | null> {
  try {
    await syncMyEmailFromAuth();
  } catch (e) {
    console.log('sync email skipped');
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as DbUserProfile | null) ?? null;
}

export async function syncMyEmailFromAuth(): Promise<void> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return;
    }

    const authEmail = user.email ?? null;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return;
    }

    if ((profile.email ?? null) === authEmail) {
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        email: authEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.log('Не удалось синхронизировать email:', updateError.message);
    }
  } catch (e) {
    console.log('syncMyEmailFromAuth error:', e);
  }
}
export async function softDeleteMyAccount(): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error(authError.message);
  }

  if (!user) {
    throw new Error('Пользователь не найден');
  }
await removeAllUserAvatars(user.id);
  const deletedEmail = `deleted_${user.id}@deleted.local`;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_deleted: true,
      email: deletedEmail,
      phone: null,
      phone_visible: false,
      country: null,
      city: null,
      category: null,
      profession: null,
      bio: null,
      telegram: null,
      extra_info: null,
      avatar_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}