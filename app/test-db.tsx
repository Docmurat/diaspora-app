import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

export default function TestDbScreen() {
  const [result, setResult] = useState('Нажми кнопку для проверки');

  const handleTest = async () => {
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
      setResult(`Ошибка: ${error.message}`);
      return;
    }

    setResult(`Подключение работает. Строк: ${data?.length ?? 0}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{result}</Text>

      <TouchableOpacity style={styles.button} onPress={handleTest}>
        <Text style={styles.buttonText}>Проверить базу</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
});