import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { translateAuthError } from '../services/errorService';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { normalizeBirthDate, formatBirthDateInput } from '../store/user';
import { registerUser } from '../services/authService';
import { supabase } from '../lib/supabase';
import { uploadAvatar, isRemoteAvatar } from '../services/storageService';

const categories = [
  'Медицина',
  'Юриспруденция',
  'Образование',
  'IT и технологии',
  'Бизнес и финансы',
  'Строительство и недвижимость',
  'Логистика и транспорт',
  'Услуги и сервис',
  'Маркетинг и медиа',
  'Дизайн и творчество',
  'Государственная служба',
  'Наука и исследования',
  'Спорт и здоровье',
  'Дом и быт',
  'Другое',
];

const professions = [
  'Стоматолог',
  'Терапевт',
  'Хирург',
  'Педиатр',
  'Юрист',
  'Адвокат',
  'Нотариус',
  'Учитель',
  'Преподаватель',
  'Программист',
  'Разработчик',
  'Дизайнер',
  'Маркетолог',
  'Бухгалтер',
  'Финансист',
  'Предприниматель',
  'Логист',
  'Водитель',
  'Риелтор',
  'Строитель',
  'Архитектор',
  'Няня',
  'Тренер',
  'Исследователь',
  'Госслужащий',
];

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const params = useLocalSearchParams();
  const inviteCode = String(params.inviteCode || '');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDateInput, setBirthDateInput] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  const [telegram, setTelegram] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [error, setError] = useState('');
  const [showProfessionSuggestions, setShowProfessionSuggestions] = useState(false);
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const filteredProfessions = useMemo(() => {
    const search = profession.trim().toLowerCase();
    if (!search) return [];

    return professions
      .filter((item) => item.toLowerCase().includes(search))
      .slice(0, 6);
  }, [profession]);

  const checkEmailExists = async (rawEmail: string) => {
  const normalizedEmail = rawEmail.trim().toLowerCase();

  const { data, error } = await supabase.rpc('check_email_exists', {
    input_email: normalizedEmail,
  });

  if (error) {
    throw new Error(error.message);
  }

  return !!data;
};

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Нет доступа', 'Нужно разрешение на доступ к галерее.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setAvatarUri(result.assets[0].uri);
      setError('');
    }
  };

  const goToStepTwo = async () => {
    if (checkingEmail) return;

    if (
      !email.trim() ||
      !password.trim() ||
      !phone.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !birthDateInput.trim() ||
      !country.trim() ||
      !city.trim()
    ) {
      setError('Заполните все обязательные поля');
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError('Дата рождения должна быть в формате ДД.ММ.ГГГГ');
      return;
    }

    try {
      setCheckingEmail(true);
      setError('');

      const emailExists = await checkEmailExists(email);

      if (emailExists) {
        setError('Эта почта уже используется');
        return;
      }

      setStep(2);
    } catch (e) {
  setError(translateAuthError(e));
} finally {
  setCheckingEmail(false);
}
  };

  const handleRegister = async () => {
    if (submitting) return;

    if (!inviteCode.trim()) {
      setError('Инвайт-код не найден. Вернитесь и введите код заново.');
      return;
    }

    if (!category || !profession.trim() || !bio.trim()) {
      setError('Заполните все обязательные поля');
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError('Дата рождения должна быть в формате ДД.ММ.ГГГГ');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const result = await registerUser({
        inviteCode,
        email,
        password,
        phone,
        phoneVisible,
        firstName,
        lastName,
        birthDate: normalizedBirthDate,
        country,
        city,
        category,
        profession,
        bio,
        telegram,
        extraInfo: '',
        avatarPath: null,
      });

      if (avatarUri && !isRemoteAvatar(avatarUri)) {
        const uploaded = await uploadAvatar(result.userId, avatarUri);

        const { error: avatarUpdateError } = await supabase
          .from('users')
          .update({
            avatar_path: uploaded.publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.userId);

        if (avatarUpdateError) {
          throw new Error(avatarUpdateError.message);
        }
      }

      router.replace('/pending-approval');
    } catch (e) {
  setError(translateAuthError(e));
} finally {
  setSubmitting(false);
}
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Регистрация</Text>
        <Text style={styles.stepText}>Шаг {step} из 2</Text>

        {step === 1 && (
          <>
            <TouchableOpacity style={styles.avatarPicker} onPress={handlePickImage}>
              <Image
                source={
                  avatarUri
                    ? { uri: avatarUri }
                    : require('../assets/default-avatar.png')
                }
                style={styles.avatarImage}
              />
            </TouchableOpacity>

            <Text style={styles.avatarHint}>Добавить фото профиля</Text>

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

            <TextInput
              placeholder="Номер телефона"
              style={styles.input}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setError('');
              }}
              keyboardType="phone-pad"
            />

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchTitle}>Показывать номер в профиле</Text>
                <Text style={styles.switchHint}>
                  Выключите, чтобы номер был доступен только администрации
                </Text>
              </View>
              <Switch
                value={phoneVisible}
                onValueChange={setPhoneVisible}
                trackColor={{ false: '#d9d9d9', true: '#81C784' }}
                thumbColor={phoneVisible ? '#2E7D32' : '#f4f4f4'}
              />
            </View>

            <TextInput
              placeholder="Имя"
              style={styles.input}
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                setError('');
              }}
            />

            <TextInput
              placeholder="Фамилия"
              style={styles.input}
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                setError('');
              }}
            />

            <TextInput
  placeholder="Дата рождения (ДД.ММ.ГГГГ)"
  style={styles.input}
  value={birthDateInput}
  onChangeText={(text) => {
    setBirthDateInput(formatBirthDateInput(text));
    setError('');
  }}
  keyboardType="number-pad"
