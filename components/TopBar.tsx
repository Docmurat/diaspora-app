// Верхняя строка приложения: слева аватар (ведёт в профиль),
// справа колокольчик (ведёт в уведомления). Используется на всех вкладках.

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { getUnreadCount } from "../services/notificationService";
import { getMyProfile } from "../services/profileService";

// Каждому экземпляру TopBar — свой номер, чтобы имена realtime-каналов
// не совпадали: TopBar стоит на каждой вкладке, и при одинаковом имени
// второй экран получает УЖЕ запущенный канал первого и падает с ошибкой
// «cannot add postgres_changes callbacks after subscribe()».
let topBarInstanceCounter = 0;

export default function TopBar({
  transparent = false,
  centerContent,
}: {
  transparent?: boolean;
  centerContent?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        try {
          const profile = await getMyProfile();
          if (alive) setAvatarPath(profile?.avatar_path || null);
        } catch (e) {
          if (alive) setAvatarPath(null);
        }

        try {
          const count = await getUnreadCount();
          if (alive) setUnreadCount(count);
        } catch (e) {
          if (alive) setUnreadCount(0);
        }
      };

      load();

      return () => {
        alive = false;
      };
    }, []),
  );

  // Живой счётчик: база сама сообщает о новых уведомлениях,
  // страницу обновлять не нужно.
  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async () => {
      try {
        const count = await getUnreadCount();
        if (alive) setUnreadCount(count);
      } catch (e) {
        // тихо: счётчик не критичен
      }
    };

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !alive) return;

      topBarInstanceCounter += 1;
      const channelName = `user-live-${user.id}-${topBarInstanceCounter}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refresh();
          },
        )
        .subscribe((status: string, err?: Error) => {
          // Докладываем результат подписки: молчаливый отказ сервера
          // раньше оставлял колокольчик «глухим» без единой ошибки.
          if (status === "SUBSCRIBED") {
            console.log("Колокольчик: живая подписка подключена");
          } else {
            console.log(
              `Колокольчик: подписка — статус ${status}`,
              err?.message || "",
            );
          }
        });
      // Выбрасыванием при удалении/блокировке теперь занимается
      // глобальный часовой components/AccountGuard.tsx (в корне приложения) —
      // он работает на всех экранах, а не только там, где есть TopBar.
    };

    subscribe();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + 10 },
        transparent && styles.barTransparent,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push("/profile" as any)}
        accessibilityLabel="Мой профиль"
      >
        <Image
          source={
            avatarPath
              ? { uri: avatarPath }
              : require("../assets/default-avatar.png")
          }
          style={styles.avatar}
        />
      </TouchableOpacity>

      <View style={styles.center} pointerEvents="none">
        {centerContent}
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push("/notifications" as any)}
        style={styles.bellButton}
        accessibilityLabel="Уведомления"
      >
        <Ionicons name="notifications-outline" size={24} color="#3F6B5B" />

        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
  },

  barTransparent: {
    backgroundColor: "transparent",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.35)",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#C05B4D",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
});
