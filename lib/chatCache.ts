// Работа без сети (Веха 70, шаги 2–3): переписка, люди, Стена помощи.
//
// На ТЕЛЕФОНЕ (не на сайте) храним ОГРАНИЧЕННЫЙ объём последнего
// (решение владельца: «не всё, а последнее»):
//  • список чатов — как его в последний раз отдал сервер;
//  • по каждому из 30 последних открытых диалогов — последние 50
//    сообщений, имя и аватар собеседника, отметку «очистить чат»;
//  • люди — первые 50 из списка + закладки «Мои» (до 50), без почты;
//  • Стена помощи — последние 20 постов ленты, без ссылок на фото.
// Без сети экраны показывают это сразу; с сетью — всё перечитывается
// с сервера и память перезаписывается (удаления, очистка, блокировка
// учитываются сами). Ссылки на фото/файлы НЕ храним (живут 1 час) —
// без сети вложение показывается подписью «доступно при подключении».
//
// Память привязана к тому, кто вошёл, и СТИРАЕТСЯ целиком при выходе
// из аккаунта (lib/offline.ts → startSignOutWatcher). На сайте не
// храним ничего (чужой компьютер, общий браузер).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import type { ChatListItem } from "../services/chatService";
import type { HelpFeedItem } from "../services/helpService";
import type { DirectoryUser } from "../services/userDirectoryService";
import type { ChatMessage } from "../services/messageService";
import { readLaunchMemory } from "./offline";

const ENABLED = Platform.OS !== "web";

const CHATS_PREFIX = "mingi.chats.v1:";
const PEOPLE_PREFIX = "mingi.people.v1:";
const FEED_PREFIX = "mingi.feed.v1:";

const MAX_PEOPLE = 50;
const MAX_SAVED_PEOPLE = 50;
const MAX_POSTS = 20;
const DIALOG_PREFIX = "mingi.dialog.v1:";
const DIALOG_INDEX_PREFIX = "mingi.dialogs.v1:";

const MAX_MESSAGES = 50;
const MAX_DIALOGS = 30;

export type CachedPeer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  is_deleted: boolean;
  last_seen_at: string | null;
};

export type CachedDialog = {
  userId: string; // кто вошёл
  chatId: string;
  otherProfile: CachedPeer | null;
  otherUnavailable: boolean;
  clearedAt: string | null;
  messages: ChatMessage[];
  savedAt: string;
};

