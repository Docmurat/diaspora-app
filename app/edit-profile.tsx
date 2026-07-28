import { useCallback, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  View,
  Image,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  formatBirthDateForInput,
  formatBirthDateInput,
  normalizeBirthDate,
} from '../store/user';
import {
  getMyProfile,
  DbUserProfile,
  syncMyEmailFromAuth,
} from '../services/profileService';
import { supabase } from '../lib/supabase';
import {
  uploadAvatar,
  isRemoteAvatar,
  removeAllUserAvatars,
} from '../services/storageService';
import { softDeleteMyAccount } from '../services/profileService';

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

export default function EditProfileScreen() {
  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
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
  const [error, setError] = useState('');
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountDeleting, setAccountDeleting] = useState(false);

  const canEditNameDirectly =
  user?.role === 'moderator' ||
  user?.role === 'owner' ||
  (user as any)?.moderation_status === 'needs_revision';

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      await syncMyEmailFromAuth();
      const profile = await getMyProfile();
      setUser(profile);

      if (profile) {
        setFirstName(profile.first_name || '');
        setLastName(profile.last_name || '');
        setEmail(profile.email || '');
        setPhone(profile.phone || '');
        setPhoneVisible(profile.phone_visible ?? true);
        setBirthDateInput(formatBirthDateForInput(profile.birth_date || ''));
        setCountry(profile.country || '');
        setCity(profile.city || '');
        setCategory(profile.category || '');
        setProfession(profile.profession || '');
        setBio(profile.bio || '');
        setTelegram(profile.telegram || '');
        setExtraInfo(profile.extra_info || '');
        setAvatarUri(profile.avatar_path || '');
        setAvatarMarkedForRemoval(false);
      }
    } catch (e) {
      console.log('Ошибка загрузки профиля для редактирования:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

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
      !email.trim() ||
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

    if (canEditNameDirectly && (!firstName.trim() || !lastName.trim())) {
      setError('Имя и фамилия не могут быть пустыми');
      return;
    }

    const normalizedBirthDate = normalizeBirthDate(birthDateInput);
    if (!normalizedBirthDate) {
      setError('Дата рождения должна быть в формате ДД.ММ.ГГГГ');
      return;
    }

    if (!user) {
      setError('Профиль не найден');
      return;
    }

    let avatarToSave: string | null = avatarMarkedForRemoval
      ? null
      : avatarUri || null;

    if (avatarMarkedForRemoval) {
      await removeAllUserAvatars(user.id);
      avatarToSave = null;
    } else if (avatarUri && !isRemoteAvatar(avatarUri)) {
      await removeAllUserAvatars(user.id);
      const uploaded = await uploadAvatar(user.id, avatarUri);
      avatarToSave = uploaded.publicUrl;
    }

    const { data: updatedUser, error: updateError } = await supabase
  .from('users')
  .update({
    ...(canEditNameDirectly
      ? {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        }
      : {}),
    email,
    phone,
    phone_visible: phoneVisible,
    birth_date: normalizedBirthDate,
    country,
    city,
    category,
    profession,
    bio,
    telegram: telegram || null,
    extra_info: extraInfo || null,
    avatar_path: avatarToSave,
    updated_at: new Date().toISOString(),
  })
  .eq('id', user.id)
  .select('id, moderation_status')
  .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }
    Alert.alert(
  'Статус после сохранения',
  String(updatedUser?.moderation_status || 'нет статуса')
);

    router.back();
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

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Профиль не найден</Text>
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
          style={[styles.input, !canEditNameDirectly && styles.disabledInput]}
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            setError('');
          }}
          editable={canEditNameDirectly}
        />

        <TextInput
          placeholder="Фамилия"
          style={[styles.input, !canEditNameDirectly && styles.disabledInput]}
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            setError('');
          }}
          editable={canEditNameDirectly}
        />

        {!canEditNameDirectly && (
          <>
            <Text style={styles.hint}>
              Имя и фамилия меняются только после модерации администрацией.
            </Text>

            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => router.push('/request-name-change')}
            >
              <Text style={styles.requestButtonText}>Запросить изменение</Text>
            </TouchableOpacity>
          </>
        )}

        <TextInput
          placeholder="Электронная почта"
          style={[styles.input, styles.disabledInput]}
          value={email}
          editable={false}
        />

        <Text style={styles.hint}>
          Сменить почту можно только через подтверждение новой электронной почты.
        </Text>

        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => router.push('/change-email')}
        >
          <Text style={styles.requestButtonText}>Сменить почту</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Пароль можно изменить отдельно в безопасном режиме.
        </Text>

        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => router.push('/change-password')}
        >
          <Text style={styles.requestButtonText}>Сменить пароль</Text>
        </TouchableOpacity>

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
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Отмена</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
            <Text style={styles.primaryButtonText}>Сохранить</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() => setShowDeleteConfirm(true)}
          disabled={accountDeleting}
        >
          <Text style={styles.deleteAccountText}>Удалить аккаунт</Text>
        </TouchableOpacity>

        {showDeleteConfirm && (
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.deleteConfirmTitle}>
              Вы уверены, что хотите удалить аккаунт?
            </Text>

            <Text style={styles.deleteConfirmText}>
              Аккаунт будет удалён без возможности восстановления.
            </Text>

            <View style={styles.deleteConfirmButtonsRow}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={accountDeleting}
              >
                <Text style={styles.deleteCancelButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  accountDeleting && styles.deleteConfirmButtonDisabled,
                ]}
                onPress={async () => {
                  try {
                    setAccountDeleting(true);
                    setError('');

                    await softDeleteMyAccount();
                    await supabase.auth.signOut();

                    router.replace('/welcome');
                  } catch (e) {
                    console.log('Ошибка удаления аккаунта:', e);
                    setError('Не удалось удалить аккаунт');
                  } finally {
                    setAccountDeleting(false);
                  }
                }}
                disabled={accountDeleting}
              >
                <Text style={styles.deleteConfirmButtonText}>
                  {accountDeleting ? 'Удаление...' : 'Удалить навсегда'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
  },
  deleteConfirmBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#f0c9c9',
    backgroundColor: '#fff7f7',
    borderRadius: 12,
    padding: 14,
  },
  deleteConfirmTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#a61b1b',
    marginBottom: 8,
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 14,
  },
  deleteConfirmButtonsRow: {
    flexDirection: 'row',
  },
  deleteCancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#bbb',
    padding: 14,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  deleteCancelButtonText: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#555',
    fontSize: 15,
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#c62828',
    padding: 14,
    borderRadius: 10,
    marginLeft: 8,
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.7,
  },
  deleteConfirmButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
    fontSize: 15,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
  deleteAccountButton: {
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#c62828',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  deleteAccountText: {
    color: '#c62828',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
  requestButton: {
    alignSelf: 'flex-start',
    marginTop: -4,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
  },
  requestButtonText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 14,
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
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});