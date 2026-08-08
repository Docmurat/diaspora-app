// Меморандум сообщества «Минги-Тау» — основополагающий документ о
// принципах: взаимопомощь, уважение, вне политики и религии, доверие.
// На него ссылается третья галочка на шаге 3 регистрации.
// Версия текста — в services/consentService.ts (MEMORANDUM_VERSION):
// при изменении текста здесь ОБЯЗАТЕЛЬНО поднять версию там.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";
import { setMemorandumAccepted } from "../store/consentFlow";

export default function MemorandumScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // mode=accept — открыто с шага регистрации: внизу кнопка «Принимаю»,
  // и только она зажигает галочку в анкете (прочесть придётся).
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const acceptMode = mode === "accept";

  const handleAccept = () => {
    setMemorandumAccepted(true);
    router.back();
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

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

        <Text style={styles.title}>Меморандум сообщества</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>Версия 1.0 от 08.08.2026</Text>

        <View style={styles.card}>
          <Text style={styles.text}>
            «Минги-Тау» — закрытое сообщество карачаевцев и балкарцев по всему
            миру. Мы объединяемся, чтобы знать друг друга, поддерживать друг
            друга и укреплять наш народ — где бы каждый из нас ни жил.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Взаимная польза</Text>
          <Text style={styles.text}>
            Вступая в сообщество, человек не только получает полезные связи —
            он даёт слово сам быть полезным. Если к тебе обращаются из
            «Минги-Тау» — постарайся помочь: советом, делом, знакомством.
            Помощь не обязана быть безвозмездной: честная работа достойна
            вознаграждения; главное — откликнуться и не остаться равнодушным.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Уважение</Text>
          <Text style={styles.text}>
            Мы общаемся достойно: без нецензурной речи, оскорблений и
            высокомерия. Спорить можно — унижать нельзя.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Вне политики и религии</Text>
          <Text style={styles.text}>
            Сообщество — не место для политических и религиозных споров и
            агитации. Эти темы мы оставляем за порогом, чтобы ничто нас не
            разделяло.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Доверие</Text>
          <Text style={styles.text}>
            Вход — только по приглашению: приглашая человека, ты открываешь ему
            дверь от своего имени. Береги доверие сообщества.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Общее дело</Text>
          <Text style={styles.text}>
            Каждый вклад — большой или малый — укрепляет связи между нами.
            Сильное сообщество складывается из готовности каждого быть
            полезным.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.text}>
            Присоединяясь к «Минги-Тау», я разделяю эти принципы и обязуюсь им
            следовать.
          </Text>
        </View>

        <Text style={styles.founder}>Основатель — Мурат Курджиев</Text>

        {acceptMode ? (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptButtonText}>
              Принимаю принципы сообщества
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Назад</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
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
    fontSize: 28,
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
    marginBottom: 10,
  },

  updated: {
    fontSize: 12.5,
    color: "#8FA79A",
    textAlign: "center",
    marginBottom: 18,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 12,
  },

  sectionTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 16.5,
    color: "#3F6B5B",
    marginBottom: 6,
  },

  text: {
    fontSize: 14,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  founder: {
    marginTop: 6,
    fontSize: 12.5,
    color: "#8FA79A",
    textAlign: "center",
  },

  backButton: {
    alignSelf: "center",
    marginTop: 16,
  },

  acceptButton: {
    marginTop: 18,
    backgroundColor: "#69B78D",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },

  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  backButtonText: {
    fontSize: 14.5,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
