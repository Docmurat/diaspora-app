import { supabase } from '../lib/supabase';

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
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

export async function getMessages(chatId: string): Promise<ChatMessage[]> {
  if (!chatId) {
    throw new Error('Не передан chatId');
  }

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      chat_id,
      sender_id,
      text,
      created_at,
      updated_at,
      is_deleted
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ChatMessage[];
}

export async function sendMessage(chatId: string, text: string): Promise<ChatMessage> {
  const senderId = await getCurrentUserId();

  console.log('sendMessage service started');
  console.log('chatId:', chatId);
  console.log('senderId:', senderId);
  console.log('raw text:', text);

  if (!chatId) {
    throw new Error('Не передан chatId');
  }

  const trimmedText = text.trim();
  console.log('trimmedText:', trimmedText);

  if (!trimmedText) {
    throw new Error('Сообщение пустое');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      text: trimmedText,
    })
    .select(`
      id,
      chat_id,
      sender_id,
      text,
      created_at,
      updated_at,
      is_deleted
    `)
    .single();

  console.log('sendMessage insert data:', data);
  console.log('sendMessage insert error:', error);

  if (error || !data) {
    throw new Error(error?.message || 'Не удалось отправить сообщение');
  }

  return data as ChatMessage;
}

export async function markChatAsRead(chatId: string): Promise<void> {
  const userId = await getCurrentUserId();

  if (!chatId) {
    throw new Error('Не передан chatId');
  }

  const { error } = await supabase
    .from('chat_participants')
    .update({
      last_read_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

type SubscribeToMessagesParams = {
  chatId: string;
  onInsert: (message: ChatMessage) => void;
  onUpdate?: (message: ChatMessage) => void;
};

export function subscribeToMessages({
  chatId,
  onInsert,
  onUpdate,
}: SubscribeToMessagesParams) {
  const channel = supabase
    .channel(`messages:chat:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        onInsert(payload.new as ChatMessage);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        if (onUpdate) {
          onUpdate(payload.new as ChatMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}