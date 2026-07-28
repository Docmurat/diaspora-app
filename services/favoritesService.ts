import { supabase } from '../lib/supabase';
import { getMyProfile } from './profileService';

export async function getMyFavorites() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      id,
      favorite_user_id,
      created_at,
      favorite_user:favorites_favorite_user_id_fkey (
        id,
        first_name,
        last_name,
        birth_date,
        country,
        city,
        category,
        profession,
        bio,
        telegram,
        extra_info,
        avatar_path,
        moderation_status,
        is_blocked,
        is_deleted
      )
    `)
    .eq('user_id', me.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const filtered =
    (data || []).filter((item: any) => {
      const favoriteUser = Array.isArray(item.favorite_user)
        ? item.favorite_user[0]
        : item.favorite_user;

      if (!favoriteUser) {
        return false;
      }

      if (favoriteUser.moderation_status !== 'approved') {
        return false;
      }

      if (favoriteUser.is_deleted === true) {
        return false;
      }

      if (favoriteUser.is_blocked === true) {
        return false;
      }

      return true;
    });

  return filtered;
}

export async function addFavoriteToDb(favoriteUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { error } = await supabase.from('favorites').insert({
    user_id: me.id,
    favorite_user_id: favoriteUserId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeFavoriteFromDb(favoriteUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', me.id)
    .eq('favorite_user_id', favoriteUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function isFavoriteInDb(favoriteUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      id,
      favorite_user:favorites_favorite_user_id_fkey (
        id,
        moderation_status,
        is_blocked,
        is_deleted
      )
    `)
    .eq('user_id', me.id)
    .eq('favorite_user_id', favoriteUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return false;
  }

  const favoriteUser = Array.isArray((data as any).favorite_user)
    ? (data as any).favorite_user[0]
    : (data as any).favorite_user;

  if (!favoriteUser) {
    return false;
  }

  if (favoriteUser.moderation_status !== 'approved') {
    return false;
  }

  if (favoriteUser.is_deleted === true) {
    return false;
  }

  if (favoriteUser.is_blocked === true) {
    return false;
  }

  return true;
}