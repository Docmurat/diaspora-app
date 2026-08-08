// Полный текст согласия на обработку персональных данных.
// На него ссылается галочка на шаге 3 регистрации.
// Версия текста — в services/consentService.ts (PDN_CONSENT_VERSION):
// при изменении текста здесь ОБЯЗАТЕЛЬНО поднять версию там.

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

export default function ConsentScreen() {
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

        <Text style={styles.title}>Согласие на обработку персональных данных</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>Версия 1.0 от 08.08.2026</Text>

        <View style={styles.card}>
          <Text style={styles.text}>
            Я свободно, своей волей и в своём интересе даю согласие Курджиеву
            Мурату Алий-Султановичу, являющемуся оператором персональных данных
            сервиса «Минги-Тау» (далее — Оператор; контакты:
            murat.kurdzhiev@yandex.ru, иные реквизиты — в Политике
            конфиденциальности), на обработку моих персональных данных на
            условиях, изложенных ниже.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Перечень персональных данных</Text>
          <Text style={styles.text}>
            Фамилия, имя, отчество; номер телефона; адрес электронной почты;
            дата рождения; страна (страны) и город (города) проживания;
            фотография (аватар); сведения о сфере деятельности и профессии;
            иные сведения, добровольно указанные мной в анкете и при
            использовании сервиса, включая создаваемое мной содержимое
            (сообщения, публикации, обращения).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Цели обработки</Text>
          <Text style={styles.text}>
            Регистрация и ведение учётной записи в закрытом сообществе
            «Минги-Тау»; показ моей анкеты другим участникам сообщества; обмен
            сообщениями и иным содержимым между участниками в разделах сервиса;
            связь со мной по вопросам работы сервиса, включая уведомления;
            модерация и обеспечение безопасности сообщества.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Перечень действий</Text>
          <Text style={styles.text}>
            Сбор, запись, систематизация, накопление, хранение, уточнение
            (обновление, изменение), извлечение, использование, предоставление
            другим участникам закрытого сообщества, обезличивание, блокирование,
            удаление, уничтожение.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Способ обработки</Text>
          <Text style={styles.text}>
            Обработка ведётся с использованием средств автоматизации. Базы
            данных, содержащие персональные данные, находятся на территории
            Российской Федерации. Трансграничная передача персональных данных
            не осуществляется.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Срок действия и отзыв</Text>
          <Text style={styles.text}>
            Согласие действует с момента его предоставления до момента отзыва.
            Согласие может быть отозвано в любое время путём направления
            обращения Оператору через раздел «Написать администрации» в
            приложении либо на адрес murat.kurdzhiev@yandex.ru. Порядок
            обработки и прекращения обработки данных определён Политикой
            конфиденциальности.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Подтверждение</Text>
          <Text style={styles.text}>
            Я подтверждаю, что мне исполнилось 16 лет и указанные мной сведения
            достоверны.
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
    fontSize: 26,
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

  backButton: {
    alignSelf: "center",
    marginTop: 16,
  },

  backButtonText: {
    fontSize: 14.5,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
