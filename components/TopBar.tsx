// Верхняя строка приложения: слева аватар (ведёт в профиль),
// справа колокольчик (ведёт в уведомления). Используется на всех вкладках.
//
// Веха 41: живой счётчик колокольчика переведён на общую службу
// liveService — при обрыве связи она сама переподключается и просит
// перечитать счётчик (самолечение одно на всех). Уникальность имени
// канала теперь тоже обеспечивает служба.

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { subscribeToChanges } from "../services/liveService";
import { getUnreadCount } from "../services/notificationService";
import {
  getCachedAvatarPath,
  refreshMyAvatarPath,
} from "../services/profileService";
import { t, useLanguage } from "../services/i18nService";

export default function TopBar({
  transparent = false,
  centerContent,
}: {
  transparent?: boolean;
  centerContent?: ReactNode;
}) {
  const lang = useLanguage(); // перерисовка при смене языка
  const insets = useSafeAreaInsets();
  // Аватарка: сразу из памятки (Веха 67) — раньше при каждом заходе
  // шапка спрашивала анкету целиком и заглушка висела заметно долго.
  const [avatarPath, setAvatarPath] = useState<string | null>(
    getCachedAvatarPath() ?? null,
  );
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      const load = async () => {
        try {
          // Лёгкий запрос одного поля; при ошибке вернёт то, что помнит.
          const path = await refreshMyAvatarPath();
          if (alive) setAvatarPath(path);
        } catch (e) {
          // памятка уже показана — молчим
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
  // страницу обновлять не нужно. При обрыве связи liveService сам
  // переподключится и вызовет refresh — счётчик догонит пропущенное.
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

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

      unsubscribe = subscribeToChanges(
        "topbar-bell",
        [
          {
            table: "notifications",
            filter: { column: "user_id", value: user.id },
          },
        ],
        refresh,
      );
      // Выбрасыванием при удалении/блокировке занимается глобальный
      // часовой components/AccountGuard.tsx (в корне приложения) —
      // он работает на всех экранах, а не только там, где есть TopBar.
    };

    subscribe();

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
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
        accessibilityLabel={t("a11y.myProfile")}
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
        accessibilityLabel={t("a11y.bell")}
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
