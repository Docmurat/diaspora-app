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
import { useLanguage } from "../services/i18nService";

export default function PrivacyScreen() {
  // Язык: en — английский текст (справочный перевод, вычитан владельцем
  // 24.08.2026), ru/kb — русский оригинал. Версии в журнале согласий едины.
  const lang = useLanguage();
  const en = lang === "en";
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
          <Text style={styles.backLinkText}>{en ? "← Back" : "← Назад"}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {en ? "Privacy Policy" : "Политика конфиденциальности"}
        </Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.updated}>
          {en ? "Version 2.0. Effective date: 3 September 2026" : "Версия 2.0. Дата вступления в силу: 03.09.2026"}
        </Text>

        {en ? (
          <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"1. General Provisions"}</Text>
            <Text style={styles.text}>{"1.1. This Privacy Policy (hereinafter — the Policy) establishes the procedure for the processing and protection of the personal data of users of the Mingi-Tau service — a private community available through a mobile application and a web version (hereinafter — the Service).\n\n1.2. Personal data operator (data controller): Murat Aliy-Sultanovich Kurdzhiev, a natural person; contact address: murat.kurdzhiev@yandex.ru (hereinafter — the Operator). Information about the Operator is included in the register of operators maintained by Roskomnadzor (the Russian supervisory authority for communications, information technology, and mass media).\n\n1.3. The Policy has been developed in accordance with Federal Law No. 152-FZ of 27 July 2006 “On Personal Data”. By using the Service, the user confirms that they have read the Policy; the data is processed on the basis of separately given consent."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"2. What Data Is Processed"}</Text>
            <Text style={styles.text}>{"2.1. Data provided at registration and in the profile: last name, first name, patronymic; phone number; email address; date of birth; country (countries) and city (cities) of residence; photograph (avatar); field of work and profession; Telegram; information in the “About me” section.\n\n2.2. Content created while using the Service: private messages between members; correspondence with the administration (requests); posts in the sections of the Service as such sections become available.\n\n2.3. Technical data: session (sign-in) information necessary for the operation and security of the Service. The web version uses the browser's local storage to keep the user signed in; no advertising or third-party analytics trackers are used.\n\n2.4. Special categories of personal data and biometric personal data are not collected or processed; the photograph is used solely as a profile image."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"3. Purposes and Legal Grounds"}</Text>
            <Text style={styles.text}>{"3.1. Purposes: registration and maintenance of the account; display of the profile to other members of the private community; exchange of messages and other content between members; communication with the user on matters relating to the operation of the Service, including notifications; moderation, handling of complaints and requests; ensuring the security and operability of the Service.\n\n3.2. Legal grounds: the consent of the personal data subject (Clause 1, Part 1, Article 6 of Law 152-FZ); the necessity of performing the Terms of Use, to which the subject is a party (Clause 5, Part 1, Article 6 of Law 152-FZ)."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"4. Who Can See the Data"}</Text>
            <Text style={styles.text}>{"4.1. User profiles are visible only to members of the private community who have passed moderation. Personal data is made available to a defined group of persons — the members of the Service; the data is not accessible without signing in to the Service and is not published in open sources.\n\n4.2. The user may limit the availability of their contact details to individual members using the tools of the Service (blocking).\n\n4.3. Moderators and the founder of the Service have access to the data to the extent necessary for moderation and the handling of requests."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"5. Disclosure to Third Parties"}</Text>
            <Text style={styles.text}>{"5.1. Personal data is not disclosed to third parties, except for: (a) infrastructure providers supporting the operation of the Service (computing capacity in the territory of the Russian Federation — Yandex.Cloud LLC; delivery of service emails — the Yandex mail service), acting on the Operator's instructions and without the right to use the data independently; (b) cases provided for by the legislation of the Russian Federation.\n\n5.2. No cross-border transfer of personal data takes place. The databases are located in the territory of the Russian Federation."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"6. Processing Periods and Deletion"}</Text>
            <Text style={styles.text}>{"6.1. The data is processed until the purposes of the processing are achieved, the consent is withdrawn, or the account is deleted.\n\n6.2. When the account is deleted, the data immediately ceases to be available to other members and is destroyed within no more than 30 days. To prevent circumvention of moderation, the Operator retains a minimal technical trace — a hash of the email address, which does not allow the address itself to be recovered.\n\n6.3. Upon withdrawal of consent or a demand for the destruction of the data, the Operator ceases the processing and destroys the data within no more than 30 days, unless otherwise provided by law."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"7. User Rights"}</Text>
            <Text style={styles.text}>{"7.1. The user has the right to: receive information about the processing of their data; demand that the data be corrected, blocked, or destroyed; withdraw their consent; and challenge the Operator's actions before Roskomnadzor or a court.\n\n7.2. Requests are submitted via the “Write to the administration” section of the Service or to murat.kurdzhiev@yandex.ru. A reply is provided within 10 business days; this period may be extended by no more than 5 business days, with notice to the applicant."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"8. Protection Measures"}</Text>
            <Text style={styles.text}>{"8.1. The Operator takes organisational and technical measures: role-based access control; access rules at the database level; encryption of the communication channel (https); closing the server's network ports to external access; regular backups; limiting the number of persons with administrative access; appointing a person responsible for organising the processing of personal data."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"9. Changes to the Policy"}</Text>
            <Text style={styles.text}>{"9.1. The Policy may be updated. The current version is published in the Service with its effective date indicated. Where changes require new consent, the Service will request it separately."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.note}>{"This English translation is provided for convenience only; in case of any discrepancy, the Russian version shall prevail."}</Text>
          </View>
          </>
        ) : (
          <>
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
          </>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>{en ? "Back" : "Назад"}</Text>
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

  note: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#8FA79A",
    fontStyle: "italic",
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
