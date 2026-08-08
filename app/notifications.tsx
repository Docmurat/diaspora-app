import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { subscribeToChanges } from "../services/liveService";
import {
  AppNotification,
  deleteNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";
import { getMyProfile } from "../services/profileService";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: "chatbubble-ellipses-outline",
  moderation: "shield-checkmark-outline",
  complaint: "flash-outline",
  invite: "mail-open-outline",
  help: "megaphone-outline",
};

// Жалобы выделяем цветом: они требуют внимания в первую очередь
const ACCENT_TYPES = ["complaint"];

function formatWhen(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
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

  // Под заголовком группы «Вчера» показываем время, а не слово ещё раз
  if (isYesterday) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

// Разбивка списка по датам: Сегодня · Вчера · Последние 7 дней ·
// Последние 30 дней · Ранее. Границы считаются от начала суток.
function groupLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const startOf7Days = new Date(startOfToday);
  startOf7Days.setDate(startOfToday.getDate() - 7);

  const startOf30Days = new Date(startOfToday);
  startOf30Days.setDate(startOfToday.getDate() - 30);

  if (date >= startOfToday) return "Сегодня";
  if (date >= startOfYesterday) return "Вчера";
  if (date >= startOf7Days) return "Последние 7 дней";
  if (date >= startOf30Days) return "Последние 30 дней";
  return "Ранее";
}

// Часть ссылок ведёт в закрытые разделы: например, уведомления о заявке
// остаются у человека и после одобрения, но модерация ему уже недоступна.
// Такие уведомления просто не открываются, вместо ошибки.
function canOpenLink(link: string | null, isModerator: boolean) {
  if (!link) return false;
  if (!link.startsWith("/")) return false;
  if (link.startsWith("/moderation")) return isModerator;
  if (link.startsWith("/pending-approval")) return false;

  return true;
}

export default function NotificationsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Отступ под чёлку/статус-бар: шапка у самого верха (образец Вехи 32).
  // Хук обязан стоять ДО ранних выходов — иначе падение.
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }

      const [data, profile] = await Promise.all([
        getMyNotifications(),
        getMyProfile().catch(() => null),
      ]);

      setItems(data);
      setIsModerator(
        profile?.role === "owner" || profile?.role === "moderator",
      );
    } catch (e) {
      if (!silent) {
        const message =
          e instanceof Error ? e.message : "Не удалось загрузить уведомления";
        setError(message);
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Новые уведомления прилетают сами, без обновления страницы.
  // С Вехи 41 — через liveService: при обрыве связи служба сама
  // переподключится и вызовет тихую перезагрузку списка
  // («догоняем пропущенное»). Тихая перезагрузка не показывает
  // крутилку и не сбрасывает список при случайной ошибке сети.
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !alive) return;

      unsubscribe = subscribeToChanges(
        "notifications-list",
        [
          {
            table: "notifications",
            filter: { column: "user_id", value: user.id },
          },
        ],
        () => {
          if (alive) load(true);
        },
      );
    };

    subscribe();

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
  }, [load]);

  const handleOpen = async (item: AppNotification) => {
    if (!item.is_read) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );

      try {
        await markNotificationRead(item.id);
      } catch (e) {
        console.log("Не удалось отметить уведомление:", e);
      }
    }

    if (!canOpenLink(item.link, isModerator)) return;

    try {
      router.push(item.link as any);
    } catch (e) {
      console.log("Не удалось открыть уведомление:", e);
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.log("Не удалось отметить все уведомления:", e);
    }
  };

  // Удаление одним нажатием (решение владельца: уведомление — не та
  // ценность, чтобы охранять его подтверждением). Удаление мгновенное:
  // строка исчезает сразу, при ошибке сервера возвращается на место
  // (образец закладок Вехи 31).
  const handleDeletePress = (item: AppNotification) => {
    const snapshot = items;
    setItems((prev) => prev.filter((n) => n.id !== item.id));

    deleteNotification(item.id).catch((e) => {
      console.log("Не удалось удалить уведомление:", e);
      setItems(snapshot);
    });
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  const hasUnread = items.some((item) => !item.is_read);

  // Группы по датам. Список приходит от новых к старым, поэтому
  // достаточно идти подряд и открывать новую группу при смене ярлыка.
  const groups: { label: string; items: AppNotification[] }[] = [];
  items.forEach((item) => {
    const label = groupLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 10 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Уведомления</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        {hasUnread && (
          <TouchableOpacity
            onPress={handleMarkAll}
            activeOpacity={0.8}
            style={styles.markAll}
          >
            <Text style={styles.markAllText}>Отметить все прочитанными</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#69B78D"
            style={styles.loader}
          />
        ) : error ? (
          <>
            <Text style={styles.emptyText}>{error}</Text>

            <TouchableOpacity onPress={() => load()} activeOpacity={0.8}>
              <Text style={styles.markAllText}>Повторить</Text>
            </TouchableOpacity>
          </>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>
            Пока пусто. Здесь появятся новые сообщения, решения по заявкам и
            события сообщества.
          </Text>
        ) : (
          groups.map((group) => (
            <View key={group.label}>
              <Text style={styles.sectionHeader}>{group.label}</Text>

              {group.items.map((item) => {
                const openable = canOpenLink(item.link, isModerator);

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={openable ? 0.85 : 1}
                    onPress={() => handleOpen(item)}
                    style={[styles.card, !item.is_read && styles.cardUnread]}
                  >
                    <Ionicons
                      name={ICONS[item.type] || "notifications-outline"}
                      size={20}
                      color={
                        item.is_read
                          ? "#A8BDB1"
                          : ACCENT_TYPES.includes(item.type)
                            ? "#C05B4D"
                            : "#69B78D"
                      }
                      style={styles.cardIcon}
                    />

                    <View style={styles.cardBody}>
                      <View style={styles.cardTop}>
                        <Text
                          style={[
                            styles.cardTitle,
                            !item.is_read && styles.cardTitleUnread,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>

                        <Text style={styles.cardTime}>
                          {formatWhen(item.created_at)}
                        </Text>
                      </View>

                      {!!item.body && (
                        <Text style={styles.cardText} numberOfLines={2}>
                          {item.body}
                        </Text>
                      )}
                    </View>

                    {!item.is_read && <View style={styles.dot} />}

                    <TouchableOpacity
                      onPress={() => handleDeletePress(item)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.deleteBtn}
                      accessibilityLabel="Удалить уведомление"
                    >
                      <Ionicons name="close" size={16} color="#A8BDB1" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },

  backLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
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
    marginBottom: 16,
  },

  markAll: {
    alignSelf: "flex-end",
    marginBottom: 12,
  },

  markAllText: {
    fontSize: 14,
    color: "#96AC9E",
    textDecorationLine: "underline",
    textAlign: "center",
  },

  loader: {
    marginTop: 30,
  },

  sectionHeader: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#719686",
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 4,
  },

  emptyText: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 14,
    marginBottom: 10,
  },

  cardUnread: {
    backgroundColor: "rgba(105,183,141,0.08)",
    borderColor: "rgba(105,183,141,0.45)",
  },

  cardIcon: {
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
    minWidth: 0,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitle: {
    flex: 1,
    fontSize: 15,
    color: "#4E7364",
    marginRight: 10,
  },

  cardTitleUnread: {
    color: "#3F6B5B",
    fontWeight: "600",
  },

  cardTime: {
    fontSize: 12,
    color: "#8FA79A",
  },

  cardText: {
    marginTop: 3,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#7E988B",
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#69B78D",
    marginLeft: 10,
  },

  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