/>

            <TextInput
              placeholder="Страна"
              style={styles.input}
              value={country}
              onChangeText={(text) => {
                setCountry(text);
                setError('');
              }}
            />

            <TextInput
              placeholder="Город"
              style={styles.input}
              value={city}
              onChangeText={(text) => {
                setCity(text);
                setError('');
              }}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, checkingEmail && styles.disabledButton]}
              onPress={goToStepTwo}
              disabled={checkingEmail}
            >
              <Text style={styles.buttonText}>
                {checkingEmail ? 'Проверка...' : 'Далее'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.label}>Сфера деятельности</Text>

            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setShowCategoryOptions((prev) => !prev)}
            >
              <Text
                style={[
                  styles.selectFieldText,
                  !category && styles.selectPlaceholderText,
                ]}
              >
                {category || 'Выберите сферу деятельности'}
              </Text>
              <Text style={styles.selectArrow}>{showCategoryOptions ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showCategoryOptions && (
              <View style={styles.optionsBox}>
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.optionItem}
                    onPress={() => {
                      setCategory(item);
                      setShowCategoryOptions(false);
                      setError('');
                    }}
                  >
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              placeholder="Профессия"
              style={styles.input}
              value={profession}
              onChangeText={(text) => {
                setProfession(text);
                setShowProfessionSuggestions(true);
                setError('');
              }}
              onFocus={() => setShowProfessionSuggestions(true)}
            />

            {showProfessionSuggestions && filteredProfessions.length > 0 && (
              <View style={styles.optionsBox}>
                {filteredProfessions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.optionItem}
                    onPress={() => {
                      setProfession(item);
                      setShowProfessionSuggestions(false);
                    }}
                  >
                    <Text style={styles.optionText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              placeholder="Чем могу быть полезен"
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={(text) => {
                setBio(text);
                setError('');
              }}
              multiline
            />

            <TextInput
              placeholder="Telegram (необязательно)"
              style={styles.input}
              value={telegram}
              onChangeText={(text) => {
                setTelegram(text);
                setError('');
              }}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setError('');
                  setStep(1);
                }}
              >
                <Text style={styles.secondaryButtonText}>Назад</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.buttonSmall, submitting && styles.disabledButton]}
                onPress={handleRegister}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>
                  {submitting ? 'Сохранение...' : 'Завершить'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    padding: 20,
    paddingTop: 70,
    paddingBottom: 80,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 14,
    color: '#777',
    marginBottom: 24,
  },
  avatarPicker: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarHint: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: '#444',
    marginBottom: 8,
    fontWeight: '600',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 14,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  switchHint: {
    fontSize: 12,
    color: '#666',
    lineHeight: 17,
  },
  selectField: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectFieldText: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  selectPlaceholderText: {
    color: '#999',
  },
  selectArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 10,
  },
  optionsBox: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginTop: -6,
    marginBottom: 14,
    overflow: 'hidden',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  textArea: {
    height: 110,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  buttonSmall: {
    flex: 1,
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 30,
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
});