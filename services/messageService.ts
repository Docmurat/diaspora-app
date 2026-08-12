import { supabase } from "../lib/supabase";
import { createNotification } from "./notificationService";

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
    throw new Error("Пользователь не авторизован");
  }

  return user.id;
}

export async function getMessages(
  chatId: string,
  // «Очистить чат»: сообщения не позднее этой отметки не показываем
  // (отметка лежит на строке участника, у собеседника своя).
  afterIso?: string | null,
): Promise<ChatMessage[]> {
  if (!chatId) {
    throw new Error("Не передан chatId");
  }

  let query = supabase
    .from("messages")
    .select(
      `
      id,
      chat_id,
      sender_id,
      text,
      created_at,
      updated_at,
      is_deleted
    `,
    )
    .eq("chat_id", chatId);

  if (afterIso) {
    query = query.gt("created_at", afterIso);
  }

  const { data, error } = await query.order("created_at", {
    ascending: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ChatMessage[];
}

export async function sendMessage(
  chatId: string,
  text: string,
): Promise<ChatMessage> {
  const senderId = await getCurrentUserId();


  if (!chatId) {
    throw new Error("Не передан chatId");
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Сообщение пустое");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      text: trimmedText,
    })
    .select(
      `
      id,
      chat_id,
      sender_id,
      text,
      created_at,
      updated_at,
      is_deleted
    `,
    )
    .single();


  if (error || !data) {
    throw new Error(error?.message || "Не удалось отправить сообщение");
  }

  // Уведомляем собеседников. Ошибка здесь не должна мешать отправке.
  try {
    const { data: participants } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("chat_id", chatId);

    const { data: me } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", senderId)
      .maybeSingle();

    const senderName =
      `${me?.first_name || ""} ${me?.last_name || ""}`.trim() || "Участник";

    for (const participant of participants || []) {
      if (participant.user_id === senderId) continue;

      await createNotification({
        userId: participant.user_id,
        type: "message",
        title: `Новое сообщение: ${senderName}`,
        body: trimmedText.slice(0, 140),
        link: `/chat?userId=${senderId}&name=${encodeURIComponent(senderName)}`,
      });
    }
  } catch (e) {
  }

  return data as ChatMessage;
}

export async function markChatAsRead(chatId: string): Promise<void> {
  const userId = await getCurrentUserId();

  if (!chatId) {
    throw new Error("Не передан chatId");
  }

  const { error } = await supabase
    .from("chat_participants")
    .update({
      last_read_at: new Date().toISOString(),
    })
    .eq("chat_id", chatId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

// Своей realtime-подписки здесь больше НЕТ: с вехи чата экран диалога
// слушает таблицу messages через services/liveService (самолечение общее,
// капкан Вехи 29 закрыт в самой службе).
