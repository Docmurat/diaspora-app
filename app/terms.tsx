import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
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

export default function TermsScreen() {
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
          {en ? "Terms of Use" : "Пользовательское соглашение"}
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
            <Text style={styles.text}>{"1.1. These Terms of Use (hereinafter — the Terms) govern the use of the Mingi-Tau service — a private community available through a mobile application and a web version (hereinafter — the Service).\n\n1.2. The Service is administered by Murat Aliy-Sultanovich Kurdzhiev, a natural person; contact address: murat.kurdzhiev@yandex.ru (hereinafter — the Administration). The Service is non-commercial.\n\n1.3. The Terms are accepted at registration by a separate checkbox; the fact and the version of acceptance are recorded in the Service log. Use of the Service constitutes agreement with the current version of the Terms.\n\n1.4. Alongside the Terms, the Privacy Policy and the Community Memorandum apply; their current texts are available in the Service."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"2. Access to the Service"}</Text>
            <Text style={styles.text}>{"2.1. Registration is possible only upon an invitation from an existing member or upon a request approved by the Administration.\n\n2.2. A new member's profile undergoes moderation. The Administration may request corrections, decline the application, or approve it; access to the community is granted upon approval.\n\n2.3. The Service may be used by persons aged 16 or over.\n\n2.4. The user undertakes to provide accurate information about themselves at registration and in their profile and to keep it up to date. The account is personal: one person — one account; transferring access to third parties is not permitted."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"3. Rules of Conduct"}</Text>
            <Text style={styles.text}>{"3.1. The community is built on mutual respect and trust; the principles of the community are set out in the Memorandum accepted at registration.\n\n3.2. It is prohibited to use the Service for unlawful activities, spam, insults, harassment, fraud, impersonation, collection of members' data, or the distribution of malicious content.\n\n3.3. The Service stays outside politics and religion: political and religious campaigning is not permitted in the Service.\n\n3.4. Information about members available within the private community (profiles, contacts, correspondence) must not be disseminated outside the Service without the consent of those members."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"4. Profile and Content"}</Text>
            <Text style={styles.text}>{"4.1. The user is responsible for the information they post in their profile and in the Service, including descriptions, links, contact details, photographs, and messages.\n\n4.2. By posting content, the user permits the Service to store it and to display it to other members in accordance with the purpose of the Service; the rights to the content remain with the user.\n\n4.3. The Administration may moderate, hide, or delete content that violates the Terms or the legislation of the Russian Federation."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"5. Moderation and Restrictions"}</Text>
            <Text style={styles.text}>{"5.1. In the event of a violation of the Terms or a threat to the safety of the community, the Administration may restrict certain features, block access to the community, or delete the account.\n\n5.2. The user may limit their own communication with individual members using the tools of the Service (blocking).\n\n5.3. Decisions of the Administration may be appealed via the “Write to the administration” section; the request is reviewed, and the reply is delivered within the Service."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"6. Personal Data"}</Text>
            <Text style={styles.text}>{"6.1. Personal data is processed in accordance with Federal Law No. 152-FZ of 27 July 2006 “On Personal Data” and the Privacy Policy, on the basis of consent given separately at registration.\n\n6.2. The categories of data, the purposes and periods of processing, the destruction procedure, and the user's rights are described in the Privacy Policy."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"7. Account Deletion"}</Text>
            <Text style={styles.text}>{"7.1. The user may delete their account themselves in the Service Settings or by sending a request to the Administration.\n\n7.2. After deletion, the data immediately ceases to be available to other members and is destroyed within no more than 30 days, in accordance with the procedure established by the Privacy Policy.\n\n7.3. Re-registration after deletion is possible by arrangement with the Administration; the procedure for joining the community through an invitation and moderation remains in place."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"8. Liability"}</Text>
            <Text style={styles.text}>{"8.1. The Service is provided on an “as is” basis. The Administration strives to keep the Service running stably but does not guarantee its uninterrupted operation or the preservation of content in the event of technical failures.\n\n8.2. The Administration is not liable for losses arising from the use of, or the inability to use, the Service, or for interactions between members outside the Service, except in cases expressly provided for by applicable law."}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{"9. Amendments"}</Text>
            <Text style={styles.text}>{"9.1. The Administration may amend the Terms. The current version is published in the Service with its effective date indicated.\n\n9.2. Where amendments require renewed acceptance, the Service will request it separately; the acceptance of the new version is recorded in the Service log."}</Text>
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
          </>
        )}

        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>{en ? "Back" : "Назад"}</Text>
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
