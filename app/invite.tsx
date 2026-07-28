import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { translateInviteError } from '../services/errorService';
import { router } from 'expo-router';
import { validateInviteCode } from '../services/inviteService';

export default function Invite() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      setError('Введите инвайт-код');
      return;
    }

    try {
      setChecking(true);
      setError('');

      await validateInviteCode(normalized);

      router.push({
        pathname: '/register',
        params: { inviteCode: normalized },
      });
    } catch (e) {
  console.log('invite check error:', e);
  setError(translateInviteError(e));
} finally {
  setChecking(false);
}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Введите инвайт-код</Text>

      <TextInput
        placeholder="Код"
        style={styles.input}
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setError('');
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!checking}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, checking && styles.disabledButton]}
        onPress={handleCheck}
        disabled={checking}
        activeOpacity={0.85}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Продолжить</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
  Нет инвайта?
</Text>

<TouchableOpacity
  onPress={() => router.push('/request-invite')}
  activeOpacity={0.8}
>
  <Text style={styles.link}>Оставить заявку</Text>
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
  hint: {
  textAlign: 'center',
  marginTop: 20,
  color: '#777',
  fontSize: 14,
},

link: {
  textAlign: 'center',
  marginTop: 6,
  color: '#2E7D32',
  fontSize: 15,
  fontWeight: '600',
},
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111',
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
  button: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  error: {
    color: '#c62828',
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
});