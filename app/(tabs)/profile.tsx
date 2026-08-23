import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, Tekmet } from "../../components/mingi";
import { formatHandle, formatPhone } from "../../services/contactsService";
import { SENSITIVE_CATEGORIES } from "../../services/helpService";
import {
  getModerationTaskCount,
  sendAppealMessage,
} from "../../services/moderationService";
import { DbUserProfile, getMyProfile } from "../../services/profileService";
import { signOutUser } from "../../services/sessionService";
import { getAgeFromBirthDate } from "../../store/user";

import { t, tCategory, useLanguage } from "../../services/i18nService";
type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
};

function SectionRow({ icon, label, badge, onPress, last, danger }: RowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.row, last && styles.rowLast]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? "#C05B4D" : "#69B78D"}
        style={styles.rowIcon}
      />

      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
        {label}
      </Text>

      {!!badge && badge > 0 && (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={18} color="#A8BDB1" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const lang = useLanguage(); // перерисовка при смене языка

  const copyLabel = (key: string) => {
    const s = t(key);
    return s.charAt(0) + s.slice(1).toLowerCase();
  };
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Отступ под чёлку/статус-бар: шапка у самого верха (образец Вехи 32).
  // Хук обязан стоять ДО ранних выходов — иначе падение.
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Запрос подтверждения квалификации (Веха 57) — обращение к
  // администрации с готовым текстом, без ухода с экрана.
  const [qualRequesting, setQualRequesting] = useState(false);
  const [qualRequestSent, setQualRequestSent] = useState(false);
  const [qualError, setQualError] = useState("");

  const handleRequestQualification = async () => {
    if (!user?.id || qualRequesting || qualRequestSent) return;
    setQualRequesting(true);
    setQualError("");
    try {
      await sendAppealMessage(
        user.id,
        `Прошу подтвердить мою квалификацию в категории «${user.category}» ` +
          `(профессия: ${user.profession || "—"}) для доступа к скрытым ` +
          `материалам Стены помощи. Готов(а) предоставить подтверждающие документы.`,
      );
      setQualRequestSent(true);
    } catch (e: any) {
      console.log("Запрос квалификации не ушёл:", e);
      setQualError(t("qual.error"));
    } finally {
      setQualRequesting(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        try {
          setLoading(true);
          setConfirmLogout(false);
          const profile = await getMyProfile();
          setUser(profile);

          const isAdmin =
            profile?.role === "owner" || profile?.role === "moderator";

          if (isAdmin) {
            try {
              // Свободные заявки из «Нового» + мои в работе и на доработке
              setModerationCount(await getModerationTaskCount());
            } catch (e) {
              setModerationCount(0);
            }
          } else {
            setModerationCount(0);
          }
        } catch (e) {
          console.log("Ошибка загрузки профиля:", e);
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      refresh();
    }, []),
  );

  // Выход из аккаунта — вторым нажатием, чтобы не выйти случайно
  // (модальные подтверждения в вебе работают плохо).
  const handleLogout = async () => {
    if (loggingOut) return;

    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }

    try {
      setLoggingOut(true);
      await signOutUser();
    } catch (e) {
      console.log("Не удалось выйти:", e);
    }

    router.replace("/welcome");
  };

  const handleCopyText = async (label: string, value?: string | null) => {
    const text = value?.trim();
    if (!text) return;

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert(t("profile.copy.done"), t("cab.copy.done", { label }));
    } catch (e) {
      Alert.alert(t("common.error"), t("cab.copy.fail"));
    }
  };

  const handleOpenEmail = async () => {
    if (!user?.email) return;

    const url = `mailto:${user.email}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t("common.error"), t("profile.open.mail"));
    }
  };

  const handleTelegramOpen = async () => {
    if (!user?.telegram) return;

    const raw = user.telegram.trim().replace(/^@/, "");

    try {
      // В браузере схема tg:// молчит без Telegram Desktop — сразу сайт.
      if (Platform.OS === "web") {
        await Linking.openURL(`https://t.me/${raw}`);
        return;
      }

      const appUrl = `tg://resolve?domain=${raw}`;
      const canOpenApp = await Linking.canOpenURL(appUrl);

      await Linking.openURL(canOpenApp ? appUrl : `https://t.me/${raw}`);
    } catch (e) {
      Alert.alert(t("common.error"), "Не удалось открыть Telegram");
    }
  };

  const handleInstagramOpen = async () => {
    if (!user?.instagram) return;

    // Принимаем и «@имя», и полную ссылку — приводим к чистому имени
    const username = user.instagram
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/[/?].*$/, "");

    if (!username) return;

    try {
      // В браузере схема instagram:// молчит — на вебе сразу сайт.
      if (Platform.OS === "web") {
        await Linking.openURL(`https://instagram.com/${username}`);
        return;
      }

      const appUrl = `instagram://user?username=${username}`;
      const canOpenApp = await Linking.canOpenURL(appUrl);

      await Linking.openURL(
        canOpenApp ? appUrl : `https://instagram.com/${username}`,
      );
    } catch (e) {
      Alert.alert(t("common.error"), t("profile.open.instagram"));
    }
  };

  const renderTextWithLinks = (text?: string | null) => {
    if (!text) return <Text style={styles.infoText}>—</Text>;

    const parts = text.split(
      /(\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+|(?:^|\s)@[\w.]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b)/g,
    );

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
            const username = trimmed.replace(/^@/, "");
            return (
              <Text
                key={index}
                style={styles.linkText}
                onPress={async () => {
                  const appUrl = `tg://resolve?domain=${username}`;
                  const canOpenApp = await Linking.canOpenURL(appUrl);
                  await Linking.openURL(
                    canOpenApp ? appUrl : `https://t.me/${username}`,
                  );
                }}
              >
                {part}
              </Text>
            );
          }

          if (isUrl) {
            const url = trimmed.startsWith("http")
              ? trimmed
              : `https://${trimmed}`;
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

        <Text style={styles.stateTitle}>{t("common.notFound.member")}</Text>
        <Text style={styles.stateText}>{t("cab.notFoundHint")}</Text>

        <TouchableOpacity
          style={styles.primaryShadow}
          onPress={() => router.replace("/welcome")}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>{t("cab.toHome")}</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
    );
  }

  const fullName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() || t("profile.noName");
  const age = getAgeFromBirthDate(user.birth_date || "");
  const isAdmin = user.role === "owner" || user.role === "moderator";

  const roleBadgeText =
    user.role === "owner"
      ? t("cab.badge.founder")
      : user.role === "moderator"
        ? t("cab.badge.moderator")
        : null;

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
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{t("common.backArrow")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setAvatarModalVisible(true)}
            style={styles.avatarWrap}
          >
            <Image
              source={
                user.avatar_path
                  ? { uri: user.avatar_path }
                  : require("../../assets/default-avatar.png")
              }
              style={styles.avatar}
            />
          </TouchableOpacity>

          <Text style={styles.name}>{fullName}</Text>

          <Text style={styles.subInfo}>
            {[user.category, user.city].filter(Boolean).join(", ") ||
              t("profile.notSpecified")}
          </Text>

          {!!age && <Text style={styles.age}>{t("common.ageSuffix", { возраст: age })}</Text>}

          {!!roleBadgeText && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => router.push("/edit-profile")}
            activeOpacity={0.85}
            style={styles.editButton}
          >
            <Glass
              radius={18}
              tintColor="rgba(255,255,255,0.95)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.buttonInner}>
                <Text style={styles.secondaryButtonText}>{t("cab.editProfile")}</Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <Tekmet style={styles.tekmet} />

          <View style={styles.sectionCard}>
            {/* Красным с сердечком — по решению владельца (Веха 60) */}
            <SectionRow
              icon="heart"
              label={t("cab.menu.about")}
              danger
              onPress={() => router.push("/about-project" as any)}
            />

            <SectionRow
              icon="reader-outline"
              label={t("cab.menu.myPosts")}
              onPress={() => router.push("/my-help-posts" as any)}
            />

            <SectionRow
              icon="mail-open-outline"
              label={t("cab.menu.myInvites")}
              onPress={() => router.push("/invites" as any)}
            />

            {isAdmin && (
              <SectionRow
                icon="shield-checkmark-outline"
                label="Модерация"
                badge={moderationCount}
                onPress={() => router.push("/moderation")}
              />
            )}

            <SectionRow
              icon="settings-outline"
              label={t("cab.menu.settings")}
              onPress={() => router.push("/settings" as any)}
            />

            <SectionRow
              icon="document-text-outline"
              label={t("cab.menu.terms")}
              onPress={() => router.push("/terms")}
            />

            <SectionRow
              icon="lock-closed-outline"
              label={t("cab.menu.privacy")}
              onPress={() => router.push("/privacy")}
            />

            <SectionRow
              icon="log-out-outline"
              label={
                loggingOut
                  ? t("cab.logout.doing")
                  : confirmLogout
                    ? t("cab.logout.confirm")
                    : t("restricted.logoutFull")
              }
              danger
              onPress={handleLogout}
              last
            />
          </View>

          <Text style={styles.blockLabel}>{t("cab.myData")}</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() =>
              handleCopyText(t("cab.copy.category"), user.category)
            }
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>{t("cab.h.category")}</Text>
            <Text style={styles.infoText}>{user.category ? tCategory(user.category) : "—"}</Text>

            {/* Квалификация (Веха 57): только в чувствительных категориях
                Стены. Подтверждена — строка; нет — кнопка «Запросить»
                создаёт обращение к администрации прямо отсюда. */}
            {!!user.category &&
              SENSITIVE_CATEGORIES.includes(user.category) &&
              ((user as any).qualification_confirmed_at ? (
                <View style={styles.qualRow}>
                  <Ionicons name="shield-checkmark" size={15} color="#69B78D" />
                  <Text style={styles.qualOkText}>{t("qual.confirmed")}</Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.qualHintText}>
                    {t("qual.hint", { категория: tCategory(user.category) })}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.qualButton,
                      (qualRequestSent || qualRequesting) &&
                        styles.qualButtonDone,
                    ]}
                    activeOpacity={0.8}
                    disabled={qualRequestSent || qualRequesting}
                    onPress={handleRequestQualification}
                  >
                    <Text
                      style={[
                        styles.qualButtonText,
                        qualRequestSent && styles.qualButtonTextDone,
                      ]}
                    >
                      {qualRequesting
                        ? t("qual.sending")
                        : qualRequestSent
                          ? t("qual.sent")
                          : t("qual.request")}
                    </Text>
                  </TouchableOpacity>
                  {!!qualError && (
                    <Text style={styles.qualErrorText}>{qualError}</Text>
                  )}
                </View>
              ))}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleCopyText(copyLabel("profile.h.profession"), user.profession)}
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>{t("profile.h.profession")}</Text>
            <Text style={styles.infoText}>{user.profession || "—"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() =>
              handleCopyText(
                copyLabel("profile.h.location"),
                [user.city, user.country].filter(Boolean).join(", "),
              )
            }
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>{t("profile.h.location")}</Text>
            <Text style={styles.infoText}>
              {[user.city, user.country].filter(Boolean).join(", ") || "—"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleCopyText(t("profile.h.copyBio"), user.bio)}
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>{t("cab.h.bio")}</Text>
            {renderTextWithLinks(user.bio)}
          </TouchableOpacity>

          {!!user.email && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleOpenEmail}
              onLongPress={() => handleCopyText(copyLabel("profile.h.email"), user.email)}
              delayLongPress={300}
              style={styles.infoBlock}
            >
              <Text style={styles.infoTitle}>{t("profile.h.email")}</Text>
              <Text style={styles.linkText}>{user.email}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleCopyText(copyLabel("profile.h.phone"), user.phone)}
            delayLongPress={300}
            style={styles.infoBlock}
          >
            <Text style={styles.infoTitle}>{t("profile.h.phone")}</Text>
            <Text style={styles.infoText}>
              {formatPhone(user.phone) || "—"}
            </Text>
            <Text style={styles.infoHint}>
              {user.phone_visible
                ? t("cab.phoneShown")
                : t("cab.phoneHidden")}
            </Text>
          </TouchableOpacity>

          {!!user.telegram && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleTelegramOpen}
              onLongPress={() => handleCopyText("Telegram", user.telegram)}
              delayLongPress={300}
              style={styles.infoBlock}
            >
              <Text style={styles.infoTitle}>TELEGRAM</Text>
              <Text style={styles.linkText}>{formatHandle(user.telegram)}</Text>
            </TouchableOpacity>
          )}

          {!!user.instagram && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleInstagramOpen}
              onLongPress={() => handleCopyText("Instagram", user.instagram)}
              delayLongPress={300}
              style={styles.infoBlock}
            >
              <Text style={styles.infoTitle}>INSTAGRAM</Text>
              <Text style={styles.linkText}>
                {formatHandle(user.instagram)}
              </Text>
            </TouchableOpacity>
          )}

          {!!user.extra_info && (
            <TouchableOpacity
              activeOpacity={1}
              onLongPress={() =>
                handleCopyText(copyLabel("profile.h.extra"), user.extra_info)
              }
              delayLongPress={300}
              style={styles.infoBlock}
            >
              <Text style={styles.infoTitle}>{t("profile.h.extra")}</Text>
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
        <TouchableWithoutFeedback onPress={() => setAvatarModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Image
                source={
                  user.avatar_path
                    ? { uri: user.avatar_path }
                    : require("../../assets/default-avatar.png")
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
    marginBottom: 10,
    textAlign: "center",
  },

  stateText: {
    fontSize: 14.5,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 4,
  },

  container: {
    paddingHorizontal: 20,
    // Запас снизу под парящую панель вкладок (важно: последняя строка
    // меню — «Выйти из аккаунта», её нужно докручивать выше капсулы).
    paddingBottom: 120,
    flexGrow: 1,
  },

  backLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },

  avatarWrap: {
    alignSelf: "center",
  },

  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
  },

  name: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 26,
    color: "#3F6B5B",
    textAlign: "center",
    marginTop: 14,
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

  roleBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(105,183,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,183,141,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 10,
  },

  roleBadgeText: {
    color: "#3F6B5B",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
  },

  editButton: {
    marginTop: 16,
  },

  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 15.5,
    fontWeight: "600",
  },

  primaryShadow: {
    marginTop: 20,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 18,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    overflow: "hidden",
    marginBottom: 26,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.18)",
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowIcon: {
    marginRight: 12,
  },

  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: "#2F4A3C",
  },

  rowLabelDanger: {
    color: "#C05B4D",
  },

  rowBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    marginRight: 8,
    backgroundColor: "#C05B4D",
    alignItems: "center",
    justifyContent: "center",
  },

  rowBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },

  blockLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#719686",
    marginBottom: 12,
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

  // Квалификация (Веха 57)
  qualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  qualOkText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: "#3F6B5B",
  },

  qualHintText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#7E988B",
    marginTop: 8,
  },

  qualButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(105,183,141,0.92)",
  },

  qualButtonDone: {
    backgroundColor: "rgba(105,183,141,0.14)",
  },

  qualButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  qualButtonTextDone: {
    color: "#3F6B5B",
  },

  qualErrorText: {
    fontSize: 12,
    color: "#C05B4D",
    marginTop: 6,
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

  infoHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#8FA79A",
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
