import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getMyProfile } from '../services/profileService';

export default function ContactAdminScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        setProfile(data);

        if (data?.phone) {
          setPhone(data.phone);
        }
      } catch (e) {
        console.log('Ошибка загрузки профиля:', e);
      }
    };

    loadProfile();
  }, []);

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) {
      setError('Заполните все поля');
      return;
    }

    if (!profile?.id) {
      setError('Не удалось определить пользователя');
      return;
    }

    try {
      setSending(true);
      setError('');

      const finalMessage = [
        'Сообщение от пользователя в режиме ожидания.',
        `Телефон для связи: ${phone.trim()}`,
        '',
        message.trim(),
      ].join('\n');

      const { error: insertError } = await supabase
        .from('moderation_messages')
        .insert({
          request_type: 'invite_request',
          request_id: profile.id, // ВАЖНОЕ 1: временно используем userId вместо invite_requests.id
          author_user_id: profile.id,
          author_role: 'user',
          message: finalMessage,
          read_by_user: true,
          read_by_moderator: false,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          moderator_has_unread_changes: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);
      setMessage('');
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Не удалось отправить сообщение';
      setError(msg);
      Alert.alert('Ошибка', msg);
    } finally {
      setSending(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Сообщение отправлено</Text>

        <Text style={styles.text}>
          Ваше сообщение передано администратору. Ожидайте ответа — оно
          появится на экране ожидания.
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Вернуться</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Связаться с администратором</Text>

      <Text style={styles.label}>Телефон для связи</Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          setError('');
        }}
        placeholder="Введите номер"
        keyboardType="phone-pad"
      />

      <Text style={styles.hint}>
        По умолчанию подставлен номер из анкеты. Вы можете изменить его.
      </Text>

      <Text style={styles.label}>Сообщение</Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          setError('');
        }}
        placeholder="Опишите проблему или вопрос"
        multiline
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, sending && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={sending}
      >
        <Text style={styles.buttonText}>
          {sending ? 'Отправка...' : 'Отправить'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 70,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#444',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
  },
  error: {
    color: '#c62828',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});