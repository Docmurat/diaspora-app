import { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  View,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  formatBirthDateForInput,
  normalizeBirthDate,
} from '../store/user';
import { supabase } from '../lib/supabase';
import {
  uploadAvatar,
  isRemoteAvatar,
  removeAllUserAvatars,
} from '../services/storageService';

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

export default function ModerationEditProfileScreen() {
  const params = useLocalSearchParams();
  const userId = String(params.userId || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [birthDateInput, setBirthDateInput] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [profession, setProfession] = useState('');
  const [bio, setBio] = useState('');
  const [telegram, setTelegram] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        throw new Error(error.message || 'Не удалось загрузить профиль');
      }

      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone || '');
      setPhoneVisible(data.phone_visible ?? true);
      setBirthDateInput(formatBirthDateForInput(data.birth_date || ''));
      setCountry(data.country || '');
      setCity(data.city || '');
      setCategory(data.category || '');
      setProfession(data.profession || '');
      setBio(data.bio || '');
      setTelegram(data.telegram || '');
      setExtraInfo(data.extra_info || '');
      setAvatarUri(data.avatar_path || '');
      setAvatarMarkedForRemoval(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось загрузить профиль';
      Alert.alert('Ошибка', message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadProfile();
    } else {
      setLoading(false);
      Alert.alert('Ошибка', 'Не передан userId');
      router.back();
    }
  }, [userId]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Нужно разрешение на доступ к галерее.');
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
      setAvatarMarkedForRemoval(false);
      setError('');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarMarkedForRemoval(true);
    setError('');
  };

  const handleSave = async () => {
    if (
      !phone.trim() ||
      !birthDateInput.trim() ||
      !country.trim() ||
      !city.trim() ||
      !category.trim() ||
      !profession.trim() ||
      !bio.trim()
    ) {
      setError('Заполните все обязательные поля');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      setError('Имя и фамилия не могут быть пустыми');
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError('Дата рождения должна быть в формате ДД.ММ.ГГГГ');
      return;
    }

    try {
      setSaving(true);
      setError('');

      let avatarToSave: string | null = avatarMarkedForRemoval
        ? null
        : avatarUri || null;

      if (avatarMarkedForRemoval) {
        await removeAllUserAvatars(userId).catch(() => {});
        avatarToSave = null;
      } else if (avatarUri && !isRemoteAvatar(avatarUri)) {
  await removeAllUserAvatars(userId);
  const uploaded = await uploadAvatar(userId, avatarUri);
  avatarToSave = uploaded.publicUrl;
}

      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          phone_visible: phoneVisible,
          birth_date: normalizedBirthDate,
          country: country.trim(),
          city: city.trim(),
          category: category.trim(),
          profession: profession.trim(),
          bio: bio.trim(),
          telegram: telegram.trim() || null,
          extra_info: extraInfo.trim() || null,
          avatar_path: avatarToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(updateError.message || 'Не удалось сохранить профиль');
      }

      Alert.alert('Готово', 'Профиль обновлён');
      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось сохранить профиль';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const displayedAvatarSource =
    avatarMarkedForRemoval || !avatarUri
      ? require('../assets/default-avatar.png')
      : { uri: avatarUri };

  const showRemoveButton = !!avatarUri && !avatarMarkedForRemoval;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Редактировать профиль</Text>

        <View style={styles.avatarWrapper}>
          <TouchableOpacity
            style={styles.avatarPicker}
            onPress={handlePickImage}
            activeOpacity={0.85}
          >
            <Image source={displayedAvatarSource} style={styles.avatarImage} />
          </TouchableOpacity>

          {showRemoveButton && (
            <TouchableOpacity
              style={styles.removeAvatarButton}
              onPress={handleRemoveAvatar}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.removeAvatarText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.avatarHint}>
          Нажмите, чтобы изменить фото профиля
        </Text>

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
          placeholder="Электронная почта"
          style={[styles.input, styles.disabledInput]}
          value="Недоступно для редактирования модератором"
          editable={false}
        />

        <Text style={styles.hint}>
          Email нельзя изменять в режиме модерации.
        </Text>

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
          placeholder="Дата рождения (ДД.ММ.ГГГГ)"
          style={styles.input}
          value={birthDateInput}
          onChangeText={(text) => {
            setBirthDateInput(text);
            setError('');
          }}
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
          <Text style={styles.selectArrow}>
            {showCategoryOptions ? '▲' : '▼'}
          </Text>
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
            setError('');
          }}
        />

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
          placeholder="Telegram"
          style={styles.input}
          value={telegram}
          onChangeText={(text) => {
            setTelegram(text);
            setError('');
          }}
        />

        <TextInput
          placeholder="Дополнительные сведения (портфолио, отзывы, ссылки)"
          style={[styles.input, styles.textArea]}
          value={extraInfo}
          onChangeText={(text) => {
            setExtraInfo(text);
            setError('');
          }}
          multiline
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.replace({
                pathname: '/user-profile',
                params: {
                  userId,
                  mode: 'moderation',
                },
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Отмена</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Text>
          </TouchableOpacity>
        </View>
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
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  avatarPicker: {
    alignSelf: 'center',
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  removeAvatarButton: {
    position: 'absolute',
    right: 130,
    top: 40,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
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
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#111',
  },
  disabledInput: {
    backgroundColor: '#f4f4f4',
    color: '#777',
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
  hint: {
    fontSize: 13,
    color: '#666',
    marginTop: -4,
    marginBottom: 14,
    lineHeight: 18,
  },
  error: {
    color: '#c62828',
    marginBottom: 12,
    fontSize: 14,
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
  primaryButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginLeft: 8,
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