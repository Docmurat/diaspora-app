import { supabase } from '../lib/supabase';

export type DirectoryUser = {
  id: string;
  email: string | null;
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
  moderation_status: 'pending' | 'approved' | 'rejected';
  role: 'owner' | 'moderator' | 'user';
  is_blocked?: boolean;
  is_deleted?: boolean;
  created_at?: string;
};

export async function getApprovedUsers(): Promise<DirectoryUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('moderation_status', 'approved')
    .eq('is_blocked', false)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as DirectoryUser[];
}