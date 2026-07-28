import { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Modal,
  ImageBackground,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { getAgeFromBirthDate } from '../store/user';
import { supabase } from '../lib/supabase';
import { getMyProfile } from '../services/profileService';
import {
  assignModerator,
  removeModerator,
  blockUser,
  softDeleteUser,
} from '../services/moderationService';
import {
  blockUserForMe,
  unblockUserForMe,
  hasMutualBlock,
} from '../services/userBlockService';
import {
  addFavoriteToDb,
  removeFavoriteFromDb,
  isFavoriteInDb,
} from '../services/favoritesService';

function formatCreatedAt(dateString?: string | null) {
  if (!dateString) return 'Неизвестно';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Неизвестно';
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const DETECTABLE_LINK_REGEX =
  /((?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|instagram\.com\/|facebook\.com\/|linkedin\.com\/|github\.com\/|x\.com\/|twitter\.com\/)[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function splitTextWithLinks(text: string) {
  return text.split(DETECTABLE_LINK_REGEX);
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[),.!?;:]+$/g, '');
}

function isEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}

function looksLikeLink(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (isEmail(trimmed)) return true;

  return /^(https?:\/\/|www\.|t\.me\/|telegram\.me\/|instagram\.com\/|facebook\.com\/|linkedin\.com\/|github\.com\/|x\.com\/|twitter\.com\/)/i.test(
    trimmed
  );
}

function buildOpenableLink(value: string) {
  const trimmed = trimTrailingPunctuation(value.trim());

  if (isEmail(trimmed)) {
    return `mailto:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const profileId = String(params.id || '');
  const moderationUserId =
    typeof params.userId === 'string' ? params.userId : String(params.userId || '');
  const isModerationMode = params.mode === 'moderation';
  const targetUserId = isModerationMode ? moderationUserId : profileId;

  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [blockState, setBlockState] = useState({
    iBlockedUser: false,
    userBlockedMe: false,
    isAnyBlocked: false,
  });

  const loadProfile = async () => {
    try {
      setLoading(true);

      if (isModerationMode) {
        const [profileResult, myProfile] = await Promise.all([
          supabase
            .from('users')
            .select(`
              *,
              invited_by:invited_by_user_id (
                id,
                first_name,
                last_name,
                email
              )
            `)
            .eq('id', targetUserId)
            .single(),
          getMyProfile(),
        ]);

        if (profileResult.error) {
          throw new Error(profileResult.error.message);
        }

        setUser(profileResult.data);
        setMe(myProfile);
        setBlockState({
          iBlockedUser: false,
          userBlockedMe: false,
          isAnyBlocked: false,
        });
        setIsFavorite(false);
        return;
      }

      const [profileResult, myProfile, relation, favoriteStatus] = await Promise.all([
        supabase
          .from('users')
          .select(`
            *,
            invited_by:invited_by_user_id (
              id,
              first_name,
              last_name,
              email
            )
          `)
          .eq('id', targetUserId)
          .single(),
        getMyProfile(),
        hasMutualBlock(targetUserId),
        isFavoriteInDb(targetUserId).catch(() => false),
      ]);

      if (profileResult.error) {
        throw new Error(profileResult.error.message);
      }

      setUser(profileResult.data);
      setMe(myProfile);
      setBlockState(relation);
      setIsFavorite(!!favoriteStatus);
    } catch (e) {
      console.log('Ошибка загрузки профиля:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
  useCallback(() => {
    if (targetUserId) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [targetUserId, isModerationMode])
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
        <Text style={styles.emptyTitle}>Пользователь не найден</Text>
      </View>
    );
  }

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const age = getAgeFromBirthDate(user.birth_date || '');

  const isAdmin = me?.role === 'owner' || me?.role === 'moderator';
  const isOwner = me?.role === 'owner';
  const isOwnProfile = me?.id === user.id;

  const invitedByName = user.invited_by
    ? `${user.invited_by.first_name || ''} ${user.invited_by.last_name || ''}`.trim()
    : '';

  const restrictedByTargetUser = blockState.userBlockedMe;
  const iBlockedThisUser = blockState.iBlockedUser;

  const canModerationViewBlockedProfile = isAdmin || isModerationMode;

  const canWriteToUser =
    !isOwnProfile &&
    !iBlockedThisUser &&
    !restrictedByTargetUser &&
    !isModerationMode;

  const showDirectContact = canWriteToUser;

  const showPhone = isModerationMode
    ? !!user.phone
    : (user.phone_visible || isAdmin) &&
      (!restrictedByTargetUser || canModerationViewBlockedProfile);

  const showTelegram = isModerationMode
    ? !!user.telegram
    : !!user.telegram &&
      (!restrictedByTargetUser || canModerationViewBlockedProfile);

  const showEmail = isModerationMode
    ? !!user.email
    : !!user.email &&
      (!restrictedByTargetUser || canModerationViewBlockedProfile);

  const showAdditional = isModerationMode
    ? !!user.extra_info
    : !!user.extra_info &&
      (!restrictedByTargetUser || canModerationViewBlockedProfile);

  const handleCopyText = async (label: string, value?: string | null) => {
    const text = value?.trim();

    if (!text) {
      Alert.alert('Нечего копировать');
      return;
    }

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Скопировано', `${label} скопировано`);
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать текст');
    }
  };

  const handleAssignModerator = async () => {
    try {
      await assignModerator(user.id);
      setShowMenu(false);
      await loadProfile();
      Alert.alert('Готово', 'Пользователь назначен модератором.');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка назначения модератора';
      Alert.alert('Ошибка', message);
    }
  };

  const handleRemoveModerator = async () => {
    try {
      await removeModerator(user.id);
      setShowMenu(false);
      await loadProfile();
      Alert.alert('Готово', 'Модератор снят.');
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка снятия модератора';
      Alert.alert('Ошибка', message);
    }
  };

  const handleBlockUserAdmin = async () => {
    try {
      await blockUser(user.id);
      setShowMenu(false);
      Alert.alert('Готово', 'Пользователь заблокирован.');
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка блокировки';
      Alert.alert('Ошибка', message);
    }
  };

  const handleDeleteUser = async () => {
    try {
      await softDeleteUser(user.id);
      setShowMenu(false);
      Alert.alert('Готово', 'Профиль помечен как удалённый.');
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка удаления профиля';
      Alert.alert('Ошибка', message);
    }
  };

  const handleTogglePersonalBlock = async () => {
    try {
      if (iBlockedThisUser) {
        await unblockUserForMe(user.id);
        setBlockState({
          iBlockedUser: false,
          userBlockedMe: blockState.userBlockedMe,
          isAnyBlocked: blockState.userBlockedMe,
        });
        setShowMenu(false);
        Alert.alert('Готово', 'Пользователь снова доступен для взаимодействия.');
      } else {
        await blockUserForMe(user.id);
        setBlockState({
          iBlockedUser: true,
          userBlockedMe: blockState.userBlockedMe,
          isAnyBlocked: true,
        });
        setShowMenu(false);
        Alert.alert(
          'Пользователь заблокирован',
          'Теперь этот пользователь не сможет писать вам и не увидит ваши контактные данные.'
        );
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка пользовательской блокировки';
      Alert.alert('Ошибка', message);
    }
  };

  const handleReport = () => {
    setShowMenu(false);
    router.push({
      pathname: '/report-user',
      params: {
        userId: user.id,
        userName: fullName,
      },
    });
  };

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await removeFavoriteFromDb(user.id);
        setIsFavorite(false);
      } else {
        await addFavoriteToDb(user.id);
        setIsFavorite(true);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка изменения избранного';
      Alert.alert('Ошибка', message);
    }
  };

  const handleTelegramOpen = async () => {
    if (!user?.telegram) return;

    const username = String(user.telegram).replace('@', '');
    const appUrl = `tg://resolve?domain=${username}`;
    const webUrl = `https://t.me/${username}`;

    const canOpenApp = await Linking.canOpenURL(appUrl);

    if (canOpenApp) {
      await Linking.openURL(appUrl);
    } else {
      await Linking.openURL(webUrl);
    }
  };

  const handleOpenEmail = async () => {
    if (!user?.email) return;

    const emailUrl = `mailto:${user.email}`;

    try {
      const canOpen = await Linking.canOpenURL(emailUrl);

      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Ошибка', 'Не удалось открыть email');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть email');
    }
  };

  const handleOpenDetectedLink = async (rawValue: string) => {
    try {
      const url = buildOpenableLink(rawValue);
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Ошибка', 'Не удалось открыть ссылку');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось открыть ссылку');
    }
  };

  const renderTextWithLinks = (text?: string | null) => {
    if (!text) {
      return <Text style={styles.infoText}>—</Text>;
    }

    const parts = splitTextWithLinks(text);

    return (
      <Text style={styles.infoText}>
        {parts.map((part, index) => {
          if (!part) return null;

          const trimmed = trimTrailingPunctuation(part);

          if (looksLikeLink(trimmed)) {
            const trailing = part.slice(trimmed.length);

            return (
              <Text key={`${trimmed}-${index}`}>
                <Text
                  style={styles.linkText}
                  onPress={() => handleOpenDetectedLink(trimmed)}
                >
                  {trimmed}
                </Text>
                {!!trailing && <Text style={styles.infoText}>{trailing}</Text>}
              </Text>
            );
          }

          return (
            <Text key={`${part}-${index}`} style={styles.infoText}>
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const renderMenu = () => {
    if (isOwnProfile || isModerationMode) {
      return null;
    }

    return (
      <View style={styles.menuWrap}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu((prev) => !prev)}
        >
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>

        {showMenu && (
          <View style={styles.menuDropdown}>
            {isAdmin && (
              <>
                <View style={styles.menuInfoBlock}>
                  <Text style={styles.menuInfoLabel}>Дата регистрации</Text>
                  <Text style={styles.menuInfoText}>
                    {formatCreatedAt(user.created_at)}
                  </Text>
                </View>

                <View style={styles.menuInfoBlock}>
                  <Text style={styles.menuInfoLabel}>Пригласил</Text>
                  <Text style={styles.menuInfoText}>
                    {invitedByName || user.invited_by?.email || 'Не указано'}
                  </Text>
                </View>

                <View style={styles.menuDivider} />
              </>
            )}

            {isOwner && user.role !== 'moderator' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleAssignModerator}
              >
                <Text style={styles.menuItemText}>Назначить модератором</Text>
              </TouchableOpacity>
            )}

            {isOwner && user.role === 'moderator' && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleRemoveModerator}
              >
                <Text style={styles.menuItemText}>Снять модератора</Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleDeleteUser}
              >
                <Text style={[styles.menuItemText, styles.dangerText]}>
                  Удалить профиль
                </Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleBlockUserAdmin}
              >
                <Text style={[styles.menuItemText, styles.dangerText]}>
                  Заблокировать пользователя
                </Text>
              </TouchableOpacity>
            )}

            {!isAdmin && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleReport}
                >
                  <Text style={styles.menuItemText}>Пожаловаться</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleTogglePersonalBlock}
                >
                  <Text style={[styles.menuItemText, styles.dangerText]}>
                    {iBlockedThisUser ? 'Снять блок' : 'Заблокировать'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderProfileActions = () => {
    if (isModerationMode) {
      return (
        <>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={() =>
              router.push({
                pathname: '/moderation-edit-profile',
                params: { userId: user.id },
              })
            }
          >
            <Text style={styles.secondaryActionButtonText}>Редактировать</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionButton, styles.lastActionButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryActionButtonText}>
              Назад в модерацию
            </Text>
          </TouchableOpacity>
        </>
      );
    }

    if (isOwnProfile) {
      return (
        <>
          <TouchableOpacity
            style={styles.secondaryActionButton}
            onPress={() => router.push('/invites' as any)}
          >
            <Text style={styles.secondaryActionButtonText}>Инвайты</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionButton, styles.lastActionButton]}
            onPress={() => router.push('/edit-profile' as any)}
          >
            <Text style={styles.secondaryActionButtonText}>Редактировать</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <TouchableOpacity
          style={[styles.secondaryActionButton, styles.messageButton]}
          onPress={() =>
            router.push({
              pathname: '/chat',
              params: { name: fullName, userId: user.id },
            })
          }
          disabled={!showDirectContact}
        >
          <Text
            style={[
              styles.secondaryActionButtonText,
              !showDirectContact && styles.disabledActionButtonText,
            ]}
          >
            Написать
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.favoriteButton, styles.lastActionButton]}
          onPress={handleToggleFavorite}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFavorite ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color="#2E7D32"
          />
        </TouchableOpacity>
      </>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ImageBackground
        source={require('../assets/mountains.png')}
        style={styles.heroBackground}
        imageStyle={styles.heroBackgroundImage}
        resizeMode="contain"
      />

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.avatarModalOverlay}>
          <TouchableOpacity
            style={styles.avatarModalBackdrop}
            activeOpacity={1}
            onPress={() => setAvatarModalVisible(false)}
          />

          <View style={styles.avatarModalContent}>
            <TouchableOpacity
              style={styles.avatarModalClose}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <Image
              source={
                user.avatar_path
                  ? { uri: user.avatar_path }
                  : require('../assets/default-avatar.png')
              }
              style={styles.avatarModalImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

      <View style={styles.card}>
        {showMenu && (
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowMenu(false)}
          />
        )}

        {renderMenu()}

        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setAvatarModalVisible(true)}
          >
            <Image
              source={
                user.avatar_path
                  ? { uri: user.avatar_path }
                  : require('../assets/default-avatar.png')
              }
              style={styles.avatar}
            />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text
              style={styles.name}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {fullName || 'Без имени'}
            </Text>
            {!!age && <Text style={styles.age}>{age} лет</Text>}
            <Text style={styles.profession}>
              {[user.category, user.city].filter(Boolean).join(', ') || '—'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>{renderProfileActions()}</View>

        {isOwnProfile && isAdmin && !isModerationMode && (
          <TouchableOpacity
            style={styles.adminButton}
            onPress={() => router.push('/moderation' as any)}
          >
            <Text style={styles.adminButtonText}>Модерация</Text>
          </TouchableOpacity>
        )}

        {isModerationMode && (
          <View style={styles.moderationModeBadge}>
            <Text style={styles.moderationModeBadgeText}>
              Режим модерации
            </Text>
          </View>
        )}

        {iBlockedThisUser && !isOwnProfile && !isModerationMode && (
          <View style={styles.blockLine}>
            <Text style={styles.blockLineText}>Пользователь заблокирован</Text>
          </View>
        )}

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
          activeOpacity={0.95}
          onLongPress={() => handleCopyText('Описание', user.bio)}
          delayLongPress={300}
          style={styles.quoteSoftBlock}
        >
          <Text style={styles.quoteSoftMark}>“</Text>
          <Text style={styles.quoteSoftText}>{user.bio || '—'}</Text>
          <Text style={styles.quoteSoftMarkEnd}>”</Text>
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

        {showEmail && (
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

        {showPhone && (
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleCopyText('Телефон', user.phone)}
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>Телефон</Text>
            <Text style={styles.infoText}>{user.phone || '—'}</Text>
          </TouchableOpacity>
        )}

        {showTelegram && (
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

        {showAdditional && (
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
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    backgroundColor: '#f4f7f4',
    flexGrow: 1,
  },
  heroBackground: {
    height: 220,
    backgroundColor: '#f4f7f4',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroBackgroundImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    marginTop: -68,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    position: 'relative',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarModalContent: {
    width: '88%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarModalClose: {
    position: 'absolute',
    top: -44,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  avatarModalImage: {
    width: '100%',
    height: 360,
    borderRadius: 24,
    backgroundColor: '#111',
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
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  menuWrap: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 20,
    alignItems: 'flex-end',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    fontSize: 20,
    color: '#222',
    marginTop: -2,
  },
  menuDropdown: {
    marginTop: 8,
    minWidth: 240,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  menuInfoBlock: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menuInfoLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  menuInfoText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemText: {
    fontSize: 14,
    color: '#222',
  },
  dangerText: {
    color: '#b3261e',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingRight: 44,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 6,
  },
  age: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 4,
  },
  profession: {
    fontSize: 15,
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  secondaryActionButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageButton: {
    flex: 4,
  },
  favoriteButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  lastActionButton: {
    marginRight: 0,
  },
  secondaryActionButtonText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 15,
  },
  disabledActionButtonText: {
    color: '#9aa59b',
  },
  adminButton: {
    marginBottom: 14,
    backgroundColor: '#111',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  adminButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  moderationModeBadge: {
    marginBottom: 14,
    backgroundColor: '#eef6ee',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  moderationModeBadgeText: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 14,
  },
  blockLine: {
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ececec',
    paddingVertical: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  blockLineText: {
    fontSize: 13,
    color: '#888',
  },
  infoBlock: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
  },
  linkText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#2E7D32',
  },
  quoteSoftBlock: {
    marginTop: 14,
    backgroundColor: '#FFFBEA',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1.2,
    borderColor: '#E8DFAF',
    borderStyle: 'dashed',
  },
  quoteSoftMark: {
    fontSize: 40,
    lineHeight: 40,
    color: '#D6C27A',
    marginBottom: -10,
  },
  quoteSoftMarkEnd: {
    fontSize: 40,
    lineHeight: 40,
    color: '#D6C27A',
    alignSelf: 'flex-end',
    marginTop: -10,
  },
  quoteSoftText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3A3320',
    fontStyle: 'italic',
    marginLeft: 2,
  },
});