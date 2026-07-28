import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { signOutUser } from '../services/sessionService';

export default function AccessRestrictedScreen() {
  const handleTelegramOpen = async () => {
    const appUrl = 'tg://resolve?domain=your_admin_username';
    const webUrl = 'https://t.me/doc_murat';

    const canOpenApp = await Linking.canOpenURL(appUrl);

    if (canOpenApp) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Доступ ограничен</Text>

      <Text style={styles.text}>
        Ваш доступ к сообществу временно ограничен.
      </Text>

      <Text style={styles.text}>
        Для уточнения причин и решения вопроса свяжитесь с администрацией.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={handleTelegramOpen}>
        <Text style={styles.primaryButtonText}>Связаться в Telegram</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={async () => {
          await signOutUser();
          router.replace('/welcome');
        }}
      >
        <Text style={styles.secondaryButtonText}>Выйти</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#111',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    textAlign: 'center',
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});