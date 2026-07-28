import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getMyProfile, DbUserProfile } from '../services/profileService';
import { createNameChangeRequest } from '../services/nameChangeService';

export default function RequestNameChangeScreen() {
  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [requestedFirstName, setRequestedFirstName] = useState('');
  const [requestedLastName, setRequestedLastName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        try {
          setLoading(true);
          const profile = await getMyProfile();
          setUser(profile);
        } catch (e) {
          console.log('Ошибка загрузки профиля:', e);
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      loadProfile();
    }, [])
  );

  const handleSubmit = async () => {
    if (
      !requestedFirstName.trim() ||
      !requestedLastName.trim() ||
      !reason.trim()
    ) {
      setError('Заполните все поля');
      return;
    }

    try {
      await createNameChangeRequest({
        requestedFirstName,
        requestedLastName,
        reason,
      });

      setError('');
      setSuccess(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка отправки запроса';
      setError(message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Профиль не найден</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
  return (
    <View style={styles.successContainer}>
      <Text style={styles.title}>Запрос отправлен</Text>

      <Text style={styles.textCenter}>
        Модератор рассмотрит запрос на изменение имени и фамилии.
      </Text>

      <TouchableOpacity
  style={styles.successButton}
  onPress={() => router.replace('/(tabs)/profile')}
>
  <Text style={styles.successButtonText}>Вернуться в профиль</Text>
</TouchableOpacity>
    </View>
  );
}

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Запросить изменение ФИО</Text>

      <Text style={styles.label}>Текущее имя</Text>
      <TextInput
        style={[styles.input, styles.disabledInput]}
        value={user.first_name}
        editable={false}
      />

      <Text style={styles.label}>Текущая фамилия</Text>
      <TextInput
        style={[styles.input, styles.disabledInput]}
        value={user.last_name}
        editable={false}
      />

      <Text style={styles.label}>Новое имя</Text>
      <TextInput
        style={styles.input}
        value={requestedFirstName}
        onChangeText={(text) => {
          setRequestedFirstName(text);
          setError('');
        }}
        placeholder="Введите новое имя"
      />

      <Text style={styles.label}>Новая фамилия</Text>
      <TextInput
        style={styles.input}
        value={requestedLastName}
        onChangeText={(text) => {
          setRequestedLastName(text);
          setError('');
        }}
        placeholder="Введите новую фамилию"
      />

      <Text style={styles.label}>Причина</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={reason}
        onChangeText={(text) => {
          setReason(text);
          setError('');
        }}
        placeholder="Например: ошибка при регистрации, опечатка, смена фамилии"
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

        <TouchableOpacity style={styles.buttonSmall} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Отправить</Text>
        </TouchableOpacity>
      </View>
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
  loader: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 20,
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
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  disabledInput: {
    backgroundColor: '#f4f4f4',
    color: '#777',
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
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
  buttonSmall: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 12,
    marginLeft: 8,
  },
  button: {
    backgroundColor: 'rgb(46, 125, 50)',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
    
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  successContainer: {
  flex: 1,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},

textCenter: {
  fontSize: 16,
  color: '#555',
  textAlign: 'center',
  lineHeight: 24,
  marginBottom: 24,
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