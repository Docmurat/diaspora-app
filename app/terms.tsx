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

        <Text style={styles.updated}>
          Версия 2.0. Дата вступления в силу: 15.08.2026
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Общие положения</Text>
          <Text style={styles.text}>
            1.1. Настоящее Пользовательское соглашение (далее — Соглашение)
            регулирует порядок использования сервиса «Минги-Тау» — закрытого
            сообщества, доступного через мобильное приложение и веб-версию
            (далее — Сервис).{"\n\n"}1.2. Сервис администрирует Курджиев Мурат
            Алий-Султанович, физическое лицо, адрес для обращений:
            murat.kurdzhiev@yandex.ru (далее — Администрация). Сервис является
            некоммерческим.{"\n\n"}1.3. Соглашение принимается при регистрации
            отдельной отметкой; факт и версия принятия фиксируются в журнале
            Сервиса. Использование Сервиса означает согласие с действующей
            версией Соглашения.{"\n\n"}1.4. Наряду с Соглашением действуют
            Политика конфиденциальности и Меморандум сообщества; их актуальные
            тексты доступны в Сервисе.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Доступ к Сервису</Text>
          <Text style={styles.text}>
            2.1. Регистрация возможна только по приглашению действующего
            участника либо по одобренному Администрацией запросу.{"\n\n"}2.2.
            Анкета нового участника проходит модерацию. Администрация вправе
            запросить исправления, отклонить заявку либо одобрить её; доступ к
            сообществу открывается после одобрения.{"\n\n"}2.3. Пользователем
            Сервиса может быть лицо, достигшее 16 лет.
            {"\n\n"}2.4. Пользователь обязуется указывать при регистрации и в
            профиле достоверные сведения о себе и поддерживать их актуальность.
            Учётная запись является личной: один человек — одна учётная запись;
            передача доступа третьим лицам не допускается.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Правила поведения</Text>
          <Text style={styles.text}>
            3.1. Сообщество строится на взаимном уважении и доверии; принципы
            сообщества изложены в Меморандуме, принимаемом при регистрации.
            {"\n\n"}3.2. Запрещается использовать Сервис для незаконной
            деятельности, спама, оскорблений, травли, мошенничества, выдавания
            себя за другое лицо, сбора данных участников, а также для
            распространения вредоносного контента.{"\n\n"}3.3. Сервис находится
            вне политики и религии: политическая и религиозная агитация в
            Сервисе не допускается.{"\n\n"}3.4. Сведения об участниках,
            доступные внутри закрытого сообщества (анкеты, контакты, переписка),
            не подлежат распространению за пределами Сервиса без согласия этих
            участников.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Профиль и контент</Text>
          <Text style={styles.text}>
            4.1. Пользователь несёт ответственность за информацию, размещённую
            им в профиле и в Сервисе, включая описание, ссылки, контакты,
            фотографии и сообщения.{"\n\n"}4.2. Размещая контент, пользователь
            разрешает Сервису хранить его и показывать другим участникам в
            соответствии с назначением Сервиса; права на контент остаются за
            пользователем.{"\n\n"}4.3. Администрация вправе модерировать,
            скрывать или удалять контент, нарушающий Соглашение или
            законодательство РФ.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Модерация и ограничения</Text>
          <Text style={styles.text}>
            5.1. При нарушении Соглашения либо угрозе безопасности сообщества
            Администрация вправе ограничить отдельные функции, заблокировать
            доступ к сообществу или удалить учётную запись.{"\n\n"}5.2.
            Пользователь может ограничивать собственное общение с отдельными
            участниками средствами Сервиса (блокировки).{"\n\n"}5.3. Решения
            Администрации можно обжаловать через раздел «Написать
            администрации»; обращение рассматривается, ответ приходит в Сервисе.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Персональные данные</Text>
          <Text style={styles.text}>
            6.1. Персональные данные обрабатываются в соответствии с Федеральным
            законом от 27.07.2006 № 152-ФЗ и Политикой конфиденциальности на
            основании отдельно предоставляемого при регистрации согласия.
            {"\n\n"}6.2. Состав данных, цели, сроки обработки, порядок
            уничтожения и права пользователя описаны в Политике
            конфиденциальности.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Удаление учётной записи</Text>
          <Text style={styles.text}>
            7.1. Пользователь может удалить учётную запись самостоятельно в
            Настройках Сервиса либо направив обращение Администрации.
            {"\n\n"}7.2. После удаления данные немедленно перестают быть
            доступны другим участникам и уничтожаются в срок не более 30 дней в
            порядке, установленном Политикой конфиденциальности.
            {"\n\n"}7.3. Повторная регистрация после удаления возможна по
            согласованию с Администрацией — порядок вступления в сообщество
            через приглашение и модерацию сохраняется.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Ответственность</Text>
          <Text style={styles.text}>
            8.1. Сервис предоставляется по принципу «как есть». Администрация
            стремится к стабильной работе Сервиса, однако не гарантирует его
            бесперебойность и сохранность контента при технических сбоях.
            {"\n\n"}8.2. Администрация не несёт ответственности за убытки,
            возникшие в результате использования либо невозможности
            использования Сервиса, а также за взаимодействие участников за
            пределами Сервиса, за исключением случаев, прямо предусмотренных
            применимым законодательством.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Изменение условий</Text>
          <Text style={styles.text}>
            9.1. Администрация вправе изменять Соглашение. Актуальная версия
            публикуется в Сервисе с указанием даты вступления в силу.
            {"\n\n"}9.2. При изменениях, требующих нового принятия, Сервис
            запросит его отдельно; факт принятия новой версии фиксируется в
            журнале Сервиса.
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
