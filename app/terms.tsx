import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

export default function TermsScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Пользовательское соглашение</Text>

      <Text style={styles.updated}>Последнее обновление: 15.04.2026</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Общие условия</Text>
        <Text style={styles.text}>
          Настоящее Пользовательское соглашение регулирует порядок использования
          приложения Diaspora. Используя приложение, пользователь подтверждает
          согласие с условиями настоящего соглашения.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Доступ к сервису</Text>
        <Text style={styles.text}>
          Доступ к регистрации осуществляется только по приглашению. Администрация
          сервиса вправе ограничивать, приостанавливать или отзывать доступ
          пользователей при нарушении правил платформы.
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
          невозможности использования сервиса, за исключением случаев,
          прямо предусмотренных применимым законодательством.
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
        style={styles.button}
        onPress={() => router.back()}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Назад</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 70,
    paddingBottom: 40,
    backgroundColor: '#F7F7F7',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  updated: {
    fontSize: 13,
    color: '#777',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    color: '#444',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});