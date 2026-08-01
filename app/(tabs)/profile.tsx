import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather } from "@expo/vector-icons";
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
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { Glass, Tekmet } from "../../components/mingi";
import { createInvite, markInviteAsSent } from "../../services/inviteService";
import { DbUserProfile, getMyProfile } from "../../services/profileService";
import { signOutUser } from "../../services/sessionService";
import { getAgeFromBirthDate } from "../../store/user";

const glassCardProps = {
  radius: 18,
  tintColor: "rgba(255,255,255,0.92)",
  borderColor: "rgba(93,140,120,0.28)",
  borderWidth: 0.75,
} as const;

export default function ProfileScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const refresh = async () => {
        try {
          setLoading(true);
          const profile = await getMyProfile();
          setUser(profile);
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

  const handleCopyText = async (label: string, value?: string | null) => {
    const text = value?.trim();

    if (!text) return;

    try {
      await Clipboard.setStringAsync(text);
      Alert.alert("Скопировано", `${label} скопирован(о)`);
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось скопировать");
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
      Alert.alert("Ошибка", "Не удалось открыть почту");
    }
  };

  const handleTelegramOpen = async () => {
    if (!user?.telegram) return;

    const raw = user.telegram.trim().replace(/^@/, "");
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
      Alert.alert("Ошибка", "Не удалось открыть Telegram");
    }
  };

  const handleCreateInvite = async () => {
    try {
      setCreatingInvite(true);

      const invite = await createInvite();

      const result = await Share.share({
        message: `Мой инвайт-код для «Минги-Тау»: ${invite.code}`,
      });

      if (result.action === Share.sharedAction) {
        await markInviteAsSent(invite.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка создания инвайта";
      Alert.alert("Ошибка", message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      router.replace("/welcome");
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось выйти");
    }
  };

  const renderTextWithLinks = (text?: string | null) => {
    if (!text) {
      return <Text style={styles.infoText}>—</Text>;
    }

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
    return <View style={styles.emptyBg} />;
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

        <Text style={styles.stateTitle}>Профиль не найден</Text>
        <Text style={styles.stateText}>
          Войдите в аккаунт или зарегистрируйтесь заново.
        </Text>

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
              <Text style={styles.primaryButtonText}>На главный экран</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
    );
  }

  const fullName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Без имени";
  const age = getAgeFromBirthDate(user.birth_date || "");
  const isAdmin = user.role === "owner" || user.role === "moderator";

  const roleBadgeText =
    user.role === "owner"
      ? "ОСНОВАТЕЛЬ"
      : user.role === "moderator"
        ? "МОДЕРАТОР"
        : null;

  return (
    <>
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Назад</Text>
          </TouchableOpacity>

          {!!roleBadgeText && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleBadgeText}</Text>
            </View>
          )}

          <View style={styles.avatarRow}>
            <TouchableOpacity
              style={[
                styles.circleButton,
                styles.inviteCircleButton,
                creatingInvite && styles.disabled,
              ]}
              onPress={handleCreateInvite}
              activeOpacity={0.8}
              disabled={creatingInvite}
            >
              <Feather name="user-plus" size={22} color="#3F6B5B" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setAvatarModalVisible(true)}
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

            <TouchableOpacity
              style={[styles.circleButton, styles.logoutCircleButton]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Feather name="log-out" size={22} color="#C05B4D" />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{fullName}</Text>

          <Text style={styles.subInfo}>
            {[user.category, user.city].filter(Boolean).join(", ") ||
              "Не указано"}
          </Text>

          {!!age && <Text style={styles.age}>{age} лет</Text>}

          <Tekmet style={styles.tekmet} />

          <View style={styles.topButtonsRow}>
            <TouchableOpacity
              style={[styles.primaryShadow, styles.rowButton]}
              onPress={() => router.push("/invites" as any)}
              activeOpacity={0.85}
            >
              <Glass
                radius={18}
                tintColor="rgba(105,183,141,0.92)"
                borderColor="rgba(255,255,255,0.85)"
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.primaryButtonText}>Инвайты</Text>
                </View>
              </Glass>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={styles.rowButton}
                onPress={() => router.push("/moderation")}
                activeOpacity={0.85}
              >
                <Glass
                  radius={18}
                  tintColor="rgba(255,255,255,0.95)"
                  borderColor="rgba(93,140,120,0.45)"
                  borderWidth={0.75}
                >
                  <View style={styles.buttonInner}>
                    <Text style={styles.secondaryButtonText}>Модерация</Text>
                  </View>
                </Glass>
              </TouchableOpacity>
            )}
          </View>

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
                <Text style={styles.secondaryButtonText}>
                  Редактировать профиль
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <Glass {...glassCardProps} style={styles.infoBlock}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() =>
                handleCopyText("Сфера деятельности", user.category)
              }
              delayLongPress={300}
              style={styles.infoInner}
            >
              <Text style={styles.infoTitle}>СФЕРА ДЕЯТЕЛЬНОСТИ</Text>
              <Text style={styles.infoText}>{user.category || "—"}</Text>
            </TouchableOpacity>
          </Glass>

          <Glass {...glassCardProps} style={styles.infoBlock}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => handleCopyText("Профессия", user.profession)}
              delayLongPress={300}
              style={styles.infoInner}
            >
              <Text style={styles.infoTitle}>ПРОФЕССИЯ</Text>
              <Text style={styles.infoText}>{user.profession || "—"}</Text>
            </TouchableOpacity>
          </Glass>

          <Glass {...glassCardProps} style={styles.infoBlock}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() =>
                handleCopyText(
                  "Локация",
                  [user.city, user.country].filter(Boolean).join(", "),
                )
              }
              delayLongPress={300}
              style={styles.infoInner}
            >
              <Text style={styles.infoTitle}>ЛОКАЦИЯ</Text>
              <Text style={styles.infoText}>
                {[user.city, user.country].filter(Boolean).join(", ") || "—"}
              </Text>
            </TouchableOpacity>
          </Glass>

          <Glass {...glassCardProps} style={styles.infoBlock}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => handleCopyText("Описание", user.bio)}
              delayLongPress={300}
              style={styles.infoInner}
            >
              <Text style={styles.infoTitle}>ЧЕМ МОГУ БЫТЬ ПОЛЕЗЕН</Text>
              {renderTextWithLinks(user.bio)}
            </TouchableOpacity>
          </Glass>

          {!!user.email && (
            <Glass {...glassCardProps} style={styles.infoBlock}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleOpenEmail}
                onLongPress={() => handleCopyText("Почта", user.email)}
                delayLongPress={300}
                style={styles.infoInner}
              >
                <Text style={styles.infoTitle}>ПОЧТА</Text>
                <Text style={styles.linkText}>{user.email}</Text>
              </TouchableOpacity>
            </Glass>
          )}

          <Glass {...glassCardProps} style={styles.infoBlock}>
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => handleCopyText("Телефон", user.phone)}
              delayLongPress={300}
              style={styles.infoInner}
            >
              <Text style={styles.infoTitle}>ТЕЛЕФОН</Text>
              <Text style={styles.infoText}>{user.phone || "—"}</Text>
              <Text style={styles.infoHint}>
                {user.phone_visible
                  ? "Номер отображается в профиле."
                  : "Номер скрыт от пользователей и доступен только администрации."}
              </Text>
            </TouchableOpacity>
          </Glass>

          {!!user.telegram && (
            <Glass {...glassCardProps} style={styles.infoBlock}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleTelegramOpen}
                onLongPress={() => handleCopyText("Telegram", user.telegram)}
                delayLongPress={300}
                style={styles.infoInner}
              >
                <Text style={styles.infoTitle}>TELEGRAM</Text>
                <Text style={styles.linkText}>{user.telegram}</Text>
              </TouchableOpacity>
            </Glass>
          )}

          {!!user.extra_info && (
            <Glass {...glassCardProps} style={styles.infoBlock}>
              <TouchableOpacity
                activeOpacity={1}
                onLongPress={() =>
                  handleCopyText("Дополнительно", user.extra_info)
                }
                delayLongPress={300}
                style={styles.infoInner}
              >
                <Text style={styles.infoTitle}>ДОПОЛНИТЕЛЬНО</Text>
                {renderTextWithLinks(user.extra_info)}
              </TouchableOpacity>
            </Glass>
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
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

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
    paddingTop: 56,
    paddingBottom: 40,
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

  roleBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(105,183,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,183,141,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 14,
  },

  roleBadgeText: {
    color: "#3F6B5B",
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
  },

  avatarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 16,
  },

  circleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  inviteCircleButton: {
    backgroundColor: "rgba(105,183,141,0.12)",
    borderColor: "rgba(105,183,141,0.55)",
  },

  logoutCircleButton: {
    backgroundColor: "rgba(192,91,77,0.08)",
    borderColor: "rgba(192,91,77,0.45)",
  },

  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
  },

  name: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 26,
    color: "#3F6B5B",
    textAlign: "center",
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

  tekmet: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 18,
  },

  topButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  rowButton: {
    flex: 1,
  },

  editButton: {
    marginBottom: 20,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 15.5,
    fontWeight: "600",
  },

  infoBlock: {
    marginBottom: 10,
  },

  infoInner: {
    padding: 16,
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

  infoHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#8FA79A",
  },

  disabled: {
    opacity: 0.7,
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
