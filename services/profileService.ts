import { supabase } from '../lib/supabase';
import { removeAllUserAvatars } from './storageService';

export type DbUserProfile = {
  id: string;
  email: string | null;
  phone: string | null;
  phone_visible: boolean;
  has_whatsapp: boolean;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  profession: string | null;
  bio: string | null;
  telegram: string | null;
  instagram: string | null;
  extra_info: string | null;
  avatar_path: string | null;
  role: 'owner' | 'moderator' | 'user';
  moderation_status: 'pending' | 'approved' | 'rejected';
  is_blocked: boolean;
  is_deleted: boolean;
  is_demo?: boolean;
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
    .select('*, users_private(phone)')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  // Телефон переехал в users_private (Веха 62) — пришиваем его на
  // прежнее место, чтобы остальной код ничего не заметил.
  const { users_private, ...profile } = data as any;

  // Заодно освежаем памятку аватарки (см. ниже) — правка фото в
  // кабинете сразу доедет и до шапки.
  avatarPathCache = (profile as any)?.avatar_path ?? null;

  return {
    ...profile,
    phone: users_private?.phone ?? null,
  } as DbUserProfile;
}

// ─────────────────────────────────────────────────────────────────────
// ПАМЯТКА АВАТАРКИ (Веха 67). Шапка TopBar стоит на каждой вкладке и
// раньше при каждом заходе заново спрашивала анкету ЦЕЛИКОМ (да ещё со
// сверкой почты — это два лишних похода в базу) — аватарка подолгу
// висела заглушкой, хотя список людей уже загрузился. Теперь адрес
// картинки живёт в памяти: шапка показывает его МГНОВЕННО, а свежесть
// проверяет тихо в фоне лёгким запросом одного поля. Память живёт,
// пока открыто приложение (по образцу памятки ссылок Стены, Веха 55).
// undefined = ещё ни разу не узнавали.
let avatarPathCache: string | null | undefined;

export function getCachedAvatarPath(): string | null | undefined {
  return avatarPathCache;
}

export async function refreshMyAvatarPath(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return avatarPathCache ?? null;

    const { data } = await supabase
      .from('users')
      .select('avatar_path')
      .eq('id', user.id)
      .maybeSingle();

    avatarPathCache = (data as any)?.avatar_path ?? null;
    return avatarPathCache;
  } catch {
    // Сеть моргнула — показываем, что помним.
    return avatarPathCache ?? null;
  }
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

  // Номер удаляем сразу — он в users_private (Веха 62).
  const { error: phoneDeleteError } = await supabase
    .from('users_private')
    .delete()
    .eq('user_id', user.id);

  if (phoneDeleteError) {
    throw new Error(phoneDeleteError.message);
  }

  const deletedEmail = `deleted_${user.id}@deleted.local`;

  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_deleted: true,
      email: deletedEmail,
      phone_visible: false,
      has_whatsapp: false,
      country: null,
      city: null,
      category: null,
      profession: null,
      bio: null,
      telegram: null,
      instagram: null,
      extra_info: null,
      avatar_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Аватарки больше нет — чистим и памятку шапки.
  avatarPathCache = null;
}