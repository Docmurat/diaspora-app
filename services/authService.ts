import { supabase } from '../lib/supabase';
import { validateInviteCode, markInviteAsUsedById } from './inviteService';

type RegisterUserInput = {
  email: string;
  password: string;
  phone: string;
  phoneVisible: boolean;
  firstName: string;
  lastName: string;
  birthDate: string;
  country: string;
  city: string;
  category: string;
  profession: string;
  bio: string;
  telegram?: string;
  extraInfo?: string;
  avatarPath?: string | null;
  inviteCode: string;
};

export async function registerUser(input: RegisterUserInput) {
  const normalizedInviteCode = input.inviteCode.trim().toUpperCase();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedInviteCode) {
    throw new Error('Инвайт-код не найден');
  }

  const invite = await validateInviteCode(normalizedInviteCode);

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
  });

  if (signUpError) {
    throw new Error(signUpError.message);
  }

  const authUserId = signUpData.user?.id;

  if (!authUserId) {
    throw new Error('Не удалось создать auth-пользователя');
  }

  const { error: insertError } = await supabase.from('users').insert({
    id: authUserId,
    email: normalizedEmail,
    phone: input.phone.trim(),
    phone_visible: input.phoneVisible,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    birth_date: input.birthDate,
    country: input.country.trim(),
    city: input.city.trim(),
    category: input.category.trim(),
    profession: input.profession.trim(),
    bio: input.bio.trim(),
    telegram: input.telegram?.trim() || null,
    extra_info: input.extraInfo?.trim() || null,
    avatar_path: input.avatarPath || null,
    moderation_status: 'pending',
    role: 'user',
    invited_by_user_id: invite.created_by_user_id,
    invite_code_used: invite.code,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  await markInviteAsUsedById({
    inviteId: invite.id,
    usedByUserId: authUserId,
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  });

  if (signInError) {
    throw new Error(signInError.message);
  }

  return {
    userId: authUserId,
  };
}