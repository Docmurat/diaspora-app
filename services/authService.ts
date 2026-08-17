import { supabase } from '../lib/supabase';
import { normalizeHandle, normalizePhone } from './contactsService';
import { validateInviteCode, markInviteAsUsedById } from './inviteService';

type RegisterUserInput = {
  email: string;
  password: string;
  phone: string;
  phoneVisible: boolean;
  hasWhatsapp: boolean;
  firstName: string;
  lastName: string;
  birthDate: string;
  country: string;
  city: string;
  category: string;
  profession: string;
  bio: string;
  telegram?: string;
  instagram?: string;
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
    phone_visible: input.phoneVisible,
    has_whatsapp: input.hasWhatsapp,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    birth_date: input.birthDate,
    country: input.country.trim(),
    city: input.city.trim(),
    category: input.category.trim(),
    profession: input.profession.trim(),
    bio: input.bio.trim(),
    telegram: normalizeHandle(input.telegram),
    instagram: normalizeHandle(input.instagram),
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

  // Телефон живёт в служебной таблице users_private (Веха 62):
  // база отдаёт его чужим только при включённом «показывать телефон».
  const { error: phoneInsertError } = await supabase
    .from('users_private')
    .insert({
      user_id: authUserId,
      phone: normalizePhone(input.phone),
    });

  if (phoneInsertError) {
    throw new Error(phoneInsertError.message);
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