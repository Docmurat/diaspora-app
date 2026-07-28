import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { signOutUser } from '../services/sessionService';

export default function ProfileDeletedScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Профиль удалён</Text>

      <Text style={styles.text}>
        Ваш профиль был удалён администрацией и больше недоступен в системе.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={async () => {
          await signOutUser();
          router.replace('/welcome');
        }}
      >
        <Text style={styles.buttonText}>Выйти</Text>
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
    marginBottom: 22,
  },
  button: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});