import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

export default function PrivacyScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Политика конфиденциальности</Text>

      <Text style={styles.updated}>Последнее обновление: 15.04.2026</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Общие положения</Text>
        <Text style={styles.text}>
          Настоящая Политика конфиденциальности описывает, какие данные
          пользователей собираются, как они используются и в каких случаях
          могут обрабатываться в рамках приложения Diaspora.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Какие данные мы обрабатываем</Text>
        <Text style={styles.text}>
          В рамках работы сервиса могут обрабатываться следующие данные:
          имя, фамилия, email, номер телефона, дата рождения, страна, город,
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
        <Text style={styles.sectionTitle}>5. Передача данных третьим лицам</Text>
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