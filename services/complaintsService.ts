import { supabase } from '../lib/supabase';
import { getMyProfile } from './profileService';

export async function createComplaint(input: {
  targetUserId: string;
  reason: string;
}) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  if (!input.reason.trim()) {
    throw new Error('Укажите причину жалобы');
  }

  if (me.id === input.targetUserId) {
    throw new Error('Нельзя отправить жалобу на самого себя');
  }

  const { error } = await supabase.from('complaints').insert({
    reporter_user_id: me.id,
    target_user_id: input.targetUserId,
    reason: input.reason.trim(),
    status: 'pending',
  });

  if (error) {
    throw new Error(error.message);
  }
}