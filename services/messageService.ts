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
  // Вложение (пусто у обычных текстовых сообщений).
  attachment_path: string | null;
  attachment_type: "image" | "file" | null;
  attachment_name: string | null;
  attachment_size: number | null;
  // Подписанная ссылка для показа/скачивания. Живёт 1 час, выдаётся
  // при каждой загрузке ленты — НЕ хранится в базе.
  attachmentUrl?: string | null;
};

// Что экран передаёт службе при отправке вложения.
export type OutgoingAttachment = {
  kind: "image" | "file";
  uri: string; // локальный адрес выбранного файла
  name: string; // человеческое имя (показываем в пузырьке)
  size?: number | null;
  mimeType?: string | null;
  // На вебе выбор документа отдаёт готовый объект File — надёжнее,
  // чем читать по uri.
  webFile?: Blob | null;
};

const BUCKET = "chat-attachments";
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // потолок полки — 15 МБ

// Лента грузит переписку страницами по 100: сперва хвост, затем — по
// прокрутке вверх (как в Телеграме) — экран сам просит более ранние.
export const MESSAGES_PAGE = 100;

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

const MESSAGE_FIELDS = `
  id,
  chat_id,
  sender_id,
  text,
  created_at,
  updated_at,
  is_deleted,
  attachment_path,
  attachment_type,
  attachment_name,
  attachment_size
`;

// Подписанные ссылки на вложения — одним запросом на пачку сообщений.
// Полка закрытая: голый путь не открывается, ссылка живёт 1 час.
// Ошибка подписи не роняет переписку: вложение покажется заглушкой.
async function attachSignedUrls(messages: ChatMessage[]): Promise<void> {
  const paths = messages
    .filter((m) => m.attachment_path && !m.is_deleted)
    .map((m) => m.attachment_path as string);

  if (paths.length === 0) return;

  try {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, 3600);

    const urlByPath = new Map<string, string>();
    for (const item of signed || []) {
      if (item.path && item.signedUrl) {
        urlByPath.set(item.path, item.signedUrl);
      }
    }

    for (const m of messages) {
      if (m.attachment_path) {
        m.attachmentUrl = urlByPath.get(m.attachment_path) || null;
      }
    }
  } catch {
    // без ссылок, но с текстами — лучше, чем ничего
  }
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
    .select(MESSAGE_FIELDS)
    .eq("chat_id", chatId);

  if (afterIso) {
    query = query.gt("created_at", afterIso);
  }

  // Берём ПОСЛЕДНИЕ MESSAGES_PAGE сообщений: сортируем от новых к
  // старым, режем, затем разворачиваем обратно в хронологию.
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE);

  if (error) {
    throw new Error(error.message);
  }

  const messages = ((data || []) as ChatMessage[]).reverse();
  await attachSignedUrls(messages);

  return messages;
}

// Страница более ранних сообщений — для подгрузки при прокрутке вверх.
// beforeIso — время самого старого уже показанного сообщения.
export async function getOlderMessages(
  chatId: string,
  beforeIso: string,
  afterIso?: string | null,
): Promise<ChatMessage[]> {
  if (!chatId || !beforeIso) {
    return [];
  }

  let query = supabase
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("chat_id", chatId)
    .lt("created_at", beforeIso);

  if (afterIso) {
    query = query.gt("created_at", afterIso);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE);

  if (error) {
    throw new Error(error.message);
  }

  const messages = ((data || []) as ChatMessage[]).reverse();
  await attachSignedUrls(messages);

  return messages;
}

// Уведомляем собеседников о новом сообщении. Ошибка здесь не должна
// мешать отправке — вызывающий заворачивает в try/catch.
async function notifyParticipants(
  chatId: string,
  senderId: string,
  bodyText: string,
) {
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
      body: bodyText.slice(0, 140),
      link: `/chat?userId=${senderId}&name=${encodeURIComponent(senderName)}`,
    });
  }
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
    .select(MESSAGE_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Не удалось отправить сообщение");
  }

  try {
    await notifyParticipants(chatId, senderId, trimmedText);
  } catch (e) {}

  return data as ChatMessage;
}

// Отправка вложения: файл — на закрытую полку chat-attachments
// (путь начинается с id чата — на этом держатся правила доступа),
// затем обычное сообщение с полями вложения. В text кладём подпись
// («📷 Фото» / «📎 имя») — она же превью в списке чатов и в
// уведомлении; сам пузырёк текст-подпись не показывает.
export async function sendAttachmentMessage(
  chatId: string,
  attachment: OutgoingAttachment,
): Promise<ChatMessage> {
  const senderId = await getCurrentUserId();

  if (!chatId) {
    throw new Error("Не передан chatId");
  }

  if (attachment.size != null && attachment.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Файл больше 15 МБ — выберите файл поменьше");
  }

  // Содержимое файла: на вебе документы приходят готовым File,
  // остальное читаем по локальному адресу.
  let blob: Blob;
  if (attachment.webFile) {
    blob = attachment.webFile;
  } else {
    const response = await fetch(attachment.uri);
    blob = await response.blob();
  }

  if (blob.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Файл больше 15 МБ — выберите файл поменьше");
  }

  // Имя в хранилище — только латиница/цифры (кириллица в путях Storage
  // капризна); человеческое имя сохраняем отдельно в attachment_name.
  const extMatch = attachment.name.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  const storageName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}${ext}`;
  const path = `${chatId}/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType:
        attachment.mimeType || blob.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Не удалось загрузить файл");
  }

  const text =
    attachment.kind === "image" ? "📷 Фото" : `📎 ${attachment.name}`;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      text,
      attachment_path: path,
      attachment_type: attachment.kind,
      attachment_name: attachment.name,
      attachment_size: attachment.size ?? blob.size ?? null,
    })
    .select(MESSAGE_FIELDS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Не удалось отправить вложение");
  }

  try {
    await notifyParticipants(chatId, senderId, text);
  } catch (e) {}

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
