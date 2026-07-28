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

function getPasswordErrorMessage(message?: string) {
  if (!message) {
    return 'Не удалось изменить пароль.';
  }

  const normalized = message.toLowerCase();

  if (normalized.includes('same password')) {
    return 'Новый пароль должен отличаться от текущего.';
  }

  if (normalized.includes('weak password')) {
    return 'Пароль слишком слабый.';
  }

  if (normalized.includes('password should be at least')) {
    return 'Пароль слишком короткий.';
  }

  if (normalized.includes('reauthentication')) {
    return 'Для смены пароля нужно подтвердить личность повторно.';
  }

  if (normalized.includes('nonce')) {
    return 'Не пройдена повторная проверка безопасности.';
  }

  if (normalized.includes('current password')) {
    return 'Текущий пароль указан неверно.';
  }

  return 'Не удалось изменить пароль.';
}

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      setError('Введите новый пароль.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов.');
      return;
    }

    if (newPassword !== repeatPassword) {
      setError('Новый пароль и подтверждение не совпадают.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const payload: {
        password: string;
        current_password?: string;
      } = {
        password: newPassword,
      };

      if (currentPassword.trim()) {
        payload.current_password = currentPassword;
      }

      const { error: updateError } = await supabase.auth.updateUser(payload);

      if (updateError) {
        setError(getPasswordErrorMessage(updateError.message));
        return;
      }

      setSuccessMessage('Пароль успешно изменён.');
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
    } catch (e: any) {
      console.log('Ошибка смены пароля:', e);
      setError(getPasswordErrorMessage(e?.message));
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
        <Text style={styles.title}>Сменить пароль</Text>

        <Text style={styles.description}>
          Введите новый пароль. Если в проекте включена дополнительная защита,
          может понадобиться текущий пароль или повторное подтверждение.
        </Text>

        <TextInput
          placeholder="Текущий пароль"
          style={styles.input}
          value={currentPassword}
          onChangeText={(text) => {
            setCurrentPassword(text);
            setError('');
            setSuccessMessage('');
          }}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Новый пароль"
          style={styles.input}
          value={newPassword}
          onChangeText={(text) => {
            setNewPassword(text);
            setError('');
            setSuccessMessage('');
          }}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Повторите новый пароль"
          style={styles.input}
          value={repeatPassword}
          onChangeText={(text) => {
            setRepeatPassword(text);
            setError('');
            setSuccessMessage('');
          }}
          secureTextEntry
          autoCapitalize="none"
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
      onPress={handleChangePassword}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryButtonText}>Сохранить</Text>
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