async function myId(): Promise<string | null> {
  if (!ENABLED) return null;
  const memory = await readLaunchMemory();
  return memory?.userId ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// СПИСОК ЧАТОВ
export async function readChatsCache(): Promise<ChatListItem[] | null> {
  try {
    const uid = await myId();
    if (!uid) return null;
    const raw = await AsyncStorage.getItem(CHATS_PREFIX + uid);
    return raw ? (JSON.parse(raw) as ChatListItem[]) : null;
  } catch {
    return null;
  }
}

export async function saveChatsCache(chats: ChatListItem[]): Promise<void> {
  try {
    const uid = await myId();
    if (!uid) return;
    await AsyncStorage.setItem(CHATS_PREFIX + uid, JSON.stringify(chats));
  } catch {
    // память — удобство
  }
}

// ─────────────────────────────────────────────────────────────────────
// ДИАЛОГ
export async function readDialogCache(
  otherUserId: string,
): Promise<CachedDialog | null> {
  try {
    const uid = await myId();
    if (!uid || !otherUserId) return null;
    const raw = await AsyncStorage.getItem(
      `${DIALOG_PREFIX}${uid}:${otherUserId}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedDialog;
    return parsed?.userId === uid ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveDialogCache(
  otherUserId: string,
  data: Omit<CachedDialog, "userId" | "savedAt">,
): Promise<void> {
  try {
    const uid = await myId();
    if (!uid || !otherUserId || !data.chatId) return;

    // Последние 50, без ссылок на вложения (они всё равно протухают).
    const messages = data.messages.slice(-MAX_MESSAGES).map((m) => {
      const { attachmentUrl, ...rest } = m;
      return rest as ChatMessage;
    });

    const value: CachedDialog = {
      ...data,
      messages,
      userId: uid,
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      `${DIALOG_PREFIX}${uid}:${otherUserId}`,
      JSON.stringify(value),
    );

    // Учёт последних диалогов: свежий — в начало, лишние — стираем.
    const indexKey = DIALOG_INDEX_PREFIX + uid;
    const rawIndex = await AsyncStorage.getItem(indexKey);
    const index: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    const next = [otherUserId, ...index.filter((id) => id !== otherUserId)];
    const extra = next.slice(MAX_DIALOGS);
    if (extra.length > 0) {
      await AsyncStorage.multiRemove(
        extra.map((id) => `${DIALOG_PREFIX}${uid}:${id}`),
      );
    }
    await AsyncStorage.setItem(
      indexKey,
      JSON.stringify(next.slice(0, MAX_DIALOGS)),
    );
  } catch {
    // память — удобство
  }
}

export async function removeDialogCache(otherUserId: string): Promise<void> {
  try {
    const uid = await myId();
    if (!uid || !otherUserId) return;
    await AsyncStorage.removeItem(`${DIALOG_PREFIX}${uid}:${otherUserId}`);
  } catch {
    // ничего страшного
  }
}

// ─────────────────────────────────────────────────────────────────────
// ЛЮДИ
export type CachedPeople = {
  users: DirectoryUser[];
  favoriteIds: string[];
  total: number; // сколько всего в сообществе (для «Нас уже N»)
};

export async function readPeopleCache(): Promise<CachedPeople | null> {
  try {
    const uid = await myId();
    if (!uid) return null;
    const raw = await AsyncStorage.getItem(PEOPLE_PREFIX + uid);
    return raw ? (JSON.parse(raw) as CachedPeople) : null;
  } catch {
    return null;
  }
}

export async function savePeopleCache(
  allUsers: DirectoryUser[],
  favoriteIds: string[],
): Promise<void> {
  try {
    const uid = await myId();
    if (!uid) return;

    // Первые 50 по порядку списка + закладки (до 50), без повторов.
    const first = allUsers.slice(0, MAX_PEOPLE);
    const firstIds = new Set(first.map((u) => u.id));
    const saved = allUsers
      .filter((u) => favoriteIds.includes(u.id) && !firstIds.has(u.id))
      .slice(0, MAX_SAVED_PEOPLE);

    // Почту на телефон не кладём — в списке она не нужна.
    const users = [...first, ...saved].map((u) => ({ ...u, email: null }));

    const value: CachedPeople = {
      users,
      favoriteIds: favoriteIds.slice(0, MAX_SAVED_PEOPLE * 2),
      total: allUsers.length,
    };
    await AsyncStorage.setItem(PEOPLE_PREFIX + uid, JSON.stringify(value));
  } catch {
    // память — удобство
  }
}

// ─────────────────────────────────────────────────────────────────────
// СТЕНА ПОМОЩИ
export async function readFeedCache(): Promise<HelpFeedItem[] | null> {
  try {
    const uid = await myId();
    if (!uid) return null;
    const raw = await AsyncStorage.getItem(FEED_PREFIX + uid);
    return raw ? (JSON.parse(raw) as HelpFeedItem[]) : null;
  } catch {
    return null;
  }
}

export async function saveFeedCache(posts: HelpFeedItem[]): Promise<void> {
  try {
    const uid = await myId();
    if (!uid) return;
    // Последние 20; миниатюры фото — это ссылки, которые протухают.
    const value = posts
      .slice(0, MAX_POSTS)
      .map((p) => ({ ...p, thumbUrls: [] }));
    await AsyncStorage.setItem(FEED_PREFIX + uid, JSON.stringify(value));
  } catch {
    // память — удобство
  }
}

// ─────────────────────────────────────────────────────────────────────
// ПОЛНАЯ ОЧИСТКА — при выходе из аккаунта.
export async function clearChatCache(): Promise<void> {
  if (!ENABLED) return;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      (k) =>
        k.startsWith(CHATS_PREFIX) ||
        k.startsWith(PEOPLE_PREFIX) ||
        k.startsWith(FEED_PREFIX) ||
        k.startsWith(DIALOG_PREFIX) ||
        k.startsWith(DIALOG_INDEX_PREFIX),
    );
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // ничего страшного
  }
}
