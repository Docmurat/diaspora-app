import { supabase } from '../lib/supabase';

export type ChatListItem = {
  chatId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  otherUser: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_path: string | null;
    profession: string | null;
    category: string | null;
    city: string | null;
  } | null;
};

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error('Пользователь не авторизован');
  }

  return user.id;
}

export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const myUserId = await getCurrentUserId();

  console.log('getOrCreateDirectChat started');
  console.log('myUserId:', myUserId);
  console.log('otherUserId:', otherUserId);

  if (!otherUserId) {
    throw new Error('Не передан userId собеседника');
  }

  if (otherUserId === myUserId) {
    throw new Error('Нельзя создать чат с самим собой');
  }

  const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
    other_user_id: otherUserId,
  });

  console.log('rpc get_or_create_direct_chat data:', data);
  console.log('rpc get_or_create_direct_chat error:', error);

  if (error || !data) {
    throw new Error(error?.message || 'Не удалось создать или получить чат');
  }

  return data as string;
}

export async function getMyChats(): Promise<ChatListItem[]> {
  const myUserId = await getCurrentUserId();

  const { data: participantRows, error: participantError } = await supabase
    .from('chat_participants')
    .select(`
      chat_id,
      chats (
        id,
        created_at,
        updated_at,
        last_message_text,
        last_message_at,
        chat_type
      )
    `)
    .eq('user_id', myUserId);

  if (participantError) {
    throw new Error(participantError.message);
  }

  const chatRows = (participantRows || [])
    .map((row: any) => row.chats)
    .filter(Boolean)
    .filter((chat: any) => chat.chat_type === 'direct');

  if (chatRows.length === 0) {
    return [];
  }

  const chatIds = chatRows.map((chat: any) => chat.id);

  const { data: allParticipants, error: allParticipantsError } = await supabase
    .from('chat_participants')
    .select(`
      chat_id,
      user_id,
      users (
        id,
        first_name,
        last_name,
        avatar_path,
        profession,
        category,
        city
      )
    `)
    .in('chat_id', chatIds);

  if (allParticipantsError) {
    throw new Error(allParticipantsError.message);
  }

  const participantsByChat = new Map<string, any[]>();

  for (const row of allParticipants || []) {
    const list = participantsByChat.get(row.chat_id) || [];
    list.push(row);
    participantsByChat.set(row.chat_id, list);
  }

  const result: ChatListItem[] = chatRows.map((chat: any) => {
    const participants = participantsByChat.get(chat.id) || [];
    const otherParticipant = participants.find((p) => p.user_id !== myUserId);

    return {
      chatId: chat.id,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      lastMessageText: chat.last_message_text,
      lastMessageAt: chat.last_message_at,
      otherUser: otherParticipant?.users
        ? {
            id: otherParticipant.users.id,
            first_name: otherParticipant.users.first_name,
            last_name: otherParticipant.users.last_name,
            avatar_path: otherParticipant.users.avatar_path,
            profession: otherParticipant.users.profession,
            category: otherParticipant.users.category,
            city: otherParticipant.users.city,
          }
        : null,
    };
  });

  result.sort((a, b) => {
    const aTime = a.lastMessageAt || a.updatedAt || a.createdAt;
    const bTime = b.lastMessageAt || b.updatedAt || b.createdAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return result;
}