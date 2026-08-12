import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TopBar from "../../components/TopBar";
import { Glass, Tekmet } from "../../components/mingi";
import { ChatListItem, getMyChats } from "../../services/chatService";
import { subscribeToChanges } from "../../services/liveService";

function formatChatTime(dateString?: string | null) {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Вчера";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getFullName(chat: ChatListItem) {
  const firstName = chat.otherUser?.first_name?.trim() || "";
  const lastName = chat.otherUser?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();

  // Анкета скрыта правилами базы (вычищен чистильщиком или отключён
  // администрацией) — переписка остаётся, собеседник обезличен.
  return fullName || "Удалённый участник";
}

function getAvatarLetter(chat: ChatListItem) {
  const fullName = getFullName(chat);
  return fullName[0]?.toUpperCase() || "?";
}

export default function ChatsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const loadedOnceRef = useRef(false);

  const loadChats = async () => {
    try {
      // Полноэкранная крутилка — только при САМОМ ПЕРВОМ открытии.
      // При возвратах с диалога список уже на экране — обновляем тихо,
      // без занавеса (образец Вехи 42): ощущение мгновенного возврата.
      if (!loadedOnceRef.current) {
        setLoading(true);
      }
      setScreenError("");

      const data = await getMyChats();
      setChats(data);
      loadedOnceRef.current = true;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось загрузить список чатов";
      setScreenError(message);
      if (!loadedOnceRef.current) {
        setChats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Тихая перезагрузка для живого обновления (образец Вехи 42):
  // без крутилки, при ошибке сети текущий список не сбрасывается.
  const reloadChatsQuiet = async () => {
    try {
      const data = await getMyChats();
      setChats(data);
    } catch {
      // живое обновление само повторит при следующем событии
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, []),
  );

  // Живой список: новое сообщение возвращает очищенный диалог, двигает
  // порядок, обновляет превью и метки непрочитанного — само, без F5.
  useEffect(() => {
    const unsubscribe = subscribeToChanges(
      "chats-list",
      [{ table: "messages" }],
      () => {
        if (loadedOnceRef.current) reloadChatsQuiet();
      },
    );
    return unsubscribe;
  }, []);

  const preparedChats = useMemo(() => {
    return chats.map((chat) => {
      const fullName = getFullName(chat);

      return {
        ...chat,
        fullName,
        avatarLetter: getAvatarLetter(chat),
        timeLabel: formatChatTime(
          chat.lastMessageAt || chat.updatedAt || chat.createdAt,
        ),
        previewText: chat.lastMessageText?.trim() || "Сообщений пока нет",
      };
    });
  }, [chats]);

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

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TopBar />

      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>
        <Tekmet style={styles.tekmet} />
      </View>

      {screenError ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Не удалось загрузить чаты</Text>
          <Text style={styles.stateText}>{screenError}</Text>

          <TouchableOpacity
            style={styles.primaryShadow}
            onPress={loadChats}
            activeOpacity={0.85}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>Повторить</Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      ) : preparedChats.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Пока нет чатов</Text>
          <Text style={styles.stateText}>
            Когда вы начнёте диалог с человеком из сообщества, он появится здесь.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {preparedChats.map((chat) => (
            <TouchableOpacity
              key={chat.chatId}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/chat",
                  params: {
                    userId: chat.otherUser?.id || "",
                    name: chat.fullName,
                  },
                })
              }
            >
              <View
                style={[
                  styles.chatCard,
                  chat.unreadCount > 0 && styles.chatCardUnread,
                ]}
              >
                <View style={styles.chatCardInner}>
                  {chat.otherUser?.avatar_path ? (
                    <Image
                      source={{ uri: chat.otherUser.avatar_path }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        chat.fullName === "Удалённый участник" &&
                          styles.avatarMuted,
                      ]}
                    >
                      <Text style={styles.avatarText}>{chat.avatarLetter}</Text>
                    </View>
                  )}

                  <View style={styles.chatInfo}>
                    <View style={styles.topRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {chat.fullName}
                      </Text>

                      <Text style={styles.time}>{chat.timeLabel}</Text>
                    </View>

                    <View style={styles.bottomRow}>
                      <Text
                        style={styles.lastMessage}
                        numberOfLines={1}
                      >
                        {chat.previewText}
                      </Text>

                      {chat.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  header: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 34,
    color: "#3F6B5B",
    textAlign: "center",
  },

  subtitle: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
    textAlign: "center",
    marginTop: 8,
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 6,
  },

  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 60,
  },

  stateTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 22,
    color: "#3F6B5B",
    marginBottom: 10,
    textAlign: "center",
  },

  stateText: {
    fontSize: 14.5,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },

  primaryShadow: {
    marginTop: 20,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 6,
    // Запас снизу под парящую панель вкладок.
    paddingBottom: 120,
  },

  chatCard: {
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    overflow: "hidden",
  },

  // Непрочитанный чат: мягкая фирменная зелень всего контейнера.
  chatCardUnread: {
    backgroundColor: "rgba(105,183,141,0.10)",
    borderColor: "rgba(93,140,120,0.45)",
  },

  chatCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(105,183,141,0.92)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarMuted: {
    backgroundColor: "#B9C8BF",
  },

  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: "#EAF4EE",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  chatInfo: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  name: {
    flex: 1,
    fontFamily: "Philosopher_700Bold",
    fontSize: 17,
    color: "#3F6B5B",
    marginRight: 10,
  },

  time: {
    fontSize: 12,
    color: "#8FA79A",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#4E7364",
    marginRight: 8,
  },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(105,183,141,0.92)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },

  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
