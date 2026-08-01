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

export default function PrivacyScreen() {
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

        <Text style={styles.title}>Политика конфиденциальности</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>Последнее обновление: 15.04.2026</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Общие положения</Text>
          <Text style={styles.text}>
            Настоящая Политика конфиденциальности описывает, какие данные
            пользователей собираются, как они используются и в каких случаях
            могут обрабатываться в рамках приложения «Минги-Тау».
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            2. Какие данные мы обрабатываем
          </Text>
          <Text style={styles.text}>
            В рамках работы сервиса могут обрабатываться следующие данные: имя,
            фамилия, email, номер телефона, дата рождения, страна, город,
            категория деятельности, профессия, описание профиля, Telegram,
            дополнительная информация, фото профиля, а также технические данные,
            необходимые для работы приложения.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Цели обработки данных</Text>
          <Text style={styles.text}>
            Данные используются для регистрации и авторизации пользователя,
            отображения профиля, модерации, обеспечения работы системы инвайтов,
            связи между участниками сообщества, а также для повышения
            безопасности и стабильности сервиса.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Хранение и защита</Text>
          <Text style={styles.text}>
            Мы принимаем разумные организационные и технические меры для защиты
            данных от несанкционированного доступа, изменения, раскрытия или
            уничтожения. Доступ к отдельным данным может быть ограничен в
            зависимости от настроек приватности и роли пользователя.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            5. Передача данных третьим лицам
          </Text>
          <Text style={styles.text}>
            Данные не передаются третьим лицам, за исключением случаев,
            необходимых для работы инфраструктуры приложения, выполнения
            требований законодательства или защиты законных интересов сервиса и
            пользователей.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Права пользователя</Text>
          <Text style={styles.text}>
            Пользователь вправе обновлять данные профиля, изменять отдельные
            настройки приватности, а также запросить удаление аккаунта в рамках
            доступной функциональности приложения.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Изменения политики</Text>
          <Text style={styles.text}>
            Политика конфиденциальности может обновляться. Актуальная версия
            всегда публикуется внутри приложения.
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
