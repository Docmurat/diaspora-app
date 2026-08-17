// О проекте и поддержка (Веха 60).
// Тёплый рассказ о «Минги-Тау» и добровольная поддержка проекта:
// QR-код (нарисован вектором, ссылка Т-Банка зашита в него) + кнопки
// «Скопировать ссылку» и «Открыть ссылку». Поддержка — подарок проекту:
// ни на что не влияет и ничего не открывает (принцип владельца).

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Tekmet } from "../components/mingi";

const SUPPORT_URL = "https://tbank.ru/cf/7na5DSL69LB";

// QR-код ссылки поддержки: чёрные клетки одним векторным контуром,
// сетка QR_SIZE×QR_SIZE. Перегенерировать — попросить Клода при смене ссылки.
const QR_SIZE = 29;
const QR_PATH =
  "M0 0h7v1h-7zM8 0h1v1h-1zM11 0h2v1h-2zM15 0h2v1h-2zM18 0h3v1h-3zM22 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h1v1h-1zM11 1h1v1h-1zM14 1h2v1h-2zM17 1h1v1h-1zM20 1h1v1h-1zM22 1h1v1h-1zM28 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM9 2h2v1h-2zM13 2h3v1h-3zM18 2h1v1h-1zM20 2h1v1h-1zM22 2h1v1h-1zM24 2h3v1h-3zM28 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h4v1h-4zM16 3h4v1h-4zM22 3h1v1h-1zM24 3h3v1h-3zM28 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h1v1h-1zM13 4h1v1h-1zM17 4h3v1h-3zM22 4h1v1h-1zM24 4h3v1h-3zM28 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM10 5h1v1h-1zM12 5h1v1h-1zM14 5h1v1h-1zM18 5h3v1h-3zM22 5h1v1h-1zM28 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h7v1h-7zM8 7h4v1h-4zM13 7h2v1h-2zM17 7h3v1h-3zM0 8h1v1h-1zM2 8h2v1h-2zM5 8h3v1h-3zM10 8h1v1h-1zM12 8h3v1h-3zM16 8h1v1h-1zM18 8h3v1h-3zM22 8h1v1h-1zM25 8h1v1h-1zM27 8h2v1h-2zM0 9h1v1h-1zM2 9h1v1h-1zM4 9h2v1h-2zM9 9h3v1h-3zM15 9h2v1h-2zM18 9h2v1h-2zM21 9h4v1h-4zM28 9h1v1h-1zM2 10h1v1h-1zM5 10h2v1h-2zM8 10h1v1h-1zM10 10h2v1h-2zM14 10h2v1h-2zM17 10h2v1h-2zM22 10h3v1h-3zM26 10h2v1h-2zM1 11h3v1h-3zM5 11h1v1h-1zM7 11h2v1h-2zM12 11h4v1h-4zM20 11h2v1h-2zM23 11h2v1h-2zM28 11h1v1h-1zM1 12h3v1h-3zM5 12h3v1h-3zM9 12h1v1h-1zM11 12h2v1h-2zM16 12h1v1h-1zM19 12h1v1h-1zM21 12h1v1h-1zM25 12h2v1h-2zM0 13h1v1h-1zM2 13h1v1h-1zM5 13h1v1h-1zM9 13h1v1h-1zM12 13h2v1h-2zM17 13h4v1h-4zM22 13h1v1h-1zM26 13h3v1h-3zM1 14h2v1h-2zM4 14h4v1h-4zM10 14h3v1h-3zM14 14h1v1h-1zM17 14h1v1h-1zM19 14h1v1h-1zM21 14h1v1h-1zM23 14h1v1h-1zM26 14h3v1h-3zM2 15h1v1h-1zM4 15h2v1h-2zM7 15h4v1h-4zM12 15h2v1h-2zM15 15h1v1h-1zM19 15h4v1h-4zM24 15h1v1h-1zM27 15h1v1h-1zM4 16h1v1h-1zM6 16h1v1h-1zM8 16h1v1h-1zM12 16h1v1h-1zM17 16h2v1h-2zM20 16h2v1h-2zM23 16h3v1h-3zM27 16h1v1h-1zM2 17h1v1h-1zM4 17h1v1h-1zM7 17h2v1h-2zM12 17h2v1h-2zM17 17h1v1h-1zM20 17h2v1h-2zM23 17h1v1h-1zM25 17h3v1h-3zM0 18h1v1h-1zM2 18h3v1h-3zM6 18h1v1h-1zM8 18h1v1h-1zM12 18h1v1h-1zM20 18h2v1h-2zM26 18h1v1h-1zM2 19h3v1h-3zM7 19h1v1h-1zM9 19h1v1h-1zM11 19h2v1h-2zM15 19h3v1h-3zM19 19h2v1h-2zM22 19h2v1h-2zM26 19h1v1h-1zM1 20h2v1h-2zM5 20h2v1h-2zM9 20h1v1h-1zM11 20h3v1h-3zM15 20h3v1h-3zM19 20h8v1h-8zM8 21h8v1h-8zM20 21h1v1h-1zM24 21h5v1h-5zM0 22h7v1h-7zM8 22h2v1h-2zM13 22h1v1h-1zM18 22h3v1h-3zM22 22h1v1h-1zM24 22h2v1h-2zM27 22h1v1h-1zM0 23h1v1h-1zM6 23h1v1h-1zM8 23h2v1h-2zM11 23h2v1h-2zM15 23h2v1h-2zM20 23h1v1h-1zM24 23h2v1h-2zM27 23h1v1h-1zM0 24h1v1h-1zM2 24h3v1h-3zM6 24h1v1h-1zM9 24h2v1h-2zM14 24h2v1h-2zM17 24h2v1h-2zM20 24h5v1h-5zM26 24h1v1h-1zM28 24h1v1h-1zM0 25h1v1h-1zM2 25h3v1h-3zM6 25h1v1h-1zM8 25h1v1h-1zM10 25h1v1h-1zM14 25h1v1h-1zM16 25h1v1h-1zM18 25h2v1h-2zM21 25h1v1h-1zM23 25h3v1h-3zM27 25h1v1h-1zM0 26h1v1h-1zM2 26h3v1h-3zM6 26h1v1h-1zM8 26h1v1h-1zM10 26h1v1h-1zM14 26h1v1h-1zM16 26h1v1h-1zM20 26h2v1h-2zM23 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM0 27h1v1h-1zM6 27h1v1h-1zM9 27h2v1h-2zM12 27h1v1h-1zM14 27h3v1h-3zM20 27h1v1h-1zM24 27h2v1h-2zM27 27h1v1h-1zM0 28h7v1h-7zM8 28h4v1h-4zM13 28h1v1h-1zM15 28h1v1h-1zM17 28h2v1h-2zM20 28h2v1h-2zM25 28h1v1h-1zM27 28h1v1h-1z";

