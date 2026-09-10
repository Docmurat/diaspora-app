// Вкладка «Знания» — пилюли Статьи · Афиша · Ресурсы, пока заглушки.
// Правки 10.09.2026 (Веха 67, решения владельца):
//  1) блок больше НЕ центрируется по вертикали — раньше при разной
//     длине текста заголовок «прыгал» по высоте между пилюлями;
//     теперь всё растёт от фиксированного верхнего уровня;
//  2) внизу — розовый чип «Помогите проекту в развитии» (один в один
//     стиль кнопки «Помочь проекту» с главной), ведёт на экран
//     «О проекте и поддержка»: мягкий намёк, что проекту нужна помощь.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import TopBar from "../../components/TopBar";
import { Glass, Tekmet } from "../../components/mingi";
import { t, useLanguage } from "../../services/i18nService";

const SECTIONS = [
  {
    key: "articles",
    label: "know.articles",
    text: "know.articlesText",
  },
  {
    key: "events",
    label: "know.events",
    text: "know.eventsText",
  },
  {
    key: "resources",
    label: "know.resources",
    text: "know.resourcesText",
  },
];

export default function KnowledgeScreen() {
  const lang = useLanguage(); // перерисовка при смене языка
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [active, setActive] = useState("articles");

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const current = SECTIONS.find((s) => s.key === active) || SECTIONS[0];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TopBar />

      <View style={styles.pillsRow}>
        {SECTIONS.map((section) => {
          const isActive = section.key === active;

          return (
            <TouchableOpacity
              key={section.key}
              activeOpacity={0.85}
              onPress={() => setActive(section.key)}
              style={[styles.pill, isActive && styles.pillActive]}
            >
              <Text
                style={[styles.pillText, isActive && styles.pillTextActive]}
              >
                {t(section.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Раньше justifyContent:"center" ронял заголовок на разную
          высоту (тексты у разделов разной длины). Теперь блок растёт
          сверху — заголовок у всех трёх пилюль на одном уровне. */}
      <View style={styles.center}>
        <Text style={styles.title}>{t(current.label)}</Text>
        <Text style={styles.subtitle}>{t("know.soon")}</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>{t(current.text)}</Text>

        {/* Розовый чип поддержки — как на главной, ведёт в
            «О проекте и поддержка».
            ⚠️ Текст по-русски на всех языках — ключ в сводную таблицу
            переводов при следующей правке (как заглушки демо). */}
        <TouchableOpacity
          onPress={() => router.push("/about-project" as any)}
          activeOpacity={0.85}
          style={styles.supportButton}
        >
          <Glass
            radius={999}
            tintColor="rgba(247,205,216,0.55)"
            borderColor="rgba(219,143,163,0.65)"
            borderWidth={1}
          >
            <View style={styles.supportInner}>
              <Ionicons name="heart-outline" size={16} color="#A85A72" />
              <Text style={styles.supportText}>
                Помогите проекту в развитии
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
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

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },

  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
  },

  pillActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(255,255,255,0.85)",
  },

  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  pillTextActive: {
    color: "#FFFFFF",
  },

  // Фиксированный верхний отступ вместо вертикального центрирования —
  // заголовок всегда на одном уровне (решение владельца 10.09).
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 40,
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

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    maxWidth: 340,
  },

  // Розовый чип поддержки — стиль кнопки «Помочь проекту» с главной.
  supportButton: {
    alignSelf: "center",
    marginTop: 28,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  supportInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },

  supportText: {
    color: "#A85A72",
    fontSize: 14,
    fontWeight: "600",
  },
});
