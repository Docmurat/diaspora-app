// Верхняя строка приложения: слева аватар (ведёт в профиль),
// справа колокольчик (ведёт в уведомления). Используется на всех вкладках.

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getMyProfile } from "../services/profileService";

export default function TopBar({
  unreadCount = 0,
  transparent = false,
  centerContent,
}: {
  unreadCount?: number;
  transparent?: boolean;
  centerContent?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

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
      };

      load();

      return () => {
        alive = false;
      };
    }, []),
  );

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