export default function AboutProjectScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(SUPPORT_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.log("Ссылка не скопировалась:", e);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color="#3F6B5B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>О проекте</Text>

        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          «Минги-Тау» — закрытое сообщество карачаевцев и балкарцев.
        </Text>

        <Text style={styles.paragraph}>
          Мы разбросаны по городам и странам, но остаёмся одним народом.
          Здесь свои люди находят друг друга: врач подскажет, юрист
          разберётся, земляк встретит в чужом городе. Вход — только по
          приглашению, каждый человек в сообществе — чей-то знакомый.
        </Text>

        <Text style={styles.paragraph}>
          Проект некоммерческий: без рекламы, без продажи данных, без
          платных функций. Его делает и содержит один человек — на свои
          средства и в свободное время.
        </Text>

        <Tekmet style={styles.tekmet} />

        {/* «Помочь проекту» — это не только деньги (описание кнопки на
            главной обещает «Идеи, замечания, поддержка проекта»). */}
        <Text style={styles.supportTitle}>Идеи и замечания</Text>

        <Text style={styles.paragraph}>
          Лучшая помощь проекту — ваше участие. Заметили ошибку, чего-то
          не хватает, есть идея нового раздела — напишите: каждое письмо
          читается, многое из написанного уже стало частью приложения.
          И приглашайте достойных людей — сообщество растёт только через
          своих.
        </Text>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => router.push("/contact-admin" as any)}
        >
          <Ionicons name="bulb-outline" size={16} color="#3F6B5B" />
          <Text style={styles.secondaryButtonText}>
            Написать идею или замечание
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { marginBottom: 6 }]}
          activeOpacity={0.85}
          onPress={() => router.push("/invites" as any)}
        >
          <Ionicons name="mail-open-outline" size={16} color="#3F6B5B" />
          <Text style={styles.secondaryButtonText}>Пригласить своих</Text>
        </TouchableOpacity>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.supportTitle}>Поддержать проект</Text>

        <Text style={styles.paragraph}>
          Серверы, домен и защита данных оплачиваются каждый месяц. Если
          хотите помочь — можно сделать добровольный перевод. Это подарок
          проекту: он ни на что не влияет и ничего не открывает. Любая
          сумма — это вклад в общее дело.
        </Text>

        {/* QR — навести камеру телефона */}
        <View style={styles.qrCard}>
          <View style={styles.qrBox}>
            <Svg
              width={172}
              height={172}
              viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}
            >
              <Path d={QR_PATH} fill="#1F3A2E" />
            </Svg>
          </View>
          <Text style={styles.qrHint}>
            Наведите камеру телефона — откроется перевод в Т-Банке
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => Linking.openURL(SUPPORT_URL)}
        >
          <Ionicons name="heart-outline" size={17} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Открыть ссылку на перевод</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={copyLink}
        >
          <Ionicons
            name={copied ? "checkmark-outline" : "copy-outline"}
            size={16}
            color="#3F6B5B"
          />
          <Text style={styles.secondaryButtonText}>
            {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Сау болугъуз! Спасибо, что вы с нами.
        </Text>
      </ScrollView>
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 6,
  },

  backButton: {
    width: 40,
    alignItems: "flex-start",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  headerTitle: {
    flex: 1,
    fontFamily: "Philosopher_700Bold",
    fontSize: 24,
    color: "#3F6B5B",
    textAlign: "center",
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 60,
  },

  lead: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 18,
    lineHeight: 26,
    color: "#3F6B5B",
    marginBottom: 12,
  },

  paragraph: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#2F4A3C",
    marginBottom: 12,
  },

  tekmet: {
    alignSelf: "center",
    marginVertical: 10,
  },

  supportTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 20,
    color: "#3F6B5B",
    marginBottom: 10,
  },

  qrCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#F4FAF4",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
  },

  qrBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
  },

  qrHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#7E988B",
    textAlign: "center",
    marginTop: 10,
    maxWidth: 240,
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 14,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    marginTop: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  footerNote: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 14,
    color: "#719686",
    textAlign: "center",
    marginTop: 22,
  },
});
