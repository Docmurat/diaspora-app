import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, Tekmet } from "../components/mingi";
import { authorProfileParams } from "../services/helpService";
import { dateLocale, t, useLanguage } from "../services/i18nService";
import {
  createInvite,
  disableInvite,
  getMyInvitedUsers,
  getMyInvites,
  markInviteAsSent,
} from "../services/inviteService";

type TabType = "created" | "sent" | "invited";

function formatDate(dateString?: string | null) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString(dateLocale());
}

function inviteMessage(code: string) {
  return t("inv.shareText", { код: code });
}

// Прямые ссылки с готовым текстом: работают и в браузере, и на телефоне,
// в отличие от системного меню «Поделиться».
function telegramShareLink(code: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(inviteMessage(code))}`;
}

function whatsappShareLink(code: string) {
  return `https://wa.me/?text=${encodeURIComponent(inviteMessage(code))}`;
}

export default function Invites() {
  const lang = useLanguage(); // перерисовка при смене языка
  const insets = useSafeAreaInsets(); // «Назад» на одном уровне со всеми экранами
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [invites, setInvites] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("created");

  const loadData = async () => {
    try {
      setLoading(true);

      const [invitesData, invitedUsersData] = await Promise.all([
        getMyInvites(),
        getMyInvitedUsers(),
      ]);

      setInvites(invitesData || []);
      setInvitedUsers(invitedUsersData || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("inv.error.load");
      Alert.alert(t("common.error"), message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const handleCreateInvite = async () => {
    try {
      setCreating(true);

      const invite = await createInvite();
      setInvites((prev) => [invite, ...prev]);
      setActiveTab("created");

      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("inv.error.create");
      Alert.alert(t("common.error"), message);
    } finally {
      setCreating(false);
    }
  };

  // Любая передача кода наружу помечает инвайт как переданный,
  // чтобы случайно не отдать один код двум людям.
  const markAsHandedOver = async (invite: any) => {
    if (invite.sent_at) return;

    const sentAt = new Date().toISOString();

    try {
      await markInviteAsSent(invite.id);

      setInvites((prev) =>
        prev.map((item) =>
          item.id === invite.id ? { ...item, sent_at: sentAt } : item,
        ),
      );

      setActiveTab("sent");
    } catch (e) {
      console.log("Не удалось отметить инвайт переданным:", e);
    }
  };

  const handleCopyInvite = async (invite: any) => {
    try {
      await Clipboard.setStringAsync(invite.code);
      await markAsHandedOver(invite);

      Alert.alert(t("profile.copy.done"), t("inv.copied"));
    } catch {
      Alert.alert(t("common.error"), t("inv.error.copy"));
    }
  };

  const handleTelegramInvite = async (invite: any) => {
    try {
      await Linking.openURL(telegramShareLink(invite.code));
      await markAsHandedOver(invite);
    } catch {
      Alert.alert(t("common.error"), t("profile.open.telegram"));
    }
  };

  const handleWhatsappInvite = async (invite: any) => {
    try {
      await Linking.openURL(whatsappShareLink(invite.code));
      await markAsHandedOver(invite);
    } catch {
      Alert.alert(t("common.error"), t("profile.open.whatsapp"));
    }
  };

  // Удаление подтверждается вторым нажатием: всплывающие окна с «Да/Нет»
  // в браузере не работают.
  const handleDeletePress = async (invite: any) => {
    if (confirmDeleteId !== invite.id) {
      setConfirmDeleteId(invite.id);
      return;
    }

    try {
      setDeletingId(invite.id);
      await disableInvite(invite.id);
      setInvites((prev) => prev.filter((item) => item.id !== invite.id));
    } catch (e) {
      const message = e instanceof Error ? e.message : t("inv.error.delete");
      Alert.alert(t("common.error"), message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const sortedInvites = useMemo(() => {
    return [...invites]
      .filter((invite) => !invite.is_disabled)
      .sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [invites]);

  const createdInvites = sortedInvites.filter(
    (invite) => !invite.is_used && !invite.sent_at,
  );

  const sentInvites = sortedInvites.filter(
    (invite) => !invite.is_used && !!invite.sent_at,
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

  const stats: { key: TabType; value: number; label: string }[] = [
    {
      key: "created",
      value: createdInvites.length,
      label: t("inv.counter.created"),
    },
    { key: "sent", value: sentInvites.length, label: t("inv.counter.sent") },
    {
      key: "invited",
      value: invitedUsers.length,
      label: t("inv.counter.invited"),
    },
  ];

  const renderInviteCard = (invite: any) => {
    const isConfirming = confirmDeleteId === invite.id;
    const isDeleting = deletingId === invite.id;

    return (
      <View key={invite.id} style={styles.card}>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{invite.code}</Text>

          {!!invite.sent_at && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t("inv.badge.sent")}</Text>
            </View>
          )}
        </View>

        {!!formatDate(invite.sent_at || invite.created_at) && (
          <Text style={styles.meta}>
            {invite.sent_at
              ? t("inv.sentAt", { дата: formatDate(invite.sent_at) })
              : t("inv.createdAt", { дата: formatDate(invite.created_at) })}
          </Text>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => handleCopyInvite(invite)}
            activeOpacity={0.85}
          >
            <Text style={styles.smallButtonText}>{t("inv.copy")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => handleTelegramInvite(invite)}
            activeOpacity={0.85}
          >
            <Text style={styles.smallButtonText}>{t("inv.telegram")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => handleWhatsappInvite(invite)}
            activeOpacity={0.85}
          >
            <Text style={styles.smallButtonText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallButton,
              styles.dangerButton,
              isDeleting && styles.disabled,
            ]}
            onPress={() => handleDeletePress(invite)}
            disabled={isDeleting}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallButtonText, styles.dangerButtonText]}>
              {isDeleting
                ? t("inv.deleting")
                : isConfirming
                  ? t("post.deleteCommentConfirm")
                  : t("post.deleteComment")}
            </Text>
          </TouchableOpacity>
        </View>

        {isConfirming && !isDeleting && (
          <TouchableOpacity
            onPress={() => setConfirmDeleteId(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelLink}>{t("set.dontDelete")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 10 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Platform.OS === "web" && (
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>{t("common.backArrow")}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>{t("inv.title")}</Text>
        <Text style={styles.subtitle}>{t("common.brandCaps")}</Text>

        <Tekmet style={styles.tekmet} />

        <View style={styles.statsRow}>
          {stats.map((stat) => {
            const isActive = activeTab === stat.key;

            return (
              <TouchableOpacity
                key={stat.key}
                style={[styles.statCard, isActive && styles.statCardActive]}
                activeOpacity={0.85}
                onPress={() => setActiveTab(stat.key)}
              >
                <Text
                  style={[styles.statNumber, isActive && styles.statTextActive]}
                >
                  {stat.value}
                </Text>
                <Text
                  style={[styles.statLabel, isActive && styles.statTextActive]}
                >
                  {stat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryShadow, creating && styles.disabled]}
          onPress={handleCreateInvite}
          disabled={creating}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>
                {creating ? t("inv.creating") : t("inv.create")}
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>

        {/* Заголовок раздела показываем, только когда в нём что-то есть:
            у пустого раздела и так стоит поясняющая строка (Веха 65). */}
        {(activeTab === "created"
          ? createdInvites.length > 0
          : activeTab === "sent"
            ? sentInvites.length > 0
            : invitedUsers.length > 0) && (
          <Text style={styles.blockLabel}>
            {activeTab === "created"
              ? t("inv.section.free")
              : activeTab === "sent"
                ? t("inv.section.sent")
                : t("inv.section.invited")}
          </Text>
        )}

        {activeTab === "created" &&
          (createdInvites.length === 0 ? (
            <Text style={styles.emptyText}>{t("inv.empty.free")}</Text>
          ) : (
            createdInvites.map((invite) => renderInviteCard(invite))
          ))}

        {activeTab === "sent" &&
          (sentInvites.length === 0 ? (
            <Text style={styles.emptyText}>{t("inv.empty.sent")}</Text>
          ) : (
            sentInvites.map((invite) => renderInviteCard(invite))
          ))}

        {activeTab === "invited" &&
          (invitedUsers.length === 0 ? (
            <Text style={styles.emptyText}>{t("inv.empty.invited")}</Text>
          ) : (
            invitedUsers.map((item) => (
              // Пришедший человек — живая строка (Веха 59): аватарка, ФИО,
              // дата прихода; нажатие открывает профиль (как в «Людях»).
              <TouchableOpacity
                key={item.invite_id}
                style={styles.invitedRow}
                activeOpacity={0.8}
                disabled={!item.user}
                onPress={() => {
                  if (!item.user) return;
                  router.push({
                    pathname: "/user-profile" as any,
                    params: authorProfileParams(item.user),
                  });
                }}
              >
                <Image
                  source={
                    item.avatar_path
                      ? { uri: item.avatar_path }
                      : require("../assets/default-avatar.png")
                  }
                  style={styles.invitedAvatar}
                />
                <View style={styles.invitedInfo}>
                  <Text style={styles.invitedName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!item.used_at && (
                    <Text style={styles.invitedDate}>
                      {t("inv.usedAt", {
                        дата: new Date(item.used_at).toLocaleDateString(
                          dateLocale(),
                        ),
                      })}
                    </Text>
                  )}
                </View>
                <Text style={styles.invitedArrow}>›</Text>
              </TouchableOpacity>
            ))
          ))}
      </ScrollView>
    </View>
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

  container: {
    paddingHorizontal: 20,
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

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 34,
    color: "#3F6B5B",
    textAlign: "center",
  },

  subtitle: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
    textAlign: "center",
    marginTop: 8,
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 20,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingVertical: 14,
    alignItems: "center",
  },

  statCardActive: {
    backgroundColor: "rgba(105,183,141,0.12)",
    borderColor: "rgba(105,183,141,0.55)",
  },

  statNumber: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 24,
    color: "#3F6B5B",
  },

  statLabel: {
    fontSize: 12,
    color: "#7E988B",
    marginTop: 2,
  },

  statTextActive: {
    color: "#3F6B5B",
  },

  primaryShadow: {
    borderRadius: 18,
    marginBottom: 26,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  blockLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#719686",
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 10,
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  code: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 22,
    letterSpacing: 2,
    color: "#3F6B5B",
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(105,183,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,183,141,0.55)",
  },

  badgeText: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#3F6B5B",
  },

  meta: {
    marginTop: 6,
    fontSize: 12.5,
    color: "#8FA79A",
  },

  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  smallButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
  },

  smallButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  dangerButton: {
    borderColor: "rgba(192,91,77,0.45)",
    backgroundColor: "rgba(192,91,77,0.06)",
  },

  dangerButtonText: {
    color: "#C05B4D",
  },

  cancelLink: {
    marginTop: 10,
    fontSize: 14,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },

  disabled: {
    opacity: 0.7,
  },

  invitedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  invitedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: "#EAF4EE",
  },

  invitedInfo: {
    flex: 1,
    minWidth: 0,
  },

  invitedName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2F4A3C",
  },

  invitedDate: {
    fontSize: 12,
    color: "#96AC9E",
    marginTop: 1,
  },

  invitedArrow: {
    fontSize: 22,
    color: "#96AC9E",
    marginLeft: 8,
  },

  emptyText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginTop: 12,
  },
});
