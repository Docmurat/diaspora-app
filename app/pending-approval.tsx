import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { signOutUser } from '../services/sessionService';
import { getMyProfile } from '../services/profileService';
import { supabase } from '../lib/supabase';

const RESUBMIT_DEFAULT_MESSAGE =
  'Я исправил(а) анкету и отправляю её на повторное рассмотрение.';

export default function PendingApprovalScreen() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [sendingAgain, setSendingAgain] = useState(false);
  const [resubmitMessage, setResubmitMessage] = useState(
    RESUBMIT_DEFAULT_MESSAGE
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const myProfile = await getMyProfile();
      setProfile(myProfile);

      if (!myProfile?.id) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from('moderation_messages')
        .select('*')
        .eq('request_type', 'invite_request')
        .eq('request_id', myProfile.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setMessages(data || []);
    } catch (e) {
      console.log('Ошибка загрузки pending approval:', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const isNeedsRevision =
    (profile as any)?.moderation_status === 'needs_revision';
  const isRejected = (profile as any)?.moderation_status === 'rejected';

  const moderatorMessages = messages.filter(
    (msg) => msg.author_role === 'moderator' || msg.author_role === 'system'
  );

  const lastModeratorMessage =
    moderatorMessages.length > 0
      ? moderatorMessages[moderatorMessages.length - 1]
      : null;

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  const hasUserResubmittedAfterRevision =
    isNeedsRevision && lastMessage?.author_role === 'user';

  const showRevisionActions =
    isNeedsRevision && !hasUserResubmittedAfterRevision;

  const handleSubmitAgain = async () => {
    if (!profile?.id) {
      Alert.alert('Ошибка', 'Профиль не найден');
      return;
    }

    if (!resubmitMessage.trim()) {
      Alert.alert('Ошибка', 'Введите сообщение для модератора');
      return;
    }

    try {
      setSendingAgain(true);

      const { error: updateError } = await supabase
        .from('users')
        .update({
          moderation_status: 'needs_revision',
          moderator_has_unread_changes: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const { error: messageError } = await supabase
        .from('moderation_messages')
        .insert({
          request_type: 'invite_request',
          request_id: profile.id, // ВАЖНОЕ 1
          author_user_id: profile.id,
          author_role: 'user',
          message: resubmitMessage.trim(),
          read_by_user: true,
          read_by_moderator: false,
        });

      if (messageError) {
        throw new Error(messageError.message);
      }

      setResubmitMessage(RESUBMIT_DEFAULT_MESSAGE);
      await loadData();

      Alert.alert(
        'Отправлено',
        'Анкета повторно отправлена модератору на рассмотрение.'
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось отправить анкету повторно';
      Alert.alert('Ошибка', message);
    } finally {
      setSendingAgain(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        {isRejected
          ? 'Анкета отклонена'
          : showRevisionActions
          ? 'Анкета требует доработки'
          : 'Анкета на рассмотрении'}
      </Text>

      <Text style={styles.text}>
        {isRejected
          ? 'Модератор отклонил вашу анкету. Ознакомьтесь с комментарием ниже.'
          : 'Спасибо за регистрацию. Сейчас ваша анкета проверяется модератором.'}
      </Text>

      {showRevisionActions && (
        <Text style={styles.text}>
          Исправьте данные, затем отправьте анкету на повторное рассмотрение.
        </Text>
      )}

      {(showRevisionActions || isRejected) && lastModeratorMessage && (
        <View style={styles.messagesBlock}>
          <Text style={styles.messagesTitle}>
            Последнее сообщение от модерации:
          </Text>

          <View style={styles.messageCard}>
            <Text style={styles.messageAuthor}>
              {lastModeratorMessage.author_role === 'moderator'
                ? 'Модератор'
                : 'Система'}
            </Text>
            <Text style={styles.messageText}>
              {lastModeratorMessage.message}
            </Text>
          </View>
        </View>
      )}

      {showRevisionActions ? (
        <>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
          >
            <Text style={styles.editButtonText}>Исправить анкету</Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Сообщение модератору</Text>

          <TextInput
            style={styles.textArea}
            value={resubmitMessage}
            onChangeText={setResubmitMessage}
            placeholder="Введите сообщение"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.primaryButton, sendingAgain && styles.buttonDisabled]}
            onPress={handleSubmitAgain}
            disabled={sendingAgain}
          >
            <Text style={styles.primaryButtonText}>
              {sendingAgain ? 'Отправка...' : 'Отправить повторно'}
            </Text>
          </TouchableOpacity>
        </>
      ) : !isRejected ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/contact-admin')}
        >
          <Text style={styles.primaryButtonText}>
            Связаться с администратором
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={async () => {
          await signOutUser();
          router.replace('/welcome');
        }}
      >
        <Text style={styles.secondaryButtonText}>Выйти</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  messagesBlock: {
    marginTop: 30,
    marginBottom: 10,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },
  messageCard: {
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#f3d37a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  messageAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  editButton: {
    backgroundColor: '#f9a825',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  editButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginTop: 6,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#222',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
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