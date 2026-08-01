import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";
import {
  AppNotification,
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: "chatbubble-ellipses-outline",
  moderation: "shield-checkmark-outline",
  invite: "mail-open-outline",
  help: "megaphone-outline",
};

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

  if (isYesterday) return "Вчера";

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function NotificationsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getMyNotifications();
      setItems(data);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось загрузить уведомления";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

    if (item.link) {
      router.push(item.link as any);
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

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  const hasUnread = items.some((item) => !item.is_read);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.container}
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

            <TouchableOpacity onPress={load} activeOpacity={0.8}>
              <Text style={styles.markAllText}>Повторить</Text>
            </TouchableOpacity>
          </>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>
            Пока пусто. Здесь появятся новые сообщения, решения по заявкам и
            события сообщества.
          </Text>
        ) : (
          items.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              onPress={() => handleOpen(item)}
              style={[styles.card, !item.is_read && styles.cardUnread]}
            >
              <Ionicons
                name={ICONS[item.type] || "notifications-outline"}
                size={20}
                color={item.is_read ? "#A8BDB1" : "#69B78D"}
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
            </TouchableOpacity>
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
    paddingTop: 56,
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
});
