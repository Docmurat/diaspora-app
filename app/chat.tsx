import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
} from "react-native-svg";

import {
  readDialogCache,
  removeDialogCache,
  saveDialogCache,
} from "../lib/chatCache";
import {
  DEMO_ME_ID,
  getDemoMessages,
  getDemoUser,
  isDemoId,
} from "../lib/demoData";
import { useOnline } from "../lib/offline";
import { supabase } from "../lib/supabase";
import { useSmartKeyboard } from "../lib/useSmartKeyboard";
import { getOrCreateDirectChat } from "../services/chatService";
import { subscribeToChanges } from "../services/liveService";
import {
  ChatMessage,
  MESSAGES_PAGE,
  getMessages,
  getOlderMessages,
  markChatAsRead,
  sendAttachmentMessage,
  sendMessage,
} from "../services/messageService";
import { getMyProfile } from "../services/profileService";
import { hasMutualBlock } from "../services/userBlockService";

import { dateLocale, t, useLanguage } from "../services/i18nService";
type OtherProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  is_deleted: boolean;
  last_seen_at: string | null;
};

// Размер файла человеческим языком («340 КБ», «2.4 МБ»).
function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} ${t("chat.unit.kb")}`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("chat.unit.mb")}`;
}

export default function ChatScreen() {
  const lang = useLanguage(); // перерисовка при смене языка
  useSmartKeyboard(); // Веха 69: «умная клавиатура» включена на этом экране
  const params = useLocalSearchParams();
  const paramName = String(params.name || "");
  const otherUserId = String(params.userId || "");
  // Придуманный собеседник витрины демо-режима (lib/demoData):
  // переписка только для чтения, на сервер ничего не уходит.
  const isDemoDialog = isDemoId(otherUserId);
  const demoOffText =
    lang === "en"
      ? "Sending is turned off in demo mode"
      : "В демо-режиме отправка отключена";

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });
  const insets = useSafeAreaInsets();

  // Веха 69 «Клавиатура-2» (как в Telegram): капсула ввода едет вместе с
  // клавиатурой и садится ровно на её верхний край. Пока клавиатура
  // закрыта, под капсулой — запас под системную полоску; с открытой
  // клавиатурой он плавно исчезает (иначе между капсулой и клавиатурой
  // висела бы пустая щель).
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const dockSpacerStyle = useAnimatedStyle(() => ({
    height: insets.bottom * (1 - keyboardProgress.value),
  }));

  const scrollViewRef = useRef<ScrollView>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const myUserIdRef = useRef<string>("");
  const chatIdRef = useRef<string>("");
  // «Очистить чат»: отметка на СВОЕЙ строке участника; сообщения старше
  // неё для меня невидимы, у собеседника всё остаётся.
  const clearedAtRef = useRef<string | null>(null);

  // Подгрузка истории при прокрутке вверх (как в Телеграме):
  // hasMoreRef — есть ли на сервере что-то старше показанного;
  // scrollOffsetRef / contentHeightRef — текущее положение ленты;
  // pendingRestoreRef — «якорь», чтобы после вклейки старых сообщений
  // лента осталась на том же месте, а не прыгнула.
  const hasMoreRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  // Лента стоит у последнего сообщения? Тогда при открытии клавиатуры
  // держим низ переписки на виду (как в Telegram), иначе не трогаем —
  // человек читает историю.
  const nearBottomRef = useRef(true);
  const pendingRestoreRef = useRef<null | {
    prevHeight: number;
    prevOffset: number;
  }>(null);

  const [chatId, setChatId] = useState<string>("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null);
  // Собеседник скрыт правилами базы (вычищен чистильщиком или отключён
  // администрацией) — переписка остаётся читаемой, писать нельзя.
  const [otherUnavailable, setOtherUnavailable] = useState(false);
  // Блокировка закрывает переписку в обе стороны. Исключение — основатель.
  const [blocked, setBlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // «Очистить чат» — вторым нажатием (Alert в браузере не работает).
  const [clearArmed, setClearArmed] = useState(false);
  // Тикает раз в минуту, чтобы подпись «в сети / был(а)…» не застывала.
  const [presenceTick, setPresenceTick] = useState(0);
  // Вложения: меню скрепки, крутилка отправки, ошибка плашкой
  // (Alert на вебе не работает — показываем текст над капсулой).
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  // Веха 70: переписка показана из памяти телефона (без сети).
  const [fromCache, setFromCache] = useState(false);
  const fromCacheRef = useRef(false);
  // Счётчик повторной загрузки, когда вернулась сеть.
  const [reconnectTick, setReconnectTick] = useState(0);
  const isOnline = useOnline();

  const headerName = useMemo(() => {
    const full = `${otherProfile?.first_name || ""} ${
      otherProfile?.last_name || ""
    }`.trim();

    if (full) return full;
    if (paramName) return paramName;
    return t("chats.deletedMember");
  }, [otherProfile, paramName, lang]);

  const groupedMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      mine: message.sender_id === myUserIdRef.current,
    }));
  }, [messages]);

  // Формула владельца: в сети → «в сети»; до 6 часов — точное время;
  // свыше 6 часов, но сегодня — «сегодня»; вчера — «вчера»; до недели —
  // «на неделе»; старше — «давно».
  const lastSeenLabel = useMemo(() => {
    void presenceTick; // пересчитываем по таймеру
    const raw = otherProfile?.last_seen_at;
    if (!raw) return "";

    const seen = new Date(raw);
    const now = new Date();
    const diffMs = now.getTime() - seen.getTime();

    if (diffMs < 3 * 60 * 1000) return t("chat.status.online");

    if (diffMs <= 6 * 60 * 60 * 1000) {
      return t("chat.status.seenAt", {
        "ЧЧ:ММ": seen.toLocaleTimeString(dateLocale(), {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }

    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round(
      (startOfDay(now) - startOfDay(seen)) / (24 * 60 * 60 * 1000),
    );

    if (dayDiff === 0) return t("chat.status.seenToday");
    if (dayDiff === 1) return t("chat.status.seenYesterday");
    if (dayDiff <= 7) return t("chat.status.seenWeek");
    return t("chat.status.seenLongAgo");
  }, [otherProfile, presenceTick, lang]);

  // Тихо перечитать last_seen_at собеседника (живое событие или таймер).
  const refreshOtherPresence = async () => {
    if (!otherUserId) return;
    try {
      const { data } = await supabase
        .from("users")
        .select(
          "id, first_name, last_name, avatar_path, is_deleted, last_seen_at",
        )
        .eq("id", otherUserId)
        .maybeSingle();
      if (data) setOtherProfile(data as OtherProfile);
    } catch {
      // не мешаем переписке
    }
  };

  // Пока диалог открыт, уведомления «Новое сообщение» от этого собеседника
  // не гасим, а СТИРАЕМ (Веха 65, решение владельца): то, что человек
  // видит глазами, не должно засорять список уведомлений — ни
  // непрочитанным, ни прочитанным. Заодно это сигнал почтальону пушей:
  // запись исчезла за 3 секунды → пуш о сообщении не отправляется.
  const muteThisChatNotifications = async () => {
    const myId = myUserIdRef.current;
    if (!myId || !otherUserId) return;
    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("user_id", myId)
        .like("link", `/chat?userId=${otherUserId}%`);
    } catch {
      // правило базы «свои уведомления правит хозяин» уже стоит (delete)
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  };

  // Веха 70: запомнить диалог на телефоне (последние 50 сообщений).
  const otherProfileRef = useRef<OtherProfile | null>(null);
  const otherUnavailableRef = useRef(false);
  const persistDialog = (list: ChatMessage[]) => {
    if (!chatIdRef.current || !otherUserId) return;
    saveDialogCache(otherUserId, {
      chatId: chatIdRef.current,
      otherProfile: otherProfileRef.current,
      otherUnavailable: otherUnavailableRef.current,
      clearedAt: clearedAtRef.current,
      messages: list,
    });
  };

  // Тихая перезагрузка ХВОСТА ленты (образец Вехи 42): без крутилки,
  // при ошибке сети список не сбрасывается. Уже подгруженную старую
  // историю НЕ выбрасываем — подклеиваем свежий хвост к ней.
  const reloadMessages = async () => {
    const id = chatIdRef.current;
    if (!id) return;

    try {
      const fresh = await getMessages(id, clearedAtRef.current);

      setMessages((prev) => {
        if (fresh.length === 0) return prev.length === 0 ? prev : [];

        const freshIds = new Set(fresh.map((m) => m.id));
        const freshOldest = new Date(fresh[0].created_at).getTime();

        // Оставляем из прежнего списка только то, что старше свежего
        // хвоста и не дублируется, — история, догруженная прокруткой.
        const keptOlder = prev.filter(
          (m) =>
            !freshIds.has(m.id) &&
            new Date(m.created_at).getTime() < freshOldest,
        );

        const merged = [...keptOlder, ...fresh];
        persistDialog(merged);
        return merged;
      });

      await markChatAsRead(id);
      await muteThisChatNotifications();
    } catch {
      // Живое обновление само повторит попытку при следующем событии.
    }
  };

  // Догрузка более ранней страницы, когда лента доехала до верха.
  const loadOlderMessages = async () => {
    const id = chatIdRef.current;
    if (!id || loadingOlderRef.current || !hasMoreRef.current) return;

    const current = messages;
    if (current.length === 0) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);

    try {
      const older = await getOlderMessages(
        id,
        current[0].created_at,
        clearedAtRef.current,
      );

      if (older.length < MESSAGES_PAGE) {
        hasMoreRef.current = false; // дальше вглубь истории пусто
      }

      if (older.length > 0) {
        // Якорь: запоминаем высоту и положение, чтобы после вклейки
        // вернуть ленту ровно на то же место (см. onContentSizeChange).
        pendingRestoreRef.current = {
          prevHeight: contentHeightRef.current,
          prevOffset: scrollOffsetRef.current,
        };
        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const cleanOlder = older.filter((m) => !prevIds.has(m.id));
          return [...cleanOlder, ...prev];
        });
      }
    } catch {
      // не вышло — попробуем при следующем докручивании
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    const initChat = async () => {
      if (isDemoId(otherUserId)) {
        const demoUser = getDemoUser(otherUserId);
        myUserIdRef.current = DEMO_ME_ID;
        const profile: OtherProfile | null = demoUser
          ? {
              id: demoUser.id,
              first_name: demoUser.first_name,
              last_name: demoUser.last_name,
              avatar_path: demoUser.avatar_path,
              is_deleted: false,
              // Азамат «в сети», остальные заходили пару часов назад.
              last_seen_at: new Date(
                Date.now() -
                  (otherUserId === "demo-u01" ? 0 : 2 * 60 * 60 * 1000),
              ).toISOString(),
            }
          : null;
        setOtherProfile(profile);
        otherProfileRef.current = profile;
        setMessages(getDemoMessages(otherUserId));
        hasMoreRef.current = false;
        setLoading(false);
        return;
      }

      // Веха 70: сначала — переписка из памяти телефона. Показываем её
      // сразу (и без сети тоже), а свежую догружаем с сервера поверх.
      const cached = fromCacheRef.current ? null : await readDialogCache(otherUserId);
      if (cached) {
        myUserIdRef.current = cached.userId;
        chatIdRef.current = cached.chatId;
        clearedAtRef.current = cached.clearedAt;
        otherProfileRef.current = cached.otherProfile;
        otherUnavailableRef.current = cached.otherUnavailable;
        setOtherProfile(cached.otherProfile);
        setOtherUnavailable(cached.otherUnavailable);
        setMessages(cached.messages);
        hasMoreRef.current = false; // без сети глубже не листаем
        fromCacheRef.current = true;
        setFromCache(true);
        setLoading(false);
      }

      try {
        if (!fromCacheRef.current) setLoading(true);
        setScreenError("");

        if (!otherUserId) {
          throw new Error(t("chat.error.noPeer"));
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user?.id) {
          throw new Error(t("chat.error.noAuth"));
        }

        myUserIdRef.current = user.id;

        // Анкета собеседника: имя, аватар, признак удаления. Если правила
        // базы её прячут (вычищен или отключён) — диалог только для чтения.
        try {
          const { data: other } = await supabase
            .from("users")
            .select(
              "id, first_name, last_name, avatar_path, is_deleted, last_seen_at",
            )
            .eq("id", otherUserId)
            .maybeSingle();

          if (other) {
            setOtherProfile(other as OtherProfile);
            otherProfileRef.current = other as OtherProfile;
            if ((other as OtherProfile).is_deleted) {
              setOtherUnavailable(true);
              otherUnavailableRef.current = true;
            }
          } else {
            setOtherUnavailable(true);
            otherUnavailableRef.current = true;
          }
        } catch {
          setOtherUnavailable(true);
          otherUnavailableRef.current = true;
        }

        // Личная блокировка: поле ввода пропадает без пояснений
        // (решение владельца, Веха 17).
        try {
          const [relation, myProfile] = await Promise.all([
            hasMutualBlock(otherUserId),
            getMyProfile().catch(() => null),
          ]);

          const isFounder = myProfile?.role === "owner";

          if (relation?.isAnyBlocked && !isFounder) {
            // Блокировка — переписку с телефона тоже убираем.
            removeDialogCache(otherUserId);
            setMessages([]);
            fromCacheRef.current = false;
            setFromCache(false);
            setBlocked(true);
            setLoading(false);
            return;
          }
        } catch {
          // Не удалось проверить блокировку — не мешаем чтению.
        }

        const directChatId = await getOrCreateDirectChat(otherUserId);
        chatIdRef.current = directChatId;
        setChatId(directChatId);

        try {
          const { data: myRow } = await supabase
            .from("chat_participants")
            .select("cleared_at")
            .eq("chat_id", directChatId)
            .eq("user_id", user.id)
            .maybeSingle();
          clearedAtRef.current = myRow?.cleared_at || null;
        } catch {
          clearedAtRef.current = null;
        }

        const initialMessages = await getMessages(
          directChatId,
          clearedAtRef.current,
        );
        setMessages(initialMessages);
        // Ровно полная страница — на сервере, скорее всего, есть ещё.
        hasMoreRef.current = initialMessages.length >= MESSAGES_PAGE;
        // Свежая переписка с сервера — запоминаем, память больше не нужна.
        fromCacheRef.current = false;
        setFromCache(false);
        persistDialog(initialMessages);

        await markChatAsRead(directChatId);
        await muteThisChatNotifications();

        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }

        // Живое обновление через liveService (Веха 41): самолечение общее,
        // уникальное имя канала делает сама служба.
        unsubscribeRef.current = subscribeToChanges(
          "chat-dialog",
          [
            {
              table: "messages",
              filter: { column: "chat_id", value: directChatId },
            },
            // Запись собеседника: статус «в сети / был(а)…» меняется живьём
            // (сердцебиение пишет last_seen_at — приходит событие).
            { table: "users", filter: { column: "id", value: otherUserId } },
          ],
          () => {
            reloadMessages();
            refreshOtherPresence();
          },
        );
      } catch (e) {
        // Переписка из памяти уже на экране — остаёмся на ней молча
        // (о сети скажет плашка «Нет соединения»).
        if (!fromCacheRef.current) {
          const message = e instanceof Error ? e.message : t("chat.error.open");
          setScreenError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [otherUserId, reconnectTick]);

  // Сеть вернулась, а на экране переписка из памяти — догружаем свежую.
  useEffect(() => {
    if (isOnline && fromCacheRef.current) {
      setReconnectTick((n) => n + 1);
    }
  }, [isOnline]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPresenceTick((t) => t + 1);
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading]);

  // К низу прокручиваем ТОЛЬКО когда меняется ПОСЛЕДНЕЕ сообщение
  // (пришло/ушло новое). Вклейка старой истории сверху последнее не
  // меняет — лента остаётся на месте (якорь в onContentSizeChange).
  const lastMessageId = messages.length ? messages[messages.length - 1].id : "";

  useEffect(() => {
    if (lastMessageId) {
      scrollToBottom(true);
    }
  }, [lastMessageId]);

  const handleClearChat = async () => {
    const id = chatIdRef.current;
    const myId = myUserIdRef.current;
    if (!id || !myId) return;

    try {
      const stamp = new Date().toISOString();
      const { error } = await supabase
        .from("chat_participants")
        .update({ cleared_at: stamp })
        .eq("chat_id", id)
        .eq("user_id", myId);

      if (!error) {
        clearedAtRef.current = stamp;
        setMessages([]);
        hasMoreRef.current = false; // старше отметки очистки не показываем
        persistDialog([]);
      }
    } catch {
      // не получилось — сообщения просто остаются на месте
    } finally {
      setClearArmed(false);
      setMenuOpen(false);
    }
  };

  const handleSend = async () => {
    if (isDemoDialog) {
      setAttachError(demoOffText);
      return;
    }
    if (sending || uploading || !chatId || !input.trim()) {
      return;
    }

    const textToSend = input.trim();
    setInput("");
    setSending(true);
    setAttachError("");

    try {
      await sendMessage(chatId, textToSend);
      await markChatAsRead(chatId);
      await reloadMessages();
    } catch {
      // Возвращаем текст в поле, чтобы не потерялся.
      setInput(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Общая отправка выбранного вложения: крутилка на скрепке,
  // ошибка — плашкой над капсулой (Alert на вебе не работает).
  const doSendAttachment = async (attachment: {
    kind: "image" | "file";
    uri: string;
    name: string;
    size?: number | null;
    mimeType?: string | null;
    webFile?: Blob | null;
  }) => {
    if (!chatId || uploading) return;

    setUploading(true);
    setAttachError("");

    try {
      await sendAttachmentMessage(chatId, attachment);
      await markChatAsRead(chatId);
      await reloadMessages();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("chat.error.attach");
      setAttachError(message);
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    setAttachMenuOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Ужимаем фото ПЕРЕД отправкой (образец аватаров): до 1600 px по
      // длинной стороне + JPEG 80% — снимок с камеры в 3–4 МБ
      // превращается в сотни КБ без видимой потери. Если ужать не
      // вышло — шлём как есть, потолок 15 МБ подстрахует.
      let uploadUri = asset.uri;
      let uploadName = "photo.jpg";
      let uploadMime = "image/jpeg";
      let uploadSize: number | null = null;

      try {
        const w = asset.width || 0;
        const h = asset.height || 0;
        const longest = Math.max(w, h);
        const actions =
          longest > 1600
            ? [
                w >= h
                  ? { resize: { width: 1600 } }
                  : { resize: { height: 1600 } },
              ]
            : [];

        const shrunk = await ImageManipulator.manipulateAsync(
          asset.uri,
          actions,
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          },
        );
        uploadUri = shrunk.uri;
      } catch {
        uploadName = asset.fileName || "photo.jpg";
        uploadMime = asset.mimeType || "image/jpeg";
        uploadSize = asset.fileSize ?? null;
      }

      await doSendAttachment({
        kind: "image",
        uri: uploadUri,
        name: uploadName,
        size: uploadSize,
        mimeType: uploadMime,
        webFile: null,
      });
    } catch {
      setAttachError(t("chat.error.pickPhoto"));
    }
  };

  const handlePickDocument = async () => {
    setAttachMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      await doSendAttachment({
        kind: "file",
        uri: asset.uri,
        name: asset.name || "file",
        size: asset.size ?? null,
        mimeType: asset.mimeType || null,
        webFile: (asset as any).file ?? null,
      });
    } catch {
      setAttachError(t("chat.error.pickFile"));
    }
  };

  // Открыть/скачать вложение: на вебе — новая вкладка, на телефоне —
  // системный просмотрщик по подписанной ссылке.
  const openAttachment = (url?: string | null) => {
    if (!url) return;
    if (Platform.OS === "web") {
      (window as any).open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  if (screenError) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>{t("chat.error.open")}</Text>
        <Text style={styles.errorText}>{screenError}</Text>

        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.errorButtonText}>{t("common.back")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const canWrite = !blocked && !otherUnavailable;

  // Вложение в переписке из памяти (без сети): ссылки нет — честно
  // говорим, что оно откроется при подключении (а не «удалено»).
  // ⚠️ Перевод пока здесь; карачаевский — от владельца, потом в словарь.
  const offlineAttachText = (kind: "photo" | "file") =>
    lang === "en"
      ? kind === "photo"
        ? "📷 Photo — available when online"
        : "Available when online"
      : kind === "photo"
        ? "📷 Фото — доступно при подключении"
        : "Доступно при подключении";

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}

        {otherProfile?.avatar_path ? (
          <Image
            source={{ uri: otherProfile.avatar_path }}
            style={styles.headerAvatarImage}
          />
        ) : (
          <View
            style={[
              styles.headerAvatar,
              otherUnavailable && styles.headerAvatarMuted,
            ]}
          >
            <Text style={styles.headerAvatarText}>
              {headerName[0]?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.7}
          disabled={otherUnavailable}
          onPress={() =>
            router.push({
              pathname: "/user-profile",
              params: { id: otherUserId, name: headerName },
            })
          }
        >
          <Text style={styles.headerName} numberOfLines={1}>
            {headerName}
          </Text>
          <Text style={styles.headerStatus}>
            {otherUnavailable
              ? t("chat.status.unavailable")
              : lastSeenLabel || t("chat.status.private")}
          </Text>
        </TouchableOpacity>

        {isDemoDialog ? (
          <View style={styles.menuButton} />
        ) : (
          <TouchableOpacity
            style={styles.menuButton}
            activeOpacity={0.7}
            onPress={() => setMenuOpen((v) => !v)}
          >
            <Text style={styles.menuButtonText}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>

      {menuOpen && (
        <>
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => {
              setMenuOpen(false);
              setClearArmed(false);
            }}
          />
          <View style={styles.menuCard}>
            {/* У недоступного собеседника профиля и жалобы нет —
                остаётся только очистка (убрать диалог из списка). */}
            {!otherUnavailable && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push({
                      pathname: "/user-profile",
                      params: { id: otherUserId, name: headerName },
                    });
                  }}
                >
                  <Text style={styles.menuItemText}>
                    {t("chat.menu.openProfile")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push({
                      pathname: "/report-user",
                      params: {
                        id: otherUserId,
                        userId: otherUserId,
                        name: headerName,
                      },
                    });
                  }}
                >
                  <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                    {t("profile.report")}
                  </Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />
              </>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                if (clearArmed) {
                  handleClearChat();
                } else {
                  setClearArmed(true);
                }
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                {clearArmed
                  ? t("chat.menu.clearConfirm")
                  : t("chat.menu.clear")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Веха 69: всё под шапкой поджимается над клавиатурой — лента
          становится короче, капсула встаёт на край клавиатуры, шапка
          остаётся на месте. */}
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardBody}>
      {/* Внутренняя рамка: капсула прижата к ЕЁ низу, а рамка
          кончается ровно над клавиатурой. */}
      <View style={styles.keyboardBody}>
      <View style={styles.messagesArea}>
        {/* Фоновая фактура ленты: двуглавый Эльбрус + текмет, тонкая
            линия фирменной зелени. Узор неподвижен — сообщения
            проезжают по нему, как по бумаге. */}
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
        >
          <Defs>
            <Pattern
              id="mingiChatPattern"
              width="90"
              height="64"
              patternUnits="userSpaceOnUse"
            >
              {/* Вариант А — горная цепь: ряды двуглавых вершин со
                  сдвигом в шахматном порядке (выбор владельца) */}
              <Path
                d="M0 40 L14 22 L23 31 L34 18 L48 40 L90 40"
                stroke="#5D8C78"
                strokeOpacity="0.11"
                strokeWidth="1.1"
                fill="none"
              />
              <Path
                d="M-45 72 L-31 54 L-22 63 L-11 50 L3 72 L45 72 M45 72 L59 54 L68 63 L79 50 L93 72 L135 72"
                stroke="#5D8C78"
                strokeOpacity="0.11"
                strokeWidth="1.1"
                fill="none"
              />
            </Pattern>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#mingiChatPattern)"
          />
        </Svg>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          onLayout={() => {
            // Окно ленты сжалось (выехала клавиатура) — если были внизу,
            // остаёмся внизу: последние сообщения видны над капсулой.
            if (nearBottomRef.current) {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            scrollOffsetRef.current = y;
            const { layoutMeasurement, contentSize } = e.nativeEvent;
            nearBottomRef.current =
              y + layoutMeasurement.height >= contentSize.height - 120;
            // Доехали до верха — тихо просим более раннюю страницу.
            if (y < 60) {
              loadOlderMessages();
            }
          }}
          onContentSizeChange={(_w, h) => {
            const pending = pendingRestoreRef.current;
            if (pending) {
              // Вклеили старую страницу сверху: возвращаем ленту на
              // прежнее место (насколько выросла высота — настолько
              // и сдвигаем), без анимации — глазу незаметно.
              pendingRestoreRef.current = null;
              scrollViewRef.current?.scrollTo({
                y: h - pending.prevHeight + pending.prevOffset,
                animated: false,
              });
            }
            contentHeightRef.current = h;
          }}
        >
          {loadingOlder && (
            <View style={styles.olderLoader}>
              <ActivityIndicator size="small" color="#69B78D" />
            </View>
          )}

          {groupedMessages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>
                {t("chats.noMessagesPreview")}
              </Text>
              <Text style={styles.emptySubtext}>{t("chat.empty.hint")}</Text>
            </View>
          ) : (
            groupedMessages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  message.mine
                    ? styles.myMessageWrapper
                    : styles.otherMessageWrapper,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    message.mine ? styles.myMessage : styles.otherMessage,
                  ]}
                >
                  {message.is_deleted ? (
                    <Text
                      style={[
                        styles.messageText,
                        message.mine && styles.myMessageText,
                        styles.deletedText,
                      ]}
                    >
                      {t("chat.msg.deleted")}
                    </Text>
                  ) : message.attachment_type === "image" ? (
                    // Фото: предпросмотр в пузырьке, нажатие — полный размер.
                    message.attachmentUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openAttachment(message.attachmentUrl)}
                      >
                        <Image
                          source={{ uri: message.attachmentUrl }}
                          style={styles.imageAttachment}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          message.mine && styles.myMessageText,
                          styles.deletedText,
                        ]}
                      >
                        {fromCache
                          ? offlineAttachText("photo")
                          : t("chat.attach.photoGone")}
                      </Text>
                    )
                  ) : message.attachment_type === "file" ? (
                    // Документ: строка с именем и размером, нажатие — скачать.
                    <TouchableOpacity
                      style={styles.fileRow}
                      activeOpacity={0.8}
                      disabled={!message.attachmentUrl}
                      onPress={() => openAttachment(message.attachmentUrl)}
                    >
                      <View
                        style={[
                          styles.fileIcon,
                          message.mine && styles.fileIconMine,
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={22}
                          color={message.mine ? "#FFFFFF" : "#3F6B5B"}
                        />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text
                          style={[
                            styles.messageText,
                            message.mine && styles.myMessageText,
                            styles.fileName,
                          ]}
                          numberOfLines={2}
                        >
                          {message.attachment_name || t("chat.attach.file")}
                        </Text>
                        <Text
                          style={[
                            styles.fileMeta,
                            message.mine && styles.fileMetaMine,
                          ]}
                        >
                          {message.attachmentUrl
                            ? [
                                formatSize(message.attachment_size),
                                t("chat.attach.download"),
                              ]
                                .filter(Boolean)
                                .join(" · ")
                            : fromCache
                              ? offlineAttachText("file")
                              : t("chat.attach.fileGone")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        message.mine && styles.myMessageText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  )}

                  <Text
                    style={[
                      styles.messageTime,
                      message.mine && styles.myMessageTime,
                    ]}
                  >
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {canWrite && (
        <View
          pointerEvents="box-none"
          style={styles.inputDock}
        >
          {/* Дымка под капсулой: белый снизу → прозрачный сверху
              (образец MingiTabBar, Веха 36; свой id градиента). */}
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
          >
            <Defs>
              <LinearGradient
                id="mingiChatInputFade"
                x1="0"
                y1="1"
                x2="0"
                y2="0"
              >
                <Stop offset="0" stopColor="#F4FAF4" stopOpacity="1" />
                <Stop offset="0.55" stopColor="#F4FAF4" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#F4FAF4" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#mingiChatInputFade)"
            />
          </Svg>

          {/* Ошибка отправки вложения — плашкой над капсулой. */}
          {attachError ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAttachError("")}
            >
              <Text style={styles.attachErrorText}>{attachError}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Меню скрепки: Фото / Документ. */}
          {attachMenuOpen && (
            <View style={styles.attachMenuCard}>
              <TouchableOpacity
                style={styles.attachMenuItem}
                activeOpacity={0.7}
                onPress={handlePickImage}
              >
                <Ionicons name="image-outline" size={20} color="#3F6B5B" />
                <Text style={styles.attachMenuItemText}>
                  {t("chat.attach.photo")}
                </Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.attachMenuItem}
                activeOpacity={0.7}
                onPress={handlePickDocument}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#3F6B5B"
                />
                <Text style={styles.attachMenuItemText}>
                  {t("chat.attach.doc")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputCapsule}>
            {/* Скрепка. Пока файл летит на сервер — крутилка. */}
            <TouchableOpacity
              style={styles.attachButton}
              activeOpacity={0.7}
              disabled={uploading || sending}
              onPress={() =>
                isDemoDialog
                  ? setAttachError(demoOffText)
                  : setAttachMenuOpen((v) => !v)
              }
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#69B78D" />
              ) : (
                <Ionicons name="attach" size={24} color="#4E7364" />
              )}
            </TouchableOpacity>

            <TextInput
              placeholder={t("chat.inputPh")}
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={input}
              onChangeText={setInput}
              multiline
              editable={!sending && !uploading}
              onKeyPress={(e: any) => {
                // На сайте Enter по-прежнему отправляет,
                // Shift+Enter — новая строка. На телефоне Enter —
                // перенос, отправка — кнопкой.
                if (
                  Platform.OS === "web" &&
                  e.nativeEvent.key === "Enter" &&
                  !e.nativeEvent.shiftKey
                ) {
                  e.preventDefault?.();
                  handleSend();
                }
              }}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (sending || uploading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={sending || uploading}
              activeOpacity={0.85}
            >
              <Text style={styles.sendButtonText}>{sending ? "…" : "→"}</Text>
            </TouchableOpacity>
          </View>

          {/* Запас под системную полоску — тает, когда выезжает клавиатура */}
          <Reanimated.View style={dockSpacerStyle} />
        </View>
      )}
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
  },

  errorTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 22,
    color: "#3F6B5B",
    marginBottom: 10,
    textAlign: "center",
  },

  errorText: {
    fontSize: 14.5,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },

  errorButton: {
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  errorButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.28)",
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  backButtonText: {
    fontSize: 22,
    color: "#3F6B5B",
    fontWeight: "600",
  },

  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(105,183,141,0.92)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  headerAvatarMuted: {
    backgroundColor: "#B9C8BF",
  },

  headerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
    backgroundColor: "#EAF4EE",
  },

  headerAvatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  // Имя — обычным шрифтом, как в списке чатов (Веха 66; окно диалога
  // доведено в Вехе 67, решение владельца 10.09).
  headerName: {
    fontSize: 16.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  headerStatus: {
    fontSize: 12,
    color: "#8FA79A",
    marginTop: 2,
  },

  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },

  menuButtonText: {
    fontSize: 22,
    color: "#3F6B5B",
    fontWeight: "600",
  },

  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },

  menuCard: {
    position: "absolute",
    top: 96,
    right: 14,
    zIndex: 21,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingVertical: 4,
    minWidth: 200,
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  menuItemText: {
    fontSize: 14.5,
    color: "#2F4A3C",
    fontWeight: "600",
  },

  menuItemDanger: {
    color: "#C05B4D",
  },

  menuDivider: {
    height: 0.75,
    backgroundColor: "rgba(93,140,120,0.18)",
    marginHorizontal: 12,
  },

  messagesArea: {
    flex: 1,
    backgroundColor: "#F4FAF4",
  },

  messagesContainer: {
    padding: 14,
    // Запас снизу под парящую капсулу ввода (образец Вехи 36).
    paddingBottom: 110,
    flexGrow: 1,
  },

  // Маленькая крутилка сверху при догрузке ранней истории.
  olderLoader: {
    paddingVertical: 10,
    alignItems: "center",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 20,
    color: "#3F6B5B",
    marginBottom: 8,
    textAlign: "center",
  },

  emptySubtext: {
    fontSize: 14,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 20,
  },

  messageWrapper: {
    marginBottom: 10,
    flexDirection: "row",
  },

  myMessageWrapper: {
    justifyContent: "flex-end",
  },

  otherMessageWrapper: {
    justifyContent: "flex-start",
  },

  messageBubble: {
    maxWidth: "78%",
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },

  myMessage: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderBottomRightRadius: 6,
  },

  otherMessage: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    borderBottomLeftRadius: 6,
  },

  messageText: {
    color: "#2F4A3C",
    fontSize: 15,
    lineHeight: 20,
  },

  myMessageText: {
    color: "#FFFFFF",
  },

  deletedText: {
    fontStyle: "italic",
    opacity: 0.7,
  },

  messageTime: {
    fontSize: 11,
    color: "#8FA79A",
    marginTop: 6,
    alignSelf: "flex-end",
  },

  myMessageTime: {
    color: "rgba(255,255,255,0.85)",
  },

  // Фото в пузырьке: скруглённый предпросмотр, нажатие — полный размер.
  imageAttachment: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: "#EAF4EE",
  },

  // Документ в пузырьке: иконка + имя + размер.
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 180,
  },

  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(105,183,141,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  fileIconMine: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  fileInfo: {
    flex: 1,
    minWidth: 0,
  },

  fileName: {
    fontWeight: "600",
  },

  fileMeta: {
    fontSize: 12,
    color: "#8FA79A",
    marginTop: 2,
  },

  fileMetaMine: {
    color: "rgba(255,255,255,0.85)",
  },

  // Ошибка отправки вложения над капсулой (нажатие — скрыть).
  attachErrorText: {
    alignSelf: "center",
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(192,91,77,0.45)",
    color: "#C05B4D",
    fontSize: 13,
    overflow: "hidden",
  },

  // Меню скрепки над капсулой.
  attachMenuCard: {
    alignSelf: "flex-start",
    marginLeft: 4,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingVertical: 4,
    minWidth: 170,
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  attachMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  attachMenuItemText: {
    fontSize: 14.5,
    color: "#2F4A3C",
    fontWeight: "600",
    marginLeft: 10,
  },

  // Скрепка в капсуле.
  attachButton: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  // Парящая капсула ввода ПОВЕРХ ленты (образец панели вкладок, Веха 36):
  // плотный белый, зелёный абрис, тень; лента проезжает под ней и тает.
  inputDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 26,
    paddingHorizontal: 16,
    // Отступ от края клавиатуры / низа экрана; запас под системную
    // полоску добавляет тающая прокладка (Веха 69).
    paddingBottom: 14,
  },

  // Всё под шапкой: лента + капсула (Веха 69).
  keyboardBody: {
    flex: 1,
  },

  inputCapsule: {
    flexDirection: "row",
    // Поле растёт вверх — скрепка и кнопка остаются внизу.
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.35)",
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 7,
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  // Поле растёт вместе с текстом до 4 строк, дальше текст крутится
  // внутри поля (как в Instagram). 4 строки × 20 + отступы 22 = 102.
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 102,
    backgroundColor: "transparent",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    lineHeight: 20,
    color: "#2F4A3C",
    textAlignVertical: "center",
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(105,183,141,0.92)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    shadowColor: "#69B78D",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  sendButtonDisabled: {
    opacity: 0.6,
  },

  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
