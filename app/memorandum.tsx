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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";
import { useLanguage } from "../services/i18nService";
import { setMemorandumAccepted } from "../store/consentFlow";

export default function MemorandumScreen() {
  // Язык: en — английский текст (справочный перевод, вычитан владельцем
  // 24.08.2026), ru/kb — русский оригинал. Версии в журнале согласий едины.
  const lang = useLanguage();
  const en = lang === "en";
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
        {Platform.OS === "web" && (
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{en ? "← Back" : "← Назад"}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>
          {en ? "Community Memorandum" : "Меморандум сообщества"}
        </Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>
          {en ? "Version 1.0 of 3 September 2026" : "Версия 1.0 от 03.09.2026"}
        </Text>

        {en ? (
          <>
          <View style={styles.card}>
            <Text style={styles.text}>{"Mingi-Tau is a private community of Karachays and Balkars around the world. We come together to know one another, to support one another, and to strengthen our people — wherever each of us may live."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"1. Mutual Benefit"}</Text>
            <Text style={styles.text}>{"By joining the community, a person not only gains useful connections — they give their word to be useful themselves. If someone from Mingi-Tau reaches out to you, do your best to help: with advice, with action, with an introduction. Help does not have to be free of charge: honest work deserves fair reward; what matters is to respond and not to remain indifferent."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"2. Respect"}</Text>
            <Text style={styles.text}>{"We communicate with dignity: no profanity, no insults, no arrogance. Arguing is allowed — humiliating is not."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"3. Outside Politics and Religion"}</Text>
            <Text style={styles.text}>{"The community is not a place for political or religious disputes or campaigning. We leave these topics at the door, so that nothing divides us."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"4. Trust"}</Text>
            <Text style={styles.text}>{"Entry is by invitation only: by inviting a person, you open the door for them in your own name. Guard the community's trust."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"5. Common Cause"}</Text>
            <Text style={styles.text}>{"Every contribution — big or small — strengthens the bonds between us. A strong community is built on each person's readiness to be useful."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.text}>{"By joining Mingi-Tau, I share these principles and undertake to follow them."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.note}>{"This English translation is provided for convenience only; in case of any discrepancy, the Russian version shall prevail."}</Text>
          </View>
          </>
        ) : (
          <>
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
          </>
        )}

        <Text style={styles.founder}>
          {en ? "Founder — Murat Kurdzhiev" : "Основатель — Мурат Курджиев"}
        </Text>

        {acceptMode ? (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptButtonText}>
              {en ? "I accept the principles of the community" : "Принимаю принципы сообщества"}
            </Text>
          </TouchableOpacity>
        ) : Platform.OS === "web" ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>{en ? "Back" : "Назад"}</Text>
          </TouchableOpacity>
        ) : null}
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

  note: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#8FA79A",
    fontStyle: "italic",
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
