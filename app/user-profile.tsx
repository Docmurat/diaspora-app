import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { firstCity, formatLocations } from "../components/locations";
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import {
  addFavoriteToDb,
  isFavoriteInDb,
  removeFavoriteFromDb,
} from "../services/favoritesService";
import { SENSITIVE_CATEGORIES } from "../services/helpService";
import {
  assignModerator,
  blockUser,
  confirmQualification,
  removeModerator,
  restoreUser,
  revokeQualification,
  softDeleteUser,
  unblockUser,
} from "../services/moderationService";
import { getMyProfile } from "../services/profileService";
import {
  blockUserForMe,
  hasMutualBlock,
  unblockUserForMe,
} from "../services/userBlockService";
import { getAgeFromBirthDate } from "../store/user";

function formatCreatedAt(dateString?: string | null) {
  if (!dateString) return "Неизвестно";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Неизвестно";

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const DETECTABLE_LINK_REGEX =
  /((?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|instagram\.com\/|facebook\.com\/|linkedin\.com\/|github\.com\/|x\.com\/|twitter\.com\/)[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function splitTextWithLinks(text: string) {
  return text.split(DETECTABLE_LINK_REGEX);
}

function trimTrailingPunctuation(value: string) {
  return value.replace(/[),.!?;:]+$/g, "");
}

function isEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}

function looksLikeLink(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (isEmail(trimmed)) return true;

  return /^(https?:\/\/|www\.|t\.me\/|telegram\.me\/|instagram\.com\/|facebook\.com\/|linkedin\.com\/|github\.com\/|x\.com\/|twitter\.com\/)/i.test(
    trimmed,
  );
}

function buildOpenableLink(value: string) {
  const trimmed = trimTrailingPunctuation(value.trim());

  if (isEmail(trimmed)) return `mailto:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const params = useLocalSearchParams();
  const profileId = String(params.id || "");
  const moderationUserId =
    typeof params.userId === "string"
      ? params.userId
      : String(params.userId || "");
  const isModerationMode = params.mode === "moderation";
  const targetUserId = isModerationMode ? moderationUserId : profileId;

  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  // Удаление подтверждается вторым нажатием: всплывающие окна с «Да/Нет»
  // в браузере не работают, а случайное касание стирает человека.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevokeQual, setConfirmRevokeQual] = useState(false);
  const [restoring, setRestoring] = useState(false);
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
            .from("users")
            .select(
              `
              *,
              invited_by:invited_by_user_id (
                id,
                first_name,
                last_name,
                email
              )
            `,
            )
            .eq("id", targetUserId)
            .single(),
          getMyProfile(),
        ]);

        if (profileResult.error) throw new Error(profileResult.error.message);

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

      const [profileResult, myProfile, relation, favoriteStatus] =
        await Promise.all([
          supabase
            .from("users")
            .select(
              `
            *,
            invited_by:invited_by_user_id (
              id,
              first_name,
              last_name,
              email
            )
          `,
            )
            .eq("id", targetUserId)
            .single(),
          getMyProfile(),
          hasMutualBlock(targetUserId),
          isFavoriteInDb(targetUserId).catch(() => false),
        ]);

      if (profileResult.error) throw new Error(profileResult.error.message);

      setUser(profileResult.data);
      setMe(myProfile);
      setBlockState(relation);
      setIsFavorite(!!favoriteStatus);
    } catch (e) {
      console.log("Ошибка загрузки профиля:", e);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId, isModerationMode]),
  );

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerState}>
        <StatusBar style="dark" />

        <Text style={styles.stateTitle}>Участник не найден</Text>

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backLinkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  const age = getAgeFromBirthDate(user.birth_date || "");

  const isAdmin = me?.role === "owner" || me?.role === "moderator";
  const isOwner = me?.role === "owner";
  const isOwnProfile = me?.id === user.id;
  const isDeletedProfile = !!user.is_deleted;
  const isBlockedProfile = !!user.is_blocked;

  const invitedByName = user.invited_by
    ? `${user.invited_by.first_name || ""} ${user.invited_by.last_name || ""}`.trim()
    : "";

  const restrictedByTargetUser = blockState.userBlockedMe;
  const iBlockedThisUser = blockState.iBlockedUser;

  // Если участник заблокировал модератора, тот теряет полномочия по
  // отношению к нему: скрытые контакты не видны, переписка закрыта.
  // Исключение — основатель: он видит всё всегда.
  const canBypassBlock = isOwner || isModerationMode;

  // Скрытый телефон: модератору виден, только пока его не заблокировали
  const canSeeHiddenFields =
    isModerationMode || isOwner || (isAdmin && !restrictedByTargetUser);

  // Основателю доступно всё: он видит скрытые контакты и может писать
  // даже тому, кто его заблокировал.
  const canWriteToUser =
    !isOwnProfile &&
    !isModerationMode &&
    (isOwner || (!iBlockedThisUser && !restrictedByTargetUser));

  const showDirectContact = canWriteToUser;

  const showPhone = isModerationMode
    ? !!user.phone
    : (user.phone_visible || canSeeHiddenFields) &&
      (!restrictedByTargetUser || canBypassBlock);

  const showTelegram = isModerationMode
    ? !!user.telegram
    : !!user.telegram && (!restrictedByTargetUser || canBypassBlock);

  const showEmail = isModerationMode
    ? !!user.email
    : !!user.email && (!restrictedByTargetUser || canBypassBlock);

  const showAdditional = isModerationMode
    ? !!user.extra_info
    : !!user.extra_info && (!restrictedByTargetUser || canBypassBlock);

  const handleCopyText = async (label: string, value?: string | null) => {
    const text = value?.trim();

    if (!text) {
      Alert.alert("Нечего копировать");
      return;
    }

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Скопировано", `${label} скопировано`);
    } catch {
      Alert.alert("Ошибка", "Не удалось скопировать текст");
    }
  };

  const handleAssignModerator = async () => {
    try {
      await assignModerator(user.id);
      setShowMenu(false);
      await loadProfile();
      Alert.alert("Готово", "Участник назначен модератором.");
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка назначения модератора",
      );
    }
  };

  const handleRemoveModerator = async () => {
    try {
      await removeModerator(user.id);
      setShowMenu(false);
      await loadProfile();
      Alert.alert("Готово", "Модератор снят.");
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка снятия модератора",
      );
    }
  };

  // Квалификация (Веха 57): подтвердить / снять — модераторам, только в
  // чувствительных категориях Стены. Снятие — вторым нажатием.
  // (Состояние confirmRevokeQual объявлено выше, рядом с остальными хуками.)
  const handleToggleQualification = async () => {
    try {
      if (user.qualification_confirmed_at) {
        if (!confirmRevokeQual) {
          setConfirmRevokeQual(true);
          return;
        }
        await revokeQualification(user.id);
      } else {
        await confirmQualification(user.id);
      }
      setConfirmRevokeQual(false);
      setShowMenu(false);
      await loadProfile();
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка подтверждения квалификации",
      );
    }
  };

  const handleBlockUserAdmin = async () => {
    try {
      await blockUser(user.id);
      setShowMenu(false);
      Alert.alert("Готово", "Участник заблокирован.");
      router.back();
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка блокировки",
      );
    }
  };

  const handleUnblockUserAdmin = async () => {
    try {
      await unblockUser(user.id);
      setShowMenu(false);
      await loadProfile();
      Alert.alert("Готово", "Блокировка снята.");
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка снятия блокировки",
      );
    }
  };

  // Восстановление удалённого профиля — только основатель.
  const handleRestoreUser = async () => {
    if (restoring) return;

    try {
      setRestoring(true);
      await restoreUser(user.id);
      await loadProfile();
      Alert.alert("Готово", "Профиль восстановлен.");
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка восстановления профиля",
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    try {
      await softDeleteUser(user.id);
      setConfirmDelete(false);
      setShowMenu(false);
      Alert.alert("Готово", "Профиль помечен как удалённый.");
      router.back();
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка удаления профиля",
      );
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
        Alert.alert("Готово", "Участник снова доступен для общения.");
      } else {
        await blockUserForMe(user.id);
        setBlockState({
          iBlockedUser: true,
          userBlockedMe: blockState.userBlockedMe,
          isAnyBlocked: true,
        });
        setShowMenu(false);
        Alert.alert(
          "Участник заблокирован",
          "Теперь он не сможет вам писать и не увидит ваши контакты.",
        );
      }
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка блокировки",
      );
    }
  };

  const handleReport = () => {
    setShowMenu(false);
    router.push({
      pathname: "/report-user",
      params: { userId: user.id, userName: fullName },
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
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Ошибка изменения избранного",
      );
    }
  };

  const handleTelegramOpen = async () => {
    if (!user?.telegram) return;

    const username = String(user.telegram).replace("@", "");
    const appUrl = `tg://resolve?domain=${username}`;

    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : `https://t.me/${username}`);
  };

  const handleOpenEmail = async () => {
    if (!user?.email) return;

    try {
      const emailUrl = `mailto:${user.email}`;
      const canOpen = await Linking.canOpenURL(emailUrl);

      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert("Ошибка", "Не удалось открыть почту");
      }
    } catch {
      Alert.alert("Ошибка", "Не удалось открыть почту");
    }
  };

  const handleOpenDetectedLink = async (rawValue: string) => {
    try {
      const url = buildOpenableLink(rawValue);
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Ошибка", "Не удалось открыть ссылку");
      }
    } catch {
      Alert.alert("Ошибка", "Не удалось открыть ссылку");
    }
  };

  const renderTextWithLinks = (text?: string | null) => {
    if (!text) return <Text style={styles.infoText}>—</Text>;

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
    if (isOwnProfile || isModerationMode) return null;

    // У удалённого профиля действия не нужны: в меню остаётся только
    // справка (дата регистрации и кто пригласил), и видят её модераторы.
    if (isDeletedProfile) {
      if (!isAdmin) return null;

      return (
        <View style={styles.menuWrap}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#4E7364" />
          </TouchableOpacity>

          {showMenu && (
            <View style={styles.menuDropdown}>
              <View style={styles.menuInfoBlock}>
                <Text style={styles.menuInfoLabel}>ДАТА РЕГИСТРАЦИИ</Text>
                <Text style={styles.menuInfoText}>
                  {formatCreatedAt(user.created_at)}
                </Text>
              </View>

              <View style={styles.menuInfoBlock}>
                <Text style={styles.menuInfoLabel}>ПРИГЛАСИЛ</Text>
                <Text style={styles.menuInfoText}>
                  {invitedByName || user.invited_by?.email || "Не указано"}
                </Text>
              </View>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={styles.menuWrap}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowMenu((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#4E7364" />
        </TouchableOpacity>

        {showMenu && (
          <View style={styles.menuDropdown}>
            {isAdmin && (
              <>
                <View style={styles.menuInfoBlock}>
                  <Text style={styles.menuInfoLabel}>ДАТА РЕГИСТРАЦИИ</Text>
                  <Text style={styles.menuInfoText}>
                    {formatCreatedAt(user.created_at)}
                  </Text>
                </View>

                <View style={styles.menuInfoBlock}>
                  <Text style={styles.menuInfoLabel}>ПРИГЛАСИЛ</Text>
                  <Text style={styles.menuInfoText}>
                    {invitedByName || user.invited_by?.email || "Не указано"}
                  </Text>
                </View>

                <View style={styles.menuDivider} />
              </>
            )}

            {isOwner && user.role !== "moderator" && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleAssignModerator}
              >
                <Text style={styles.menuItemText}>Назначить модератором</Text>
              </TouchableOpacity>
            )}

            {isOwner && user.role === "moderator" && (
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
                  {confirmDelete
                    ? "Нажмите ещё раз, чтобы удалить"
                    : "Удалить профиль"}
                </Text>

                {confirmDelete && (
                  <Text style={styles.menuItemHint}>
                    Человек исчезнет из сообщества. Отменить нельзя.
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {isAdmin &&
              !!user.category &&
              SENSITIVE_CATEGORIES.includes(user.category) && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleToggleQualification}
                >
                  <Text
                    style={[
                      styles.menuItemText,
                      confirmRevokeQual && styles.dangerText,
                    ]}
                  >
                    {user.qualification_confirmed_at
                      ? confirmRevokeQual
                        ? "Точно снять? Нажмите ещё раз"
                        : "Снять подтверждение квалификации"
                      : "Подтвердить квалификацию"}
                  </Text>
                  <Text style={styles.menuItemHint}>
                    {user.qualification_confirmed_at
                      ? `Подтверждена · ${user.category}. Снятие закроет скрытые материалы Стены.`
                      : `${user.category}: откроет скрытые материалы и обсуждения Стены помощи.`}
                  </Text>
                </TouchableOpacity>
              )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={
                  isBlockedProfile
                    ? handleUnblockUserAdmin
                    : handleBlockUserAdmin
                }
              >
                <Text
                  style={[
                    styles.menuItemText,
                    !isBlockedProfile && styles.dangerText,
                  ]}
                >
                  {isBlockedProfile
                    ? "Снять блокировку участника"
                    : "Заблокировать участника"}
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
                    {iBlockedThisUser ? "Снять блокировку" : "Заблокировать"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderActions = () => {
    // Удалённый профиль: писать и добавлять в избранное нельзя.
    // Основатель видит кнопку восстановления, остальные — ничего.
    if (isDeletedProfile && !isOwnProfile) {
      if (!isOwner) return null;

      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.actionFlex,
              styles.primaryShadow,
              restoring && styles.disabled,
            ]}
            activeOpacity={0.85}
            disabled={restoring}
            onPress={handleRestoreUser}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {restoring ? "Восстановление..." : "Восстановить"}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      );
    }

    if (isModerationMode) {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionFlex}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/moderation-edit-profile",
                params: { userId: user.id },
              })
            }
          >
            <Glass
              radius={18}
              tintColor="rgba(255,255,255,0.95)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>Редактировать</Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionFlex}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Glass
              radius={18}
              tintColor="rgba(255,255,255,0.95)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>В модерацию</Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      );
    }

    if (isOwnProfile) {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionFlex}
            activeOpacity={0.85}
            onPress={() => router.push("/invites" as any)}
          >
            <Glass
              radius={18}
              tintColor="rgba(255,255,255,0.95)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>Инвайты</Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionFlex}
            activeOpacity={0.85}
            onPress={() => router.push("/edit-profile" as any)}
          >
            <Glass
              radius={18}
              tintColor="rgba(255,255,255,0.95)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>Редактировать</Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.actionFlex,
            styles.primaryShadow,
            !showDirectContact && styles.disabled,
          ]}
          activeOpacity={0.85}
          disabled={!showDirectContact}
          onPress={() =>
            router.push({
              pathname: "/chat",
              params: { name: fullName, userId: user.id },
            })
          }
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>Написать</Text>
            </View>
          </Glass>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleToggleFavorite}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFavorite ? "bookmark" : "bookmark-outline"}
            size={19}
            color="#69B78D"
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 10 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.backLinkText}>← Назад</Text>
            </TouchableOpacity>

            {renderMenu()}
          </View>

          {showMenu && (
            <TouchableOpacity
              style={styles.menuOverlay}
              activeOpacity={1}
              onPress={() => {
                setShowMenu(false);
                setConfirmDelete(false);
              }}
            />
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setAvatarModalVisible(true)}
            style={styles.avatarWrap}
          >
            <Image
              source={
                user.avatar_path
                  ? { uri: user.avatar_path }
                  : require("../assets/default-avatar.png")
              }
              style={styles.avatar}
            />
          </TouchableOpacity>

          <Text style={styles.name} numberOfLines={2}>
            {fullName || "Без имени"}
          </Text>

          <Text style={styles.subInfo}>
            {[user.category, firstCity(user.city)].filter(Boolean).join(", ") ||
              "—"}
          </Text>

          {!!age && <Text style={styles.age}>{age} лет</Text>}

          {isModerationMode && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>РЕЖИМ МОДЕРАЦИИ</Text>
            </View>
          )}

          {isDeletedProfile && (
            <View style={styles.deletedBadge}>
              <Text style={styles.deletedBadgeText}>АККАУНТ УДАЛЁН</Text>
            </View>
          )}

          {isAdmin && isBlockedProfile && !isDeletedProfile && (
            <View style={styles.deletedBadge}>
              <Text style={styles.deletedBadgeText}>ЗАБЛОКИРОВАН</Text>
            </View>
          )}

          {iBlockedThisUser && !isOwnProfile && !isModerationMode && (
            <View style={styles.blockLine}>
              <Text style={styles.blockLineText}>Участник заблокирован</Text>
            </View>
          )}

          <Tekmet style={styles.tekmet} />

          {renderActions()}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleCopyText("Профессия", user.profession)}
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>ПРОФЕССИЯ</Text>
            <Text style={styles.infoText}>{user.profession || "—"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.95}
            onLongPress={() => handleCopyText("Описание", user.bio)}
            delayLongPress={300}
            style={styles.quoteBlock}
          >
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.quoteText}>{user.bio || "—"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() =>
              handleCopyText(
                "Локация",
                formatLocations(user.country, user.city),
              )
            }
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>ЛОКАЦИЯ</Text>
            <Text style={styles.infoText}>
              {formatLocations(user.country, user.city) || "—"}
            </Text>
          </TouchableOpacity>

          {showEmail && (
            <TouchableOpacity
              style={styles.infoBlock}
              onPress={handleOpenEmail}
              onLongPress={() => handleCopyText("Почта", user.email)}
              delayLongPress={300}
              activeOpacity={0.9}
            >
              <Text style={styles.infoTitle}>ПОЧТА</Text>
              <Text style={styles.linkText}>{user.email}</Text>
            </TouchableOpacity>
          )}

          {showPhone && (
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => handleCopyText("Телефон", user.phone)}
              delayLongPress={300}
              style={styles.infoBlock}
            >
              <Text style={styles.infoTitle}>ТЕЛЕФОН</Text>
              <Text style={styles.infoText}>{user.phone || "—"}</Text>
            </TouchableOpacity>
          )}

          {showTelegram && (
            <TouchableOpacity
              style={styles.infoBlock}
              onPress={handleTelegramOpen}
              onLongPress={() => handleCopyText("Telegram", user.telegram)}
              delayLongPress={300}
              activeOpacity={0.9}
            >
              <Text style={styles.infoTitle}>TELEGRAM</Text>
              <Text style={styles.linkText}>{user.telegram}</Text>
            </TouchableOpacity>
          )}

          {showAdditional && (
            <TouchableOpacity
              style={styles.infoBlock}
              onLongPress={() =>
                handleCopyText("Дополнительно", user.extra_info)
              }
              delayLongPress={300}
              activeOpacity={1}
            >
              <Text style={styles.infoTitle}>ДОПОЛНИТЕЛЬНО</Text>
              {renderTextWithLinks(user.extra_info)}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAvatarModalVisible(false)}
          />

          <Image
            source={
              user.avatar_path
                ? { uri: user.avatar_path }
                : require("../assets/default-avatar.png")
            }
            style={styles.modalAvatar}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  centerState: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  stateTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 26,
    color: "#3F6B5B",
    marginBottom: 14,
    textAlign: "center",
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    zIndex: 20,
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },

  menuWrap: {
    position: "relative",
  },

  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },

  menuDropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    minWidth: 236,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingVertical: 6,
    zIndex: 30,
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  menuInfoBlock: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  menuInfoLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.3,
    color: "#719686",
    marginBottom: 3,
  },

  menuInfoText: {
    fontSize: 14,
    color: "#2F4A3C",
  },

  menuDivider: {
    height: 0.75,
    backgroundColor: "rgba(93,140,120,0.18)",
    marginVertical: 6,
  },

  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  menuItemHint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: "#8FA79A",
  },

  menuItemText: {
    fontSize: 14.5,
    color: "#2F4A3C",
  },

  dangerText: {
    color: "#C05B4D",
  },

  avatarWrap: {
    alignSelf: "center",
    marginTop: 4,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
  },

  name: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 21,
    color: "#3F6B5B",
    textAlign: "center",
    marginTop: 10,
  },

  subInfo: {
    fontSize: 14,
    color: "#7E988B",
    marginTop: 4,
    textAlign: "center",
  },

  age: {
    fontSize: 13,
    color: "#69B78D",
    marginTop: 4,
    fontWeight: "600",
    textAlign: "center",
  },

  modeBadge: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(105,183,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,183,141,0.55)",
  },

  modeBadgeText: {
    color: "#3F6B5B",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
  },

  deletedBadge: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(192,91,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(192,91,77,0.45)",
  },

  deletedBadgeText: {
    color: "#C05B4D",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
  },

  blockLine: {
    alignSelf: "center",
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(192,91,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(192,91,77,0.45)",
  },

  blockLineText: {
    color: "#C05B4D",
    fontSize: 12.5,
    fontWeight: "600",
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 18,
    marginBottom: 18,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },

  actionFlex: {
    flex: 1,
  },

  primaryShadow: {
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "600",
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 14.5,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.55,
  },

  bookmarkButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  infoBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 10,
  },

  infoTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginBottom: 8,
    color: "#719686",
  },

  infoText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  linkText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#3F6B5B",
    textDecorationLine: "underline",
  },

  quoteBlock: {
    backgroundColor: "rgba(105,183,141,0.08)",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(105,183,141,0.35)",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 18,
    marginBottom: 10,
  },

  quoteMark: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 40,
    lineHeight: 46,
    color: "#9FC5AF",
  },

  quoteText: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: "#3F6B5B",
    marginTop: -8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(31,58,47,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalAvatar: {
    width: "100%",
    height: "70%",
    borderRadius: 20,
  },
});
