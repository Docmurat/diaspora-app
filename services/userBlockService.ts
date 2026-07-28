import { supabase } from '../lib/supabase';
import { getMyProfile } from './profileService';

export async function blockUserForMe(targetUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  if (me.id === targetUserId) {
    throw new Error('Нельзя заблокировать самого себя');
  }

  const { error } = await supabase.from('user_blocks').insert({
    blocker_user_id: me.id,
    blocked_user_id: targetUserId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function unblockUserForMe(targetUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_user_id', me.id)
    .eq('blocked_user_id', targetUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function hasMutualBlock(targetUserId: string) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_user_id, blocked_user_id')
    .or(
      `and(blocker_user_id.eq.${me.id},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${me.id})`
    );

  if (error) {
    throw new Error(error.message);
  }

  const rows = data || [];

  const iBlockedUser = rows.some(
    (row) =>
      row.blocker_user_id === me.id &&
      row.blocked_user_id === targetUserId
  );

  const userBlockedMe = rows.some(
    (row) =>
      row.blocker_user_id === targetUserId &&
      row.blocked_user_id === me.id
  );

  return {
    iBlockedUser,
    userBlockedMe,
    isAnyBlocked: iBlockedUser || userBlockedMe,
  };
}