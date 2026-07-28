import { supabase } from '../lib/supabase';

export async function getMessagesForRequest(
  requestType: string,
  requestId: string
) {
  const { data, error } = await supabase
    .from('moderation_messages')
    .select('*')
    .eq('request_type', requestType)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}