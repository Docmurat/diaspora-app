// Тихая плашка «Нет соединения» (Веха 70). Висит поверх всех экранов
// сверху, под строкой состояния, и сама исчезает, когда сеть вернулась.
// Нажатия сквозь неё проходят (pointerEvents="none") — ничего не
// загораживает. Заодно запускает сторожа выхода из аккаунта
// (стирает память запуска, см. lib/offline.ts).

import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { startSignOutWatcher, useOnline } from "../lib/offline";
import { useLanguage } from "../services/i18nService";

export default function OfflineBanner() {
  const isOnline = useOnline();
  const lang = useLanguage();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    startSignOutWatcher();
  }, []);

  if (isOnline) return null;

  // ⚠️ Перевод пока прямо здесь (как строка «Связаться с нами» на пороге):
  // карачаевский текст владелец даст — тогда перенести ключом в словарь.
  const text = lang === "en" ? "No connection" : "Нет соединения";

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 6 }]}
    >
      <View style={styles.pill}>
        <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    elevation: 1000,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(63,107,91,0.92)",
  },

  text: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "600",
  },
});
