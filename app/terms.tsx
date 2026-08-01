import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";

export default function TermsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

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

        <Text style={styles.title}>Пользовательское соглашение</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>Последнее обновление: 15.04.2026</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Общие условия</Text>
          <Text style={styles.text}>
            Настоящее Пользовательское соглашение регулирует порядок
            использования приложения «Минги-Тау». Используя приложение,
            пользователь подтверждает согласие с условиями настоящего
            соглашения.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Доступ к сервису</Text>
          <Text style={styles.text}>
            Доступ к регистрации осуществляется только по приглашению.
            Администрация сервиса вправе ограничивать, приостанавливать или
            отзывать доступ пользователей при нарушении правил платформы.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Обязанности пользователя</Text>
          <Text style={styles.text}>
            Пользователь обязуется предоставлять достоверную информацию,
            соблюдать нормы общения, не использовать приложение для незаконной
            деятельности, спама, оскорблений, мошенничества или распространения
            вредоносного контента.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Профиль и контент</Text>
          <Text style={styles.text}>
            Пользователь несёт ответственность за информацию, размещённую в
            профиле, включая описание, ссылки, контакты и иные материалы.
            Администрация вправе модерировать, скрывать или удалять контент,
            нарушающий правила сервиса.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Модерация и ограничения</Text>
          <Text style={styles.text}>
            Аккаунт может находиться на модерации. Администрация вправе отказать
            в активации профиля, ограничить отдельные функции, заблокировать
            аккаунт или удалить доступ в случае нарушения правил или угрозы
            безопасности сообщества.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Ответственность</Text>
          <Text style={styles.text}>
            Сервис предоставляется по принципу «как есть». Администрация не
            гарантирует бесперебойную работу приложения и не несёт
            ответственности за убытки, возникшие в результате использования либо
            невозможности использования сервиса, за исключением случаев, прямо
            предусмотренных применимым законодательством.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Изменение условий</Text>
          <Text style={styles.text}>
            Администрация вправе в любое время изменять настоящее соглашение.
            Актуальная версия соглашения публикуется внутри приложения и
            применяется с момента размещения.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
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
    fontSize: 30,
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
    marginBottom: 14,
  },

  updated: {
    fontSize: 12.5,
    color: "#8FA79A",
    textAlign: "center",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 10,
  },

  sectionTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 17,
    color: "#3F6B5B",
    marginBottom: 8,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#2F4A3C",
  },

  backButton: {
    marginTop: 16,
    alignSelf: "center",
  },

  backButtonText: {
    fontSize: 15,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
