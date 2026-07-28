import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Alert,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { signOutUser } from '../../services/sessionService';
import { getMyProfile, DbUserProfile } from '../../services/profileService';
import { getAgeFromBirthDate } from '../../store/user';
import LinkedText from '../../components/LinkedText';
import { Feather } from '@expo/vector-icons';
import { createInvite, markInviteAsSent } from '../../services/inviteService';

export default function ProfileScreen() {
  const handleCopyText = async (label: string, value?: string | null) => {
  const text = value?.trim();

  if (!text) return;

  try {
    await Clipboard.setStringAsync(text);
    Alert.alert('Скопировано', `${label} скопирован(о)`);
  } catch (e) {
    Alert.alert('Ошибка', 'Не удалось скопировать');
  }
};

const handleOpenEmail = async () => {
  if (!user?.email) return;

  const url = `mailto:${user.email}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  } catch (e) {
    Alert.alert('Ошибка', 'Не удалось открыть email');
  }
};

const handleTelegramOpen = async () => {
  if (!user?.telegram) return;

  const raw = user.telegram.trim().replace(/^@/, '');
  const appUrl = `tg://resolve?domain=${raw}`;
  const webUrl = `https://t.me/${raw}`;

  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);

    if (canOpenApp) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  } catch (e) {
    Alert.alert('Ошибка', 'Не удалось открыть Telegram');
  }
};
const renderTextWithLinks = (text?: string | null) => {
  if (!text) {
    return <Text style={styles.infoText}>—</Text>;
  }

  const parts = text.split(/(\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+|(?:^|\s)@[\w.]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b)/g);

  return (
    <Text style={styles.infoText}>
      {parts.map((part, index) => {
        if (!part) return null;

        const trimmed = part.trim();

        const isEmail = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(trimmed);
        const isTelegram = /^@[\w.]+$/.test(trimmed);
        const isUrl = /^(https?:\/\/|www\.)/i.test(trimmed);

        if (isEmail) {
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() => Linking.openURL(`mailto:${trimmed}`)}
            >
              {part}
            </Text>
          );
        }

        if (isTelegram) {
          const username = trimmed.replace(/^@/, '');
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={async () => {
                const appUrl = `tg://resolve?domain=${username}`;
                const webUrl = `https://t.me/${username}`;
                const canOpenApp = await Linking.canOpenURL(appUrl);

                if (canOpenApp) {
                  await Linking.openURL(appUrl);
                } else {
                  await Linking.openURL(webUrl);
                }
              }}
            >
              {part}
            </Text>
          );
        }

        if (isUrl) {
          const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
          return (
            <Text
              key={index}
              style={styles.linkText}
              onPress={() => Linking.openURL(url)}
            >
              {part}
            </Text>
          );
        }

        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};
  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const handleCreateInvite = async () => {
  try {
    setCreatingInvite(true);

    const invite = await createInvite();

    const result = await Share.share({
      message: `Мой инвайт-код для Diaspora: ${invite.code}`,
    });

    if (result.action === Share.sharedAction) {
      await markInviteAsSent(invite.id);
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Ошибка создания инвайта';
    Alert.alert('Ошибка', message);
  } finally {
    setCreatingInvite(false);
  }
};

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
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

      refresh();
    }, [])
  );

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
        <Text style={styles.emptyText}>
          Войдите в аккаунт или зарегистрируйтесь заново.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/welcome')}
        >
          <Text style={styles.primaryButtonText}>На главный экран</Text>
        </TouchableOpacity>
      </View>
    );
  }
