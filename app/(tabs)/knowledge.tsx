import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import TopBar from "../../components/TopBar";
import { Tekmet } from "../../components/mingi";

const SECTIONS = [
  {
    key: "articles",
    label: "Статьи",
    text: "Материалы о традициях, фамилиях и истории народа, а также профессиональные советы от участников сообщества.",
  },
  {
    key: "events",
    label: "Афиша",
    text: "Мероприятия, посвящённые народу: концерты, встречи, праздники и памятные даты.",
  },
  {
    key: "resources",
    label: "Ресурсы",
    text: "Подборка полезных сайтов, книг и приложений, связанных с карачаево-балкарской культурой и языком.",
  },
];

export default function KnowledgeScreen() {
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
                {section.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>{current.label}</Text>
        <Text style={styles.subtitle}>СКОРО</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>{current.text}</Text>
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

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
});
