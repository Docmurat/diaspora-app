import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { createComplaint } from '../services/complaintsService';

export default function ReportUserScreen() {
  const params = useLocalSearchParams();
  const targetUserId = String(params.userId || '');
  const targetUserName = String(params.userName || '');

  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Опишите причину жалобы');
      return;
    }

    try {
      await createComplaint({
        targetUserId,
        reason,
      });

      setError('');
      setSuccess(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка отправки жалобы';
      setError(message);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.title}>Жалоба отправлена</Text>
        <Text style={styles.textCenter}>
          Модераторы рассмотрят ваше обращение.
        </Text>

        <TouchableOpacity
          style={styles.successButton}
          onPress={() => router.back()}
        >
          <Text style={styles.successButtonText}>Вернуться</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Пожаловаться</Text>

      <Text style={styles.subtitle}>
        Пользователь: {targetUserName || 'Неизвестно'}
      </Text>

      <Text style={styles.label}>Причина жалобы</Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={reason}
        onChangeText={(text) => {
          setReason(text);
          setError('');
        }}
        placeholder="Опишите, что произошло"
        multiline
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Отмена</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.primaryButtonText}>Отправить</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 70,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#444',
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
    height: 140,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    fontSize: 14,
  },
  textCenter: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    paddingVertical: 15,
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
    paddingVertical: 15,
    borderRadius: 12,
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  successButton: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
  },
  successButtonText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 15,
  },
});