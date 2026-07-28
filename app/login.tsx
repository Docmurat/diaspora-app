import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { translateAuthError } from '../services/errorService';
import { router } from 'expo-router';
import { signInUser, getCurrentProfile } from '../services/sessionService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль');
      return;
    }

    try {
      await signInUser(email, password);
      const profile = await getCurrentProfile();

      if (!profile) {
        setError('Профиль пользователя не найден');
        return;
      }

      if (profile.is_deleted) {
        setError('');
        router.replace('/profile-deleted');
        return;
      }

      if (profile.is_blocked) {
        setError('');
        router.replace('/access-restricted');
        return;
      }

      if (profile.moderation_status === 'approved') {
        setError('');
        router.replace('/splash');
        return;
      }

     if (
  profile.moderation_status === 'pending' ||
  profile.moderation_status === 'needs_revision'
) {
  setError('');
  router.replace('/pending-approval');
  return;
} 

      setError('Доступ к аккаунту ограничен');
    } catch (e) {
  setError(translateAuthError(e));
}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вход</Text>

      <TextInput
        placeholder="Электронная почта"
        style={styles.input}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError('');
        }}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        placeholder="Пароль"
        style={styles.input}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError('');
        }}
        secureTextEntry
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Продолжить</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/invite')}>
        <Text style={styles.link}>Нет аккаунта? Ввести инвайт-код</Text>
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
    marginBottom: 24,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 18,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    color: '#2E7D32',
    textAlign: 'center',
    fontSize: 14,
  },
});