const handleLogout = async () => {
  try {
    await signOutUser();
    router.replace('/welcome');
  } catch (e) {
    Alert.alert('Ошибка', 'Не удалось выйти');
  }
};
  const fullName =
  `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Без имени';
const age = getAgeFromBirthDate(user.birth_date || '');
const isAdmin = user.role === 'owner' || user.role === 'moderator';

const roleBadgeText =
  user.role === 'owner'
    ? 'ОСНОВАТЕЛЬ'
    : user.role === 'moderator'
    ? 'ADMIN'
    : null;
  

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.headerCard}>
            <View style={styles.headerCenter}>
              {roleBadgeText && (
  <View style={styles.roleBadge}>
    <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
  </View>
)}
<View style={styles.avatarRow}>
  <TouchableOpacity
  style={[styles.inviteCircleButton, creatingInvite && styles.disabledButton]}
  onPress={handleCreateInvite}
  activeOpacity={0.8}
  disabled={creatingInvite}
>
  <Feather name="user-plus" size={22} color="#1F6BFF" />
</TouchableOpacity>

<TouchableOpacity
    style={styles.logoutCircleButton}
    onPress={handleLogout}
    activeOpacity={0.8}
  >
    <Feather name="log-out" size={22} color="#E53935" />
  </TouchableOpacity>

  <View style={styles.avatarCenterWrap}>
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setAvatarModalVisible(true)}
    >
      <Image
        source={
          user.avatar_path
            ? { uri: user.avatar_path }
            : require('../../assets/default-avatar.png')
        }
        style={styles.avatar}
      />
    </TouchableOpacity>
  </View>
</View>

  <Text style={styles.name}>{fullName}</Text>

  <Text style={styles.subInfo}>
    {[user.category, user.city].filter(Boolean).join(', ') || 'Не указано'}
  </Text>

  {!!age && <Text style={styles.age}>{age} лет</Text>}
</View>

            <View style={styles.topButtonsRow}>
  <TouchableOpacity
    style={styles.primaryButtonWide}
    onPress={() => router.push('/invites' as any)}
  >
    <Text style={styles.primaryButtonWideText}>Инвайты</Text>
  </TouchableOpacity>

  {isAdmin && (
    <TouchableOpacity
      style={[styles.primaryButtonWide, styles.adminWideButton]}
      onPress={() => router.push('/moderation')}
    >
      <Text style={styles.primaryButtonWideText}>Модерация</Text>
    </TouchableOpacity>
  )}
</View>

            <TouchableOpacity
              style={styles.editWideButton}
              onPress={() => router.push('/edit-profile')}
            >
              <Text style={styles.editWideButtonText}>Редактировать профиль</Text>
            </TouchableOpacity>
          </View>

          
          
          <TouchableOpacity
  activeOpacity={0.9}
  onLongPress={() => handleCopyText('Сфера деятельности', user.category)}
  delayLongPress={300}
  style={styles.infoBlock}
>
  <Text style={styles.infoTitle}>Сфера деятельности</Text>
  <Text style={styles.infoText}>{user.category || '—'}</Text>
</TouchableOpacity>

<TouchableOpacity
  activeOpacity={0.9}
  onLongPress={() => handleCopyText('Профессия', user.profession)}
  delayLongPress={300}
  style={styles.infoBlock}
>
  <Text style={styles.infoTitle}>Профессия</Text>
  <Text style={styles.infoText}>{user.profession || '—'}</Text>
</TouchableOpacity>

<TouchableOpacity
  activeOpacity={0.9}
  onLongPress={() =>
    handleCopyText(
      'Локация',
      [user.city, user.country].filter(Boolean).join(', ')
    )
  }
  delayLongPress={300}
  style={styles.infoBlock}
>
  <Text style={styles.infoTitle}>Локация</Text>
  <Text style={styles.infoText}>
    {[user.city, user.country].filter(Boolean).join(', ') || '—'}
  </Text>
</TouchableOpacity>

<TouchableOpacity
  activeOpacity={0.9}
  onLongPress={() => handleCopyText('Описание', user.bio)}
  delayLongPress={300}
  style={styles.infoBlock}
>
  <Text style={styles.infoTitle}>Чем могу быть полезен</Text>
  {renderTextWithLinks(user.bio)}
</TouchableOpacity>

{!!user.email && (
  <TouchableOpacity
    style={styles.infoBlock}
    onPress={handleOpenEmail}
    onLongPress={() => handleCopyText('Email', user.email)}
    delayLongPress={300}
    activeOpacity={0.9}
  >
    <Text style={styles.infoTitle}>Email</Text>
    <Text style={styles.linkText}>{user.email}</Text>
  </TouchableOpacity>
)}

<TouchableOpacity
  activeOpacity={0.9}
  onLongPress={() => handleCopyText('Телефон', user.phone)}
  delayLongPress={300}
  style={styles.infoBlock}
>
  <Text style={styles.infoTitle}>Телефон</Text>
  <Text style={styles.infoText}>{user.phone || '—'}</Text>
  <Text style={styles.infoHint}>
    {user.phone_visible
      ? 'Номер отображается в профиле.'
      : 'Номер скрыт от пользователей и доступен только администрации.'}
  </Text>
</TouchableOpacity>

{!!user.telegram && (
  <TouchableOpacity
    style={styles.infoBlock}
    onPress={handleTelegramOpen}
    onLongPress={() => handleCopyText('Telegram', user.telegram)}
    delayLongPress={300}
    activeOpacity={0.9}
  >
    <Text style={styles.infoTitle}>Telegram</Text>
    <Text style={styles.linkText}>{user.telegram}</Text>
  </TouchableOpacity>
)}

{!!user.extra_info && (
  <TouchableOpacity
    style={styles.infoBlock}
    onLongPress={() => handleCopyText('Дополнительно', user.extra_info)}
    delayLongPress={300}
    activeOpacity={1}
  >
    <Text style={styles.infoTitle}>Дополнительно</Text>
    {renderTextWithLinks(user.extra_info)}
  </TouchableOpacity>
)}
        </View>
      </ScrollView>

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAvatarModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Image
                source={
                  user.avatar_path
                    ? { uri: user.avatar_path }
                    : require('../../assets/default-avatar.png')
                }
                style={styles.modalAvatar}
                resizeMode="contain"
              />
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
    backgroundColor: '#f7f7f7',
    flexGrow: 1,
  },
headerCenter: {
  alignItems: 'center',
  marginBottom: 20,
},

avatarWrap: {
  width: 220,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
  position: 'relative',
},
disabledButton: {
  opacity: 0.7,
},
avatarCenterWrap: {
  width: 140,
  alignItems: 'center',
  justifyContent: 'center',
},

avatar: {
  width: 140,
  height: 140,
  borderRadius: 70,
  backgroundColor: '#eee',
},
inviteCircleButton: {
 position: 'absolute',

  left: 40, // <-- ключевая настройка (можешь варьировать 18–24)

  width: 56,
  height: 56,
  borderRadius: 28,

 backgroundColor: '#F4F8FF',
  borderWidth: 1.5,
  borderColor: '#1F6BFF',

  alignItems: 'center',
  justifyContent: 'center',
},

inviteCircleInner: {
  width: 82,
  height: 82,
  borderRadius: 41,
  borderWidth: 1.5,
  borderColor: '#1F6BFF',
  borderStyle: 'dashed', // можно оставить
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 8,
},
logoutCircleButton: {
  position: 'absolute',
  right: 40, // зеркально left

  width: 56,
  height: 56,
  borderRadius: 28,

  backgroundColor: '#FFF5F5',
  borderWidth: 1.5,
  borderColor: '#FF6B6B',
  alignItems: 'center',
  justifyContent: 'center',

  zIndex: 2,
},
inviteCircleText: {
  color: '#1F6BFF', // теперь синий
  fontSize: 10,
  lineHeight: 12,
  fontWeight: '400',
  textAlign: 'center',
},
roleBadge: {
  backgroundColor: '#fff4ff',
  borderWidth: 1.5,
  borderColor: '#dd1fff',

  paddingHorizontal: 12,
  paddingVertical: 1,
  borderRadius: 999,

  marginBottom: 15,
},

roleBadgeText: {
  color: '#dd1fff',
  fontSize: 12,
  fontWeight: '500', // не жирный
  letterSpacing: 0.3,
},
linkText: {
  fontSize: 14,
  lineHeight: 20,
  color: '#2E7D32',
},
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
subInfo: {
  fontSize: 13,
  color: '#666',
  marginTop: 4,
  textAlign: 'center',
},
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },

  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },

  card: {
    backgroundColor: 'transparent',
    borderRadius: 18,
  },

  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  headerRow: {
    flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},
avatarRow: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 14,
},

inviteCircleButtonText: {
  color: '#fff',
  fontSize: 24,
  fontWeight: '700',
  lineHeight: 24,
},

  headerInfo: {
   flex: 1,
  marginLeft: 16,
  minWidth: 0,
  justifyContent: 'center',
},

  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
  },

  age: {
    fontSize: 13,
    color: '#2E7D32',
    marginTop: 4,
    fontWeight: '600',
  },

  adminWideButton: {
  backgroundColor: '#c62828',
},

  profession: {
    fontSize: 15,
    color: '#444',
    marginTop: 4,
  },

  city: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },

  headerActions: {
    marginLeft: 10,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F4F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  iconButtonText: {
    fontSize: 16,
  },

  topButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
  },

  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },

  primaryButtonWide: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonWideText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  editWideButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editWideButtonText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 15,
  },

  infoBlock: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111',
  },

  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },

  infoHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#777',
  },

  logoutButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutButtonText: {
    color: '#444',
    fontWeight: '600',
    fontSize: 15,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  modalAvatar: {
    width: '100%',
    height: '70%',
    borderRadius: 20,
  },
});