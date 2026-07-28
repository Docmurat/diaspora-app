import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

function getChangeEmailErrorMessage(message?: string) {
  if (!message) {
    return 'Не удалось изменить почту';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('a user with this email address has already been registered')) {
    return 'Пользователь с такой электронной почтой уже зарегистрирован.';
  }

  if (normalized.includes('unable to validate email address')) {
    return 'Введите корректную электронную почту.';
  }

  if (normalized.includes('email rate limit exceeded')) {
    return 'Слишком много попыток. Попробуйте немного позже.';
  }

  if (normalized.includes('same email')) {
    return 'Вы указали текущую электронную почту.';
  }

  if (normalized.includes('for security purposes')) {
    return 'Из соображений безопасности попробуйте выполнить действие позже.';
  }

  return 'Не удалось отправить запрос на смену почты.';
}

export default function ChangeEmailScreen() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChangeEmail = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email) {
      setError('Введите новую почту');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректную почту');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const { error: updateError } = await supabase.auth.updateUser({
        email,
      });

      if (updateError) {
  setError(getChangeEmailErrorMessage(updateError.message));
  return;
}

      setSuccessMessage(
        'Запрос отправлен. Подтвердите смену почты через письмо, которое пришло на ваш email.'
      );
    } catch (e: any) {
  console.log('Ошибка смены почты:', e);
  setError(getChangeEmailErrorMessage(e?.message));
} finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Сменить почту</Text>

        <Text style={styles.description}>
          Укажите новую электронную почту. После этого подтвердите изменение через письмо.
        </Text>

        <TextInput
          placeholder="Новая электронная почта"
          style={styles.input}
          value={newEmail}
          onChangeText={(text) => {
            setNewEmail(text);
            setError('');
            setSuccessMessage('');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!successMessage && <Text style={styles.success}>{successMessage}</Text>}

        <View style={styles.buttonsRow}>
  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={() => router.back()}
    disabled={loading}
  >
    <Text style={styles.secondaryButtonText}>Назад</Text>
  </TouchableOpacity>

  {!!successMessage ? (
    <TouchableOpacity
      style={styles.primaryButton}
      onPress={() => router.back()}
    >
      <Text style={styles.primaryButtonText}>Готово</Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
      onPress={handleChangeEmail}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryButtonText}>Отправить</Text>
      )}
    </TouchableOpacity>
  )}
</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 70,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 18,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  error: {
    color: '#c62828',
    fontSize: 14,
    marginBottom: 12,
  },
  success: {
    color: '#2E7D32',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});