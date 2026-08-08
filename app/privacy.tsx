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

        <Text style={styles.updated}>
          Версия 2.0. Дата вступления в силу: 15.08.2026
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Общие положения</Text>
          <Text style={styles.text}>
            1.1. Настоящая Политика конфиденциальности (далее — Политика)
            определяет порядок обработки и защиты персональных данных
            пользователей сервиса «Минги-Тау» — закрытого сообщества,
            доступного через мобильное приложение и веб-версию (далее —
            Сервис).{"\n\n"}1.2. Оператор персональных данных: Курджиев Мурат
            Алий-Султанович, физическое лицо, адрес для обращений:
            murat.kurdzhiev@yandex.ru (далее — Оператор). Сведения об
            Операторе включаются в реестр операторов Роскомнадзора.
            {"\n\n"}1.3. Политика разработана в соответствии с Федеральным
            законом от 27.07.2006 № 152-ФЗ «О персональных данных». Используя
            Сервис, пользователь подтверждает ознакомление с Политикой;
            обработка данных ведётся на основании отдельно предоставляемого
            согласия.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            2. Какие данные обрабатываются
          </Text>
          <Text style={styles.text}>
            2.1. Данные, указываемые при регистрации и в профиле: фамилия,
            имя, отчество; номер телефона; адрес электронной почты; дата
            рождения; страна (страны) и город (города) проживания; фотография
            (аватар); сфера деятельности и профессия; Telegram; сведения
            раздела «О себе».{"\n\n"}2.2. Содержимое, создаваемое при
            использовании Сервиса: личные сообщения между участниками;
            переписка с администрацией (обращения); публикации в разделах
            Сервиса по мере их появления.{"\n\n"}2.3. Технические данные:
            сведения о сессиях (входах), необходимые для работы и безопасности
            Сервиса. Веб-версия использует локальное хранилище браузера для
            поддержания входа; рекламные и сторонние аналитические трекеры не
            используются.{"\n\n"}2.4. Специальные категории персональных
            данных и биометрические персональные данные не собираются и не
            обрабатываются; фотография используется исключительно как
            изображение профиля.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Цели и правовые основания</Text>
          <Text style={styles.text}>
            3.1. Цели: регистрация и ведение учётной записи; показ анкеты
            другим участникам закрытого сообщества; обмен сообщениями и иным
            содержимым между участниками; связь с пользователем по вопросам
            работы Сервиса, включая уведомления; модерация, рассмотрение жалоб
            и обращений; обеспечение безопасности и работоспособности
            Сервиса.{"\n\n"}3.2. Правовые основания: согласие субъекта
            персональных данных (п. 1 ч. 1 ст. 6 152-ФЗ); необходимость
            исполнения Пользовательского соглашения, стороной которого
            является субъект (п. 5 ч. 1 ст. 6 152-ФЗ).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Кому видны данные</Text>
          <Text style={styles.text}>
            4.1. Анкеты пользователей видны только участникам закрытого
            сообщества, прошедшим модерацию. Персональные данные
            предоставляются определённому кругу лиц — участникам Сервиса; без
            входа в Сервис данные не доступны и в открытых источниках не
            публикуются.{"\n\n"}4.2. Пользователь может ограничивать
            доступность своих контактов отдельным участникам средствами
            Сервиса (блокировки).{"\n\n"}4.3. Модераторы и основатель
            Сервиса имеют доступ к данным в объёме, необходимом для модерации
            и рассмотрения обращений.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            5. Передача третьим лицам
          </Text>
          <Text style={styles.text}>
            5.1. Персональные данные третьим лицам не передаются, за
            исключением: (а) инфраструктурных провайдеров, обеспечивающих
            работу Сервиса (вычислительные мощности на территории РФ — ООО
            «Яндекс.Облако»; отправка служебных писем — почтовый сервис
            Яндекса), действующих по поручению и без права самостоятельного
            использования данных; (б) случаев, предусмотренных
            законодательством РФ.{"\n\n"}5.2. Трансграничная передача
            персональных данных не осуществляется. Базы данных находятся на
            территории Российской Федерации.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Сроки обработки и удаление</Text>
          <Text style={styles.text}>
            6.1. Данные обрабатываются до достижения целей обработки, отзыва
            согласия или удаления учётной записи.{"\n\n"}6.2. При удалении
            учётной записи данные немедленно перестают быть доступны другим
            участникам и уничтожаются в срок не более 30 дней. Для
            предотвращения обхода модерации Оператор сохраняет минимальный
            технический след — хэш адреса электронной почты, не позволяющий
            восстановить сам адрес.{"\n\n"}6.3. При отзыве согласия либо
            требовании об уничтожении данных Оператор прекращает обработку и
            уничтожает данные в срок, не превышающий 30 дней, если иное не
            предусмотрено законом.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Права пользователя</Text>
          <Text style={styles.text}>
            7.1. Пользователь вправе: получать сведения об обработке своих
            данных; требовать уточнения, блокирования или уничтожения данных;
            отозвать согласие; обжаловать действия Оператора в Роскомнадзор
            или суд.{"\n\n"}7.2. Обращения направляются через раздел
            «Написать администрации» в Сервисе либо на адрес
            murat.kurdzhiev@yandex.ru. Ответ предоставляется в течение 10
            рабочих дней; срок может быть продлён не более чем на 5 рабочих
            дней с уведомлением заявителя.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Меры защиты</Text>
          <Text style={styles.text}>
            8.1. Оператор принимает организационные и технические меры:
            разграничение доступа по ролям; правила доступа на уровне базы
            данных; шифрование канала связи (https); закрытие сетевых портов
            сервера от внешнего доступа; регулярное резервное копирование;
            ограничение круга лиц с административным доступом; назначение
            ответственного за организацию обработки персональных данных.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Изменения Политики</Text>
          <Text style={styles.text}>
            9.1. Политика может обновляться. Актуальная версия публикуется в
            Сервисе с указанием даты вступления в силу. При изменениях,
            требующих нового согласия, Сервис запросит его отдельно.
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
