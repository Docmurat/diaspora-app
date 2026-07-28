import { supabase } from '../lib/supabase';
import { getMyProfile } from './profileService';

export async function createNameChangeRequest(input: {
  requestedFirstName: string;
  requestedLastName: string;
  reason: string;
}) {
  const me = await getMyProfile();

  if (!me) {
    throw new Error('Профиль не найден');
  }

  const { error } = await supabase.from('name_change_requests').insert({
    user_id: me.id,
    current_first_name: me.first_name,
    current_last_name: me.last_name,
    requested_first_name: input.requestedFirstName,
    requested_last_name: input.requestedLastName,
    reason: input.reason,
    status: 'pending',
  });

  if (error) {
    throw new Error(error.message);
  }
}