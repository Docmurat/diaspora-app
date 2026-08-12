import { supabase } from '../lib/supabase';

export type ChatListItem = {
  chatId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
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


  if (!otherUserId) {
    throw new Error('Не передан userId собеседника');
  }

  if (otherUserId === myUserId) {
    throw new Error('Нельзя создать чат с самим собой');
  }

  const { data, error } = await supabase.rpc('get_or_create_direct_chat', {
    other_user_id: otherUserId,
  });


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
      cleared_at,
      last_read_at,
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

  // «Очистить чат» и пустые диалоги: показываем чат только если в нём
  // есть хотя бы одно сообщение НОВЕЕ моей отметки очистки. Пустой или
  // очищенный диалог прячется, пока кто-то не напишет снова.
  const clearedByChat = new Map<string, string | null>();
  const readByChat = new Map<string, string | null>();
  for (const row of participantRows || []) {
    clearedByChat.set((row as any).chat_id, (row as any).cleared_at || null);
    readByChat.set((row as any).chat_id, (row as any).last_read_at || null);
  }

  const chatRows = (participantRows || [])
    .map((row: any) => row.chats)
    .filter(Boolean)
    .filter((chat: any) => chat.chat_type === 'direct')
    .filter((chat: any) => {
      if (!chat.last_message_at) return false;
      const cleared = clearedByChat.get(chat.id);
      if (!cleared) return true;
      return (
        new Date(chat.last_message_at).getTime() >
        new Date(cleared).getTime()
      );
    });

  if (chatRows.length === 0) {
    return [];
  }

  const chatIds = chatRows.map((chat: any) => chat.id);

  // Непрочитанное: чужие сообщения новее моего last_read_at (и новее
  // отметки очистки). Один запрос на все чаты, счёт на месте.
  const unreadByChat = new Map<string, number>();
  try {
    // Лёгкий запрос: только хвост за 30 дней — метки нужны свежим
    // разговорам, гонять всю историю ради счётчика незачем.
    const monthAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: freshMessages } = await supabase
      .from('messages')
      .select('chat_id, sender_id, created_at')
      .in('chat_id', chatIds)
      .neq('sender_id', myUserId)
      .gt('created_at', monthAgo);

    for (const m of freshMessages || []) {
      const readAt = readByChat.get(m.chat_id);
      const clearedAt = clearedByChat.get(m.chat_id);
      const t = new Date(m.created_at).getTime();

      if (readAt && t <= new Date(readAt).getTime()) continue;
      if (clearedAt && t <= new Date(clearedAt).getTime()) continue;

      unreadByChat.set(m.chat_id, (unreadByChat.get(m.chat_id) || 0) + 1);
    }
  } catch {
    // счётчик — украшение, список важнее; при ошибке просто без цифр
  }

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
      unreadCount: unreadByChat.get(chat.id) || 0,
      // Анкета собеседника может быть скрыта правилами базы (вычищен
      // чистильщиком или отключён администрацией) — тогда берём хотя бы
      // его id из строки участника, чтобы диалог открывался для чтения.
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
        : otherParticipant
          ? {
              id: otherParticipant.user_id,
              first_name: null,
              last_name: null,
              avatar_path: null,
              profession: null,
              category: null,
              city: null,
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