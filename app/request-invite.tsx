import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { createInviteRequest } from '../services/inviteRequestService';

export default function RequestInviteScreen() {
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [about, setAbout] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setError('');

      await createInviteRequest({
        fullName,
        contact,
        about,
      });

      Alert.alert(
        'Заявка отправлена',
        'Мы рассмотрим её и свяжемся с вами.'
      );

      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось отправить заявку';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Запрос инвайта</Text>

        <Text style={styles.subtitle}>
          Если у вас нет приглашения, оставьте заявку. Укажите имя и один способ
          связи: телефон или Telegram.
        </Text>

        <TextInput
          placeholder="Ваше имя"
          style={styles.input}
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            setError('');
          }}
        />

        <TextInput
          placeholder="Телефон или Telegram"
          style={styles.input}
          value={contact}
          onChangeText={(text) => {
            setContact(text);
            setError('');
          }}
          autoCapitalize="none"
        />

        <TextInput
          placeholder="Кто вы и чем можете быть полезны (необязательно)"
          style={[styles.input, styles.textArea]}
          value={about}
          onChangeText={(text) => {
            setAbout(text);
            setError('');
          }}
          multiline
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, submitting && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Отправка...' : 'Отправить заявку'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 22,
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
  textArea: {
    height: 110,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.7,
  },
});