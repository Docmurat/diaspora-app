import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { subscribeToChanges } from "../services/liveService";
import {
  approveNameChangeRequest,
  approveUser,
  closeAppeal,
  getAppealMessages,
  getBlockedUsers,
  getClosedAppeals,
  getOpenAppeals,
  getPendingComplaints,
  getPendingNameChangeRequests,
  getPendingUsers,
  rejectComplaint,
  rejectNameChangeRequest,
  rejectUser,
  replyToAppeal,
  resolveComplaint,
  takeAppeal,
  takeComplaint,
  takeNameChangeRequest,
  takeUserModeration,
  unblockUser,
} from "../services/moderationService";
import { getCurrentProfile } from "../services/sessionService";

type QueueTab = "new" | "in_progress" | "needs_revision" | "done";
type OwnershipFilter = "all" | "mine";

type ModerationAction = {
  type:
    | "reject_user"
    | "revision_user"
    | "reject_name_change"
    | "reject_complaint"
    | "reject_invite_request";
  targetId: string;
  title: string;
  placeholder: string;
  confirmText: string;
} | null;

type UnifiedItem = {
  id: string;
  kind:
    | "registration"
    | "invite_request"
    | "name_change"
    | "complaint"
    | "appeal"
    | "blocked";
  queue: QueueTab;
  createdAt?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  takenAt?: string | null;
  badge: string;
  title: string;
  subtitle?: string;
  raw: any;
};

// Цвет ярлыка = вид заявки. Жалоба красная, блокировка тёмная,
// смена имени янтарная, остальное — в фирменной зелени.
const KIND_CHIP: Record<string, { box: object; text: object }> = {
  registration: {
    box: {
      backgroundColor: "rgba(105,183,141,0.12)",
      borderColor: "rgba(105,183,141,0.55)",
    },
    text: { color: "#3F6B5B" },
  },
  invite_request: {
    box: {
      backgroundColor: "rgba(93,140,120,0.10)",
      borderColor: "rgba(93,140,120,0.45)",
    },
    text: { color: "#4E7364" },
  },
  name_change: {
    box: {
      backgroundColor: "rgba(224,163,62,0.12)",
      borderColor: "rgba(224,163,62,0.55)",
    },
    text: { color: "#9A6C16" },
  },
  complaint: {
    box: {
      backgroundColor: "rgba(192,91,77,0.10)",
      borderColor: "rgba(192,91,77,0.55)",
    },
    text: { color: "#C05B4D" },
  },
  appeal: {
    box: {
      backgroundColor: "rgba(113,150,134,0.12)",
      borderColor: "rgba(113,150,134,0.55)",
    },
    text: { color: "#4E7364" },
  },
  blocked: {
    box: {
      backgroundColor: "rgba(47,74,60,0.10)",
      borderColor: "rgba(47,74,60,0.45)",
    },
    text: { color: "#2F4A3C" },
  },
};

// Виды заявок для фильтра во вкладке «Новое»
const NEW_KINDS = [
  { key: "all", label: "Все" },
  { key: "registration", label: "Регистрации" },
  { key: "invite_request", label: "Заявки" },
  { key: "name_change", label: "Смена ФИО" },
  { key: "complaint", label: "Жалобы" },
  { key: "appeal", label: "Обращения" },
];

export default function ModerationScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Уведомление приводит сюда сразу к нужной очереди и карточке:
  // /moderation?tab=needs_revision&focus=<id>
  const params = useLocalSearchParams();
  const focusId = String(params.focus || "");
  const focusTab = String(params.tab || "");

  const [activeTab, setActiveTab] = useState<QueueTab>("new");
  // Фильтр по виду заявки внутри вкладки «Новое»
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {},
  );
  const [me, setMe] = useState<any>(null);

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [inviteRequests, setInviteRequests] = useState<any[]>([]);
  const [nameRequests, setNameRequests] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  const [appeals, setAppeals] = useState<any[]>([]);
  const [closedAppeals, setClosedAppeals] = useState<any[]>([]);
  const [appealMessages, setAppealMessages] = useState<Record<string, any[]>>(
    {},
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [closingAppealId, setClosingAppealId] = useState<string | null>(null);

  const [completedUsers, setCompletedUsers] = useState<any[]>([]);
  const [completedInviteRequests, setCompletedInviteRequests] = useState<any[]>(
    [],
  );
  const [completedNameRequests, setCompletedNameRequests] = useState<any[]>([]);
  const [completedComplaints, setCompletedComplaints] = useState<any[]>([]);

  const [latestInviteMessages, setLatestInviteMessages] = useState<
    Record<string, any[]>
  >({});
  const [loading, setLoading] = useState(true);

  // Рубильник уведомлений модерации: «выходной» — заявки продолжают
  // копиться в этом меню, но уведомления и пуши не приходят.
  const [noticesEnabled, setNoticesEnabled] = useState(true);
  const [savingNotices, setSavingNotices] = useState(false);

  const [actionModal, setActionModal] = useState<ModerationAction>(null);
  const [actionComment, setActionComment] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Экран обновляется сам, как только что-то меняется в базе
  useEffect(() => {
    return subscribeToChanges(
      "moderation-screen",
      [
        { table: "users" },
        { table: "invite_requests" },
        { table: "name_change_requests" },
        { table: "complaints" },
        { table: "appeals" },
        { table: "moderation_messages" },
        // Запасной и самый надёжный путь: уведомление модератору приходит
        // всегда, а вот сами таблицы заявок при трансляции могут молчать
        // из-за проверок доступа. Пришло уведомление — обновляем списки.
        { table: "notifications" },
      ],
      () => {
        loadData(true);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const allowed: QueueTab[] = [
      "new",
      "in_progress",
      "needs_revision",
      "done",
    ];

    if (allowed.includes(focusTab as QueueTab)) {
      setActiveTab(focusTab as QueueTab);
    }

    if (focusId) {
      // В ссылке может прийти как id участника, так и полный ключ карточки
      setExpandedCards((prev) => ({
        ...prev,
        [focusId]: true,
        [`registration-${focusId}`]: true,
        [`appeal-${focusId}`]: true,
      }));
    }
  }, [focusId, focusTab]);

  const toggleNotices = async () => {
    if (!me?.id || savingNotices) return;

    const next = !noticesEnabled;
    setNoticesEnabled(next);
    setSavingNotices(true);

    try {
      const { error } = await supabase
        .from("users")
        .update({ moderation_notifications_enabled: next })
        .eq("id", me.id);

      if (error) throw new Error(error.message);
    } catch (e) {
      setNoticesEnabled(!next);
      Alert.alert("Ошибка", "Не удалось сохранить настройку уведомлений");
    } finally {
      setSavingNotices(false);
    }
  };

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const openActionModal = (action: NonNullable<ModerationAction>) => {
    setActionComment("");
    setActionModal(action);
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionComment("");
  };

  const loadInviteRequests = async () => {
    const { data, error } = await supabase
      .from("invite_requests")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        invited_by:invited_by_user_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `,
      )
      .in("moderation_status", ["approved", "rejected"])
      .eq("is_deleted", false)
      .not("moderation_completed_at", "is", null)
      .order("moderation_completed_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedInviteRequests = async () => {
    const { data, error } = await supabase
      .from("invite_requests")
      .select("*")
      .in("status", ["approved", "rejected"])
      .not("final_decision_at", "is", null)
      .order("final_decision_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedNameRequests = async () => {
    const { data, error } = await supabase
      .from("name_change_requests")
      .select("*")
      .in("status", ["approved", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedComplaints = async () => {
    const { data, error } = await supabase
      .from("complaints")
      .select(
        `
        *,
        reporter:reporter_user_id (
          id,
          first_name,
          last_name,
          email,
          avatar_path
        ),
        target:target_user_id (
          id,
          first_name,
          last_name,
          email,
          avatar_path
        )
      `,
      )
      .in("status", ["resolved", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadLatestInviteMessages = async (users: any[]) => {
    try {
      const userIds = users.map((user) => user.id).filter(Boolean);

      if (userIds.length === 0) {
        setLatestInviteMessages({});
        return;
      }

      const { data, error } = await supabase
        .from("moderation_messages")
        .select("*")
        .eq("request_type", "invite_request")
        .in("request_id", userIds)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const map: Record<string, any[]> = {};

      for (const item of data || []) {
        if (!map[item.request_id]) {
          map[item.request_id] = [];
        }
        if (map[item.request_id].length < 5) {
          map[item.request_id].push(item);
        }
      }

      Object.keys(map).forEach((key) => {
        map[key] = [...map[key]].reverse();
      });

      setLatestInviteMessages(map);
    } catch (e) {
      console.log("Ошибка загрузки сообщений модерации:", e);
      setLatestInviteMessages({});
    }
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [
        profile,
        users,
        inviteReqs,
        requests,
        blocked,
        complaintsData,
        openAppeals,
        finishedAppeals,
        finishedUsers,
        finishedInviteRequests,
        finishedNameRequests,
        finishedComplaints,
      ] = await Promise.all([
        getCurrentProfile(),
        getPendingUsers(),
        loadInviteRequests(),
        getPendingNameChangeRequests(),
        getBlockedUsers(),
        getPendingComplaints(),
        getOpenAppeals(),
        getClosedAppeals(),
        loadCompletedUsers(),
        loadCompletedInviteRequests(),
        loadCompletedNameRequests(),
        loadCompletedComplaints(),
      ]);

      setMe(profile);
      setNoticesEnabled(
        (profile as any)?.moderation_notifications_enabled !== false,
      );
      setPendingUsers(users);
      setInviteRequests(inviteReqs);
      setNameRequests(requests);
      setBlockedUsers(blocked);
      setComplaints(complaintsData);

      setAppeals(openAppeals);
      setClosedAppeals(finishedAppeals);

      setCompletedUsers(finishedUsers);
      setCompletedInviteRequests(finishedInviteRequests);
      setCompletedNameRequests(finishedNameRequests);
      setCompletedComplaints(finishedComplaints);

      await loadLatestInviteMessages(users);

      try {
        const appealIds = [
          ...openAppeals.map((appeal: any) => appeal.id),
          ...finishedAppeals.map((appeal: any) => appeal.id),
        ].filter(Boolean);

        setAppealMessages(await getAppealMessages(appealIds));
      } catch (e) {
        console.log("Ошибка загрузки переписки обращений:", e);
        setAppealMessages({});
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка загрузки модерации";
      Alert.alert("Ошибка", message);
    } finally {
      setLoading(false);
    }
  };

  const refreshOneUser = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        invited_by:invited_by_user_id (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        assigned_moderator:moderation_assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("id", userId)
      .single();

    if (error) throw new Error(error.message);

    setPendingUsers((prev) =>
      prev.map((item) => (item.id === userId ? data : item)),
    );
  };

  const refreshOneInviteRequest = async (requestId: string) => {
    const { data, error } = await supabase
      .from("invite_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (error) throw new Error(error.message);

    setInviteRequests((prev) =>
      prev.map((item) => (item.id === requestId ? data : item)),
    );
  };

  const refreshOneNameChange = async (requestId: string) => {
    const { data, error } = await supabase
      .from("name_change_requests")
      .select(
        `
        *,
        assigned_moderator:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("id", requestId)
      .single();

    if (error) throw new Error(error.message);

    setNameRequests((prev) =>
      prev.map((item) => (item.id === requestId ? data : item)),
    );
  };

  const refreshOneComplaint = async (complaintId: string) => {
    const { data, error } = await supabase
      .from("complaints")
      .select(
        `
        *,
        reporter:reporter_user_id (
          id,
          first_name,
          last_name,
          email,
          avatar_path
        ),
        target:target_user_id (
          id,
          first_name,
          last_name,
          email,
          avatar_path
        ),
        assigned_moderator:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("id", complaintId)
      .single();

    if (error) throw new Error(error.message);

    setComplaints((prev) =>
      prev.map((item) => (item.id === complaintId ? data : item)),
    );
  };

  const markRegistrationRead = async (userId: string) => {
    try {
      const target = pendingUsers.find((item) => item.id === userId);
      if (!target?.moderator_has_unread_changes) return;

      const { error } = await supabase
        .from("users")
        .update({
          moderator_has_unread_changes: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw new Error(error.message);

      setPendingUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? { ...item, moderator_has_unread_changes: false }
            : item,
        ),
      );
    } catch (e) {
      console.log("Не удалось сбросить маркер изменений:", e);
    }
  };

  const handleRegistrationCardPress = async (userId: string) => {
    const cardId = `registration-${userId}`;
    const isOpening = !expandedCards[cardId];

    toggleCard(cardId);

    if (isOpening) {
      await markRegistrationRead(userId);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const myDisplayName =
    `${me?.first_name || ""} ${me?.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const isOwner = me?.role === "owner";

  const canManageAssignedTask = (assignedTo?: string | null) => {
    if (isOwner) return true;
    if (!assignedTo) return false;
    return assignedTo === me?.id;
  };

  const formatShortDate = (dateString?: string | null) => {
    if (!dateString) return "—";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDuration = (dateString?: string | null) => {
    if (!dateString) return null;

    const start = new Date(dateString).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - start);

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatResolutionDuration = (
    createdAt?: string | null,
    completedAt?: string | null,
  ) => {
    if (!createdAt || !completedAt) return null;

    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return null;
    }

    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const getTaskAgeLevel = (dateString?: string | null) => {
    if (!dateString) return "normal";

    const start = new Date(dateString).getTime();
    const now = Date.now();
    const diffHours = (now - start) / (1000 * 60 * 60);

    if (diffHours >= 24) return "critical";
    if (diffHours >= 6) return "warning";
    return "normal";
  };

  const getTaskStatusText = (
    assignedName?: string | null,
    takenAt?: string | null,
  ) => {
    if (!assignedName) return "Свободна";

    const duration = formatDuration(takenAt);
    return duration
      ? `В работе у ${assignedName} • ${duration}`
      : `В работе у ${assignedName}`;
  };

  const getTaskPriorityScore = (
    assignedName?: string | null,
    takenAt?: string | null,
    createdAt?: string | null,
  ) => {
    const ageLevel = getTaskAgeLevel(takenAt);

    if (ageLevel === "critical") return 0;
    if (ageLevel === "warning") return 1;
    if (assignedName) return 2;
    if (createdAt) return 3;

    return 4;
  };

  const getArchiveStatusStyle = (statusLabel: string) => {
    const normalized = String(statusLabel || "").toLowerCase();

    if (normalized.includes("одобрено") || normalized.includes("принято")) {
      return {
        container: styles.archiveChipApproved,
        text: styles.archiveChipApprovedText,
      };
    }

    if (normalized.includes("отклонено")) {
      return {
        container: styles.archiveChipRejected,
        text: styles.archiveChipRejectedText,
      };
    }

    if (normalized.includes("разблокирован")) {
      return {
        container: styles.archiveChipNeutral,
        text: styles.archiveChipNeutralText,
      };
    }

    return {
      container: styles.archiveChipNeutral,
      text: styles.archiveChipNeutralText,
    };
  };

  const handleTakeUser = async (userId: string) => {
    try {
      await takeUserModeration(userId);
      await refreshOneUser(userId);
    } catch {
      Alert.alert(
        "Нельзя принять заявку",
        "Эту заявку уже взял другой модератор.",
      );

      try {
        await refreshOneUser(userId);
      } catch (refreshError) {
        console.log("Ошибка обновления карточки:", refreshError);
      }
    }
  };

  const handleTakeInviteRequest = async (requestId: string) => {
    try {
      if (isOwner) {
        const { error } = await supabase
          .from("invite_requests")
          .update({
            assigned_to: me.id,
            assigned_name: myDisplayName,
            taken_at: new Date().toISOString(),
          })
          .eq("id", requestId);

        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("invite_requests")
          .update({
            assigned_to: me.id,
            assigned_name: myDisplayName,
            taken_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .is("assigned_to", null)
          .select("id")
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error("Заявка уже занята");
      }

      await refreshOneInviteRequest(requestId);
    } catch {
      Alert.alert(
        "Нельзя принять заявку",
        "Эту заявку уже взял другой модератор.",
      );

      try {
        await refreshOneInviteRequest(requestId);
      } catch (refreshError) {
        console.log("Ошибка обновления карточки:", refreshError);
      }
    }
  };

  const handleTakeNameChange = async (requestId: string) => {
    try {
      await takeNameChangeRequest(requestId);
      await refreshOneNameChange(requestId);
    } catch {
      Alert.alert(
        "Нельзя принять заявку",
        "Эту заявку уже взял другой модератор.",
      );

      try {
        await refreshOneNameChange(requestId);
      } catch (refreshError) {
        console.log("Ошибка обновления карточки:", refreshError);
      }
    }
  };

  const handleTakeComplaint = async (complaintId: string) => {
    try {
      await takeComplaint(complaintId);
      await refreshOneComplaint(complaintId);
    } catch {
      Alert.alert(
        "Нельзя принять заявку",
        "Эту заявку уже взял другой модератор.",
      );

      try {
        await refreshOneComplaint(complaintId);
      } catch (refreshError) {
        console.log("Ошибка обновления карточки:", refreshError);
      }
    }
  };

  const handleTakeAppeal = async (appealId: string) => {
    try {
      await takeAppeal(appealId);
      await loadData(true);
    } catch {
      Alert.alert(
        "Нельзя взять обращение",
        "Это обращение уже взял другой модератор.",
      );

      try {
        await loadData(true);
      } catch (refreshError) {
        console.log("Ошибка обновления обращений:", refreshError);
      }
    }
  };

  const handleCloseAppeal = async (appealId: string) => {
    if (closingAppealId) return;

    try {
      setClosingAppealId(appealId);
      await closeAppeal(appealId);
      await loadData(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось закрыть обращение";
      Alert.alert("Ошибка", message);
    } finally {
      setClosingAppealId(null);
    }
  };

  const handleSendAppealReply = async (appealId: string) => {
    const text = (replyDrafts[appealId] || "").trim();

    if (!text || sendingReplyId) return;

    try {
      setSendingReplyId(appealId);
      await replyToAppeal(appealId, text);
      setReplyDrafts((prev) => ({ ...prev, [appealId]: "" }));
      await loadData(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отправить ответ";
      Alert.alert("Ошибка", message);
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleApproveUser = async (user: any) => {
    try {
      await approveUser(user.id);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка одобрения анкеты";
      Alert.alert("Ошибка", message);
    }
  };

  const handleApproveInviteRequest = async (request: any) => {
    try {
      const { error } = await supabase
        .from("invite_requests")
        .update({
          status: "approved",
          reviewed_by_user_id: me.id,
          completed_by_name: myDisplayName,
          final_decision_at: new Date().toISOString(),
          assigned_to: null,
          assigned_name: null,
          taken_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw new Error(error.message);

      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка одобрения заявки";
      Alert.alert("Ошибка", message);
    }
  };

  const handleApproveNameChange = async (request: any) => {
    try {
      await approveNameChangeRequest(request);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка одобрения изменения ФИО";
      Alert.alert("Ошибка", message);
    }
  };

  const handleResolveComplaint = async (complaint: any) => {
    try {
      await resolveComplaint(complaint.id);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка обработки жалобы";
      Alert.alert("Ошибка", message);
    }
  };

  const handleRejectUser = (userId: string) => {
    openActionModal({
      type: "reject_user",
      targetId: userId,
      title: "Отклонение анкеты",
      placeholder: "Укажите причину отклонения",
      confirmText: "Отклонить",
    });
  };

  const handleRevisionUser = (userId: string) => {
    openActionModal({
      type: "revision_user",
      targetId: userId,
      title: "Вернуть на доработку",
      placeholder: "Укажите, что нужно исправить",
      confirmText: "Отправить",
    });
  };

  const handleRejectInviteRequest = (requestId: string) => {
    openActionModal({
      type: "reject_invite_request",
      targetId: requestId,
      title: "Отклонение заявки",
      placeholder: "Укажите причину отклонения",
      confirmText: "Отклонить",
    });
  };

  const handleRejectNameChange = (requestId: string) => {
    openActionModal({
      type: "reject_name_change",
      targetId: requestId,
      title: "Отклонение смены ФИО",
      placeholder: "Укажите причину отклонения",
      confirmText: "Отклонить",
    });
  };

  const handleRejectComplaint = (complaintId: string) => {
    openActionModal({
      type: "reject_complaint",
      targetId: complaintId,
      title: "Отклонение жалобы",
      placeholder: "Укажите причину отклонения",
      confirmText: "Отклонить",
    });
  };

  const handleOpenDraftProfile = (userId: string) => {
    router.push({
      pathname: "/user-profile",
      params: {
        userId,
        mode: "moderation",
      },
    });
  };

  const handleUnblockUser = async (user: any) => {
    try {
      await unblockUser(user.id);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка разблокировки";
      Alert.alert("Ошибка", message);
    }
  };

  const submitActionModal = async () => {
    if (!actionModal) return;

    try {
      setSubmittingAction(true);
      const comment = actionComment.trim() || undefined;

      if (actionModal.type === "reject_user") {
        await rejectUser(actionModal.targetId, comment, "reject");
      } else if (actionModal.type === "revision_user") {
        await rejectUser(actionModal.targetId, comment, "revision");
      } else if (actionModal.type === "reject_invite_request") {
        const { error } = await supabase
          .from("invite_requests")
          .update({
            status: "rejected",
            review_note: comment || "Заявка отклонена",
            reviewed_by_user_id: me.id,
            completed_by_name: myDisplayName,
            final_decision_at: new Date().toISOString(),
            assigned_to: null,
            assigned_name: null,
            taken_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", actionModal.targetId);

        if (error) throw new Error(error.message);
      } else if (actionModal.type === "reject_name_change") {
        await rejectNameChangeRequest(actionModal.targetId, comment);
      } else if (actionModal.type === "reject_complaint") {
        await rejectComplaint(actionModal.targetId, comment);
      }

      setActionModal(null);
      setActionComment("");
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка действия";
      Alert.alert("Ошибка", message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderInviteMessages = (userId: string) => {
    const latestMessages = latestInviteMessages[userId] || [];
    if (latestMessages.length === 0) return null;

    return (
      <View style={styles.messageBox}>
        <Text style={styles.messageLabel}>Диалог</Text>

        {latestMessages.map((msg) => (
          <View key={msg.id} style={styles.messageItem}>
            <Text style={styles.messageMeta}>
              {msg.author_role === "user"
                ? "Пользователь"
                : msg.author_role === "moderator"
                  ? "Модератор"
                  : "Система"}
            </Text>
            <Text style={styles.messageText} numberOfLines={4}>
              {msg.message}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderAppealMessages = (appealId: string) => {
    const messages = appealMessages[String(appealId)] || [];
    if (messages.length === 0) return null;

    return (
      <View style={styles.messageBox}>
        <Text style={styles.messageLabel}>Переписка</Text>

        {messages.map((msg) => (
          <View key={msg.id} style={styles.messageItem}>
            <Text style={styles.messageMeta}>
              {msg.author_role === "user" ? "Участник" : "Модератор"}
              {"  •  "}
              {formatShortDate(msg.created_at)}
            </Text>
            <Text style={styles.messageText}>{msg.message}</Text>
          </View>
        ))}
      </View>
    );
  };

  const allItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    pendingUsers.forEach((user) => {
      items.push({
        id: `registration-${user.id}`,
        kind: "registration",
        queue:
          user.moderation_status === "needs_revision"
            ? "needs_revision"
            : user.moderation_assigned_to
              ? "in_progress"
              : "new",
        createdAt: user.created_at,
        assignedTo: user.moderation_assigned_to,
        assignedName: user.moderation_assigned_name,
        takenAt: user.moderation_taken_at,
        badge: "Регистрация",
        title: `${user.first_name} ${user.last_name}`,
        subtitle: user.email || undefined,
        raw: user,
      });
    });

    inviteRequests.forEach((request) => {
      items.push({
        id: `invite_request-${request.id}`,
        kind: "invite_request",
        queue: request.assigned_to ? "in_progress" : "new",
        createdAt: request.created_at,
        assignedTo: request.assigned_to,
        assignedName: request.assigned_name,
        takenAt: request.taken_at,
        badge: "Заявка",
        title: request.full_name || "Без имени",
        subtitle: request.phone || request.telegram || undefined,
        raw: request,
      });
    });

    nameRequests.forEach((request) => {
      items.push({
        id: `name_change-${request.id}`,
        kind: "name_change",
        queue: request.assigned_to ? "in_progress" : "new",
        createdAt: request.created_at,
        assignedTo: request.assigned_to,
        assignedName: request.assigned_name,
        takenAt: request.taken_at,
        badge: "Смена ФИО",
        title: `${request.current_first_name} ${request.current_last_name}`,
        subtitle: `→ ${request.requested_first_name} ${request.requested_last_name}`,
        raw: request,
      });
    });

    complaints.forEach((complaint) => {
      items.push({
        id: `complaint-${complaint.id}`,
        kind: "complaint",
        queue: complaint.assigned_to ? "in_progress" : "new",
        createdAt: complaint.created_at,
        assignedTo: complaint.assigned_to,
        assignedName: complaint.assigned_name,
        takenAt: complaint.taken_at,
        badge: "Жалоба",
        title:
          `На: ${complaint.target?.first_name || ""} ${complaint.target?.last_name || ""}`.trim(),
        subtitle:
          `От: ${complaint.reporter?.first_name || ""} ${complaint.reporter?.last_name || ""}`.trim(),
        raw: complaint,
      });
    });

    appeals.forEach((appeal) => {
      const authorName =
        `${appeal.author?.first_name || ""} ${appeal.author?.last_name || ""}`.trim() ||
        "Без имени";

      items.push({
        id: `appeal-${appeal.id}`,
        kind: "appeal",
        queue: appeal.assigned_to ? "in_progress" : "new",
        createdAt: appeal.created_at,
        assignedTo: appeal.assigned_to,
        assignedName: appeal.assigned_name,
        takenAt: appeal.taken_at,
        badge: "Обращение",
        title: authorName,
        subtitle: appeal.author?.email || undefined,
        raw: appeal,
      });
    });

    blockedUsers.forEach((user) => {
      items.push({
        id: `blocked-${user.id}`,
        kind: "blocked",
        queue: "in_progress",
        createdAt: user.updated_at,
        badge: "Блокировка",
        title: `${user.first_name} ${user.last_name}`,
        subtitle: user.email || undefined,
        raw: user,
      });
    });

    completedUsers.forEach((user) => {
      items.push({
        id: `done-registration-${user.id}`,
        kind: "registration",
        queue: "done",
        createdAt: user.created_at,
        badge: "Регистрация",
        title:
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          "Без имени",
        subtitle: user.moderation_note || undefined,
        raw: {
          entityId: user.id,
          type: "registration",
          title:
            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
            "Без имени",
          subtitle: user.moderation_note || undefined,
          statusLabel:
            user.moderation_status === "approved" ? "Одобрено" : "Отклонено",
          moderatorName: user.moderation_completed_by_name || undefined,
          completedById: user.moderation_completed_by || undefined,
          createdAt: user.created_at,
          startedAt: user.moderation_taken_at,
          completedAt: user.moderation_completed_at,
        },
      });
    });

    completedInviteRequests.forEach((request) => {
      items.push({
        id: `done-invite_request-${request.id}`,
        kind: "invite_request",
        queue: "done",
        createdAt: request.created_at,
        badge: "Заявка",
        title: request.full_name || "Без имени",
        subtitle: request.review_note || undefined,
        raw: {
          entityId: request.id,
          type: "invite_request",
          title: request.full_name || "Без имени",
          subtitle: request.review_note || undefined,
          statusLabel: request.status === "approved" ? "Одобрено" : "Отклонено",
          moderatorName: request.completed_by_name || undefined,
          completedById: request.reviewed_by_user_id || undefined,
          createdAt: request.created_at,
          startedAt: request.taken_at,
          completedAt: request.final_decision_at,
        },
      });
    });

    completedNameRequests.forEach((request) => {
      items.push({
        id: `done-name_change-${request.id}`,
        kind: "name_change",
        queue: "done",
        createdAt: request.created_at,
        badge: "Смена ФИО",
        title: `${request.current_first_name} ${request.current_last_name}`,
        subtitle:
          request.review_note ||
          `→ ${request.requested_first_name} ${request.requested_last_name}`,
        raw: {
          entityId: request.id,
          type: "name_change",
          title: `${request.current_first_name} ${request.current_last_name}`,
          subtitle:
            request.review_note ||
            `→ ${request.requested_first_name} ${request.requested_last_name}`,
          statusLabel: request.status === "approved" ? "Одобрено" : "Отклонено",
          moderatorName: request.completed_by_name || undefined,
          completedById: request.reviewed_by || undefined,
          createdAt: request.created_at,
          startedAt: request.taken_at,
          completedAt: request.reviewed_at,
        },
      });
    });

    completedComplaints.forEach((complaint) => {
      items.push({
        id: `done-complaint-${complaint.id}`,
        kind: "complaint",
        queue: "done",
        createdAt: complaint.created_at,
        badge: "Жалоба",
        title:
          `Жалоба на ${complaint.target?.first_name || ""} ${complaint.target?.last_name || ""}`.trim(),
        subtitle: complaint.review_note || complaint.reason || undefined,
        raw: {
          entityId: complaint.id,
          type: "complaint",
          title:
            `Жалоба на ${complaint.target?.first_name || ""} ${complaint.target?.last_name || ""}`.trim(),
          subtitle: complaint.review_note || complaint.reason || undefined,
          statusLabel:
            complaint.status === "resolved" ? "Принято" : "Отклонено",
          moderatorName: complaint.completed_by_name || undefined,
          completedById: complaint.reviewed_by || undefined,
          createdAt: complaint.created_at,
          startedAt: complaint.taken_at,
          completedAt: complaint.reviewed_at,
        },
      });
    });

    closedAppeals.forEach((appeal) => {
      const authorName =
        `${appeal.author?.first_name || ""} ${appeal.author?.last_name || ""}`.trim() ||
        "Без имени";

      items.push({
        id: `done-appeal-${appeal.id}`,
        kind: "appeal",
        queue: "done",
        createdAt: appeal.created_at,
        badge: "Обращение",
        title: authorName,
        subtitle: appeal.review_note || undefined,
        raw: {
          entityId: appeal.id,
          type: "appeal",
          title: authorName,
          subtitle: appeal.review_note || undefined,
          statusLabel: "Закрыто",
          moderatorName: appeal.closed_by_name || undefined,
          completedById: appeal.closed_by || undefined,
          createdAt: appeal.created_at,
          startedAt: appeal.taken_at,
          completedAt: appeal.closed_at,
        },
      });
    });

    return items;
  }, [
    me?.id,
    pendingUsers,
    inviteRequests,
    nameRequests,
    complaints,
    appeals,
    closedAppeals,
    blockedUsers,
    completedUsers,
    completedInviteRequests,
    completedNameRequests,
    completedComplaints,
  ]);

  // Кому что видно: основатель видит все заявки и может переключаться
  // «Мои / Все». Остальные модераторы видят в очередях «В работе»,
  // «На доработке» и «Завершено» только свои заявки, а во «Новом» — все.
  const canSwitchOwnership = isOwner;

  const belongsToMe = useCallback(
    (item: UnifiedItem) => {
      if (item.queue === "done") {
        // Надёжный путь — по идентификатору модератора.
        if (item.raw?.completedById) {
          return item.raw.completedById === me?.id;
        }

        // Записи, закрытые до появления этого поля: сверяем по имени.
        return (
          !!myDisplayName &&
          !!item.raw?.moderatorName &&
          String(item.raw.moderatorName).trim() === myDisplayName
        );
      }

      return !!me?.id && item.assignedTo === me.id;
    },
    [me?.id, myDisplayName],
  );

  const passesOwnership = useCallback(
    (item: UnifiedItem, queue: QueueTab) => {
      if (queue === "new") return true;

      if (!canSwitchOwnership) return belongsToMe(item);
      if (ownershipFilter === "all") return true;

      return belongsToMe(item);
    },
    [canSwitchOwnership, ownershipFilter, belongsToMe],
  );

  const newKindCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };

    allItems.forEach((item) => {
      if (item.queue !== "new") return;
      if (!passesOwnership(item, "new")) return;

      counts.all += 1;
      counts[item.kind] = (counts[item.kind] || 0) + 1;
    });

    return counts;
  }, [allItems, passesOwnership]);

  const queueCounts = useMemo(() => {
    const counts: Record<QueueTab, number> = {
      new: 0,
      in_progress: 0,
      needs_revision: 0,
      done: 0,
    };

    allItems.forEach((item) => {
      if (passesOwnership(item, item.queue)) {
        counts[item.queue] += 1;
      }
    });

    return counts;
  }, [allItems, passesOwnership]);

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    return allItems
      .filter((item) => item.queue === activeTab)
      .filter((item) => passesOwnership(item, activeTab))
      .filter((item) =>
        activeTab === "new" && kindFilter !== "all"
          ? item.kind === kindFilter
          : true,
      )
      .sort((a, b) => {
        const priorityDiff =
          getTaskPriorityScore(a.assignedName, a.takenAt, a.createdAt) -
          getTaskPriorityScore(b.assignedName, b.takenAt, b.createdAt);

        if (priorityDiff !== 0) return priorityDiff;

        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
  }, [allItems, activeTab, passesOwnership, kindFilter]);

  // Участники жалобы — обычные участники сообщества, поэтому открываем
  // их настоящий профиль, а не режим модерации (он нужен для анкет,
  // которые ещё не опубликованы).
  const renderPersonRow = (label: string, person: any, accent: boolean) => {
    if (!person?.id) return null;

    const fullName =
      `${person.first_name || ""} ${person.last_name || ""}`.trim() ||
      "Без имени";

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() =>
          router.push({
            pathname: "/user-profile",
            params: { id: person.id },
          })
        }
        style={[styles.personRow, accent && styles.personRowAccent]}
      >
        <Image
          source={
            person.avatar_path
              ? { uri: person.avatar_path }
              : require("../assets/default-avatar.png")
          }
          style={styles.personAvatar}
        />

        <View style={styles.personInfo}>
          <Text
            style={[styles.personLabel, accent && styles.personLabelAccent]}
          >
            {label}
          </Text>
          <Text style={styles.personName} numberOfLines={1}>
            {fullName}
          </Text>
        </View>

        <Text style={styles.personArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderUnifiedCard = (item: UnifiedItem) => {
    if (item.queue === "done") {
      const archiveItem = item.raw;
      const statusStyle = getArchiveStatusStyle(archiveItem.statusLabel);
      const resolutionTime = formatResolutionDuration(
        archiveItem.createdAt,
        archiveItem.completedAt,
      );
      const isExpanded = !!expandedCards[item.id];

      return (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => toggleCard(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderMain}>
              <Text style={styles.name}>{archiveItem.title}</Text>
              <Text style={styles.cardCollapsedHint}>
                {formatShortDate(archiveItem.completedAt)}
              </Text>
            </View>

            <View style={[styles.archiveChip, statusStyle.container]}>
              <Text style={[styles.archiveChipText, statusStyle.text]}>
                {archiveItem.statusLabel}
              </Text>
            </View>
          </View>

          {isExpanded && (
            <>
              {!!archiveItem.subtitle && (
                <Text style={styles.mutedText}>{archiveItem.subtitle}</Text>
              )}

              <Text style={styles.text}>Тип: {item.badge}</Text>

              {!!archiveItem.moderatorName && (
                <Text style={styles.text}>
                  Обработал: {archiveItem.moderatorName}
                </Text>
              )}

              {!!resolutionTime && (
                <Text style={styles.text}>
                  От создания до завершения: {resolutionTime}
                </Text>
              )}

              {archiveItem.type === "appeal" ? (
                renderAppealMessages(archiveItem.entityId)
              ) : (
                <TouchableOpacity
                  style={styles.secondaryActionFull}
                  onPress={() =>
                    router.push({
                      pathname: "/moderation-case-details",
                      params: {
                        kind: archiveItem.type,
                        entityId: archiveItem.entityId,
                      },
                    })
                  }
                >
                  <Text style={styles.secondaryActionFullText}>Изучить</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (item.kind === "registration") {
            handleRegistrationCardPress(item.raw.id);
          } else {
            toggleCard(item.id);
          }
        }}
      >
        <View
          style={[
            styles.statusLine,
            getTaskAgeLevel(item.takenAt) === "critical"
              ? styles.statusLineCritical
              : getTaskAgeLevel(item.takenAt) === "warning"
                ? styles.statusLineWarning
                : styles.statusLineNormal,
          ]}
        >
          <Text style={styles.statusLineText}>
            {item.kind === "blocked"
              ? "Заблокирован"
              : getTaskStatusText(item.assignedName, item.takenAt)}
          </Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            {item.kind === "registration" ? (
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.title}</Text>
                {item.raw?.moderator_has_unread_changes && (
                  <View style={styles.unreadDot} />
                )}
              </View>
            ) : (
              <Text style={styles.name}>{item.title}</Text>
            )}
            <Text style={styles.cardCollapsedHint}>
              Нажмите, чтобы раскрыть
            </Text>
          </View>
          <View style={[styles.statusChip, KIND_CHIP[item.kind]?.box]}>
            <Text style={[styles.statusChipText, KIND_CHIP[item.kind]?.text]}>
              {item.badge}
            </Text>
          </View>
        </View>

        {expandedCards[item.id] && (
          <>
            {item.kind === "registration" &&
              (() => {
                const user = item.raw;
                return (
                  <>
                    <View style={styles.infoBlock}>
                      <Text style={styles.text}>
                        Телефон: {user.phone || "Без телефона"}
                      </Text>
                      <Text style={styles.text}>
                        Пригласил:{" "}
                        {user.invited_by
                          ? `${user.invited_by.first_name || ""} ${user.invited_by.last_name || ""}`.trim() ||
                            user.invited_by.email ||
                            "Неизвестно"
                          : "Неизвестно"}
                      </Text>
                      <Text style={styles.text}>
                        Профессия: {user.profession || "—"}
                      </Text>
                    </View>

                    {renderInviteMessages(user.id)}

                    <TouchableOpacity
                      style={styles.secondaryActionFull}
                      onPress={() => handleOpenDraftProfile(user.id)}
                    >
                      <Text style={styles.secondaryActionFullText}>
                        Открыть профиль
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.assignmentBlock}>
                      {!user.moderation_assigned_to &&
                      user.moderation_status !== "needs_revision" ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeUser(user.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(user.moderation_assigned_to) ? (
                        <View style={styles.actionGrid}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveUser(user)}
                          >
                            <Text style={styles.actionButtonText}>
                              Одобрить
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.warningAction}
                            onPress={() => handleRevisionUser(user.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              На доработку
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectUser(user.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              Отклонить
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Заявка уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === "invite_request" &&
              (() => {
                const request = item.raw;
                return (
                  <>
                    {!!request.phone && (
                      <Text style={styles.text}>Телефон: {request.phone}</Text>
                    )}
                    {!!request.telegram && (
                      <Text style={styles.text}>
                        Telegram: {request.telegram}
                      </Text>
                    )}
                    {!!request.about && (
                      <>
                        <Text style={styles.reasonLabel}>О себе</Text>
                        <Text style={styles.text}>{request.about}</Text>
                      </>
                    )}

                    <View style={styles.assignmentBlock}>
                      {!request.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeInviteRequest(request.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(request.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveInviteRequest(request)}
                          >
                            <Text style={styles.actionButtonText}>
                              Одобрить
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() =>
                              handleRejectInviteRequest(request.id)
                            }
                          >
                            <Text style={styles.actionButtonText}>
                              Отклонить
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Заявка уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === "name_change" &&
              (() => {
                const request = item.raw;
                return (
                  <>
                    <Text style={styles.mutedText}>
                      → {request.requested_first_name}{" "}
                      {request.requested_last_name}
                    </Text>

                    <Text style={styles.reasonLabel}>Причина</Text>
                    <Text style={styles.text}>{request.reason}</Text>

                    <View style={styles.assignmentBlock}>
                      {!request.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeNameChange(request.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(request.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveNameChange(request)}
                          >
                            <Text style={styles.actionButtonText}>
                              Одобрить
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectNameChange(request.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              Отклонить
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Запрос уже взят в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === "complaint" &&
              (() => {
                const complaint = item.raw;
                return (
                  <>
                    {renderPersonRow(
                      "НА КОГО ЖАЛУЮТСЯ",
                      complaint.target,
                      true,
                    )}
                    {renderPersonRow(
                      "КТО ПОЖАЛОВАЛСЯ",
                      complaint.reporter,
                      false,
                    )}

                    <Text style={styles.reasonLabel}>Причина</Text>
                    <Text style={styles.text}>{complaint.reason}</Text>

                    <View style={styles.assignmentBlock}>
                      {!complaint.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeComplaint(complaint.id)}
                        >
                          <Text style={styles.actionButtonText}>
                            Взять в работу
                          </Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(complaint.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleResolveComplaint(complaint)}
                          >
                            <Text style={styles.actionButtonText}>Решена</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectComplaint(complaint.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              Отклонена
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Жалоба уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === "appeal" &&
              (() => {
                const appeal = item.raw;
                const draft = replyDrafts[appeal.id] || "";
                const replyDisabled =
                  !draft.trim() || sendingReplyId === appeal.id;

                return (
                  <>
                    {renderPersonRow("АВТОР ОБРАЩЕНИЯ", appeal.author, false)}

                    {appeal.author?.is_deleted && (
                      <Text style={styles.mutedText}>
                        Участник удалён — возможно, просит восстановления
                      </Text>
                    )}

                    {renderAppealMessages(appeal.id)}

                    <View style={styles.assignmentBlock}>
                      {!appeal.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeAppeal(appeal.id)}
                        >
                          <Text style={styles.actionButtonText}>
                            Взять в работу
                          </Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(appeal.assigned_to) ? (
                        appeal.author?.is_deleted ? (
                          <>
                            <Text style={styles.lockedText}>
                              Участник удалён — ответ в приложении он не
                              увидит. Свяжитесь по телефону из сообщения.
                            </Text>

                            <View style={styles.actionRow}>
                              <TouchableOpacity
                                style={[
                                  styles.dangerAction,
                                  closingAppealId === appeal.id &&
                                    styles.actionDisabled,
                                ]}
                                disabled={closingAppealId === appeal.id}
                                onPress={() => handleCloseAppeal(appeal.id)}
                              >
                                <Text style={styles.actionButtonText}>
                                  {closingAppealId === appeal.id
                                    ? "Закрытие..."
                                    : "Закрыть"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <>
                            <TextInput
                              style={styles.replyInput}
                              value={draft}
                              onChangeText={(text) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [appeal.id]: text,
                                }))
                              }
                              placeholder="Написать ответ участнику..."
                              placeholderTextColor="#8FA79A"
                              multiline
                              textAlignVertical="top"
                            />

                            <View style={styles.actionRow}>
                              <TouchableOpacity
                                style={[
                                  styles.primaryAction,
                                  replyDisabled && styles.actionDisabled,
                                ]}
                                disabled={replyDisabled}
                                onPress={() =>
                                  handleSendAppealReply(appeal.id)
                                }
                              >
                                <Text style={styles.actionButtonText}>
                                  {sendingReplyId === appeal.id
                                    ? "Отправка..."
                                    : "Ответить"}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  styles.dangerAction,
                                  closingAppealId === appeal.id &&
                                    styles.actionDisabled,
                                ]}
                                disabled={closingAppealId === appeal.id}
                                onPress={() => handleCloseAppeal(appeal.id)}
                              >
                                <Text style={styles.actionButtonText}>
                                  {closingAppealId === appeal.id
                                    ? "Закрытие..."
                                    : "Закрыть"}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )
                      ) : (
                        <Text style={styles.lockedText}>
                          Обращение уже взято в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === "blocked" &&
              (() => {
                const user = item.raw;
                return (
                  <>
                    <Text style={styles.mutedText}>
                      {user.email || "Без email"}
                    </Text>
                    <Text style={styles.text}>
                      {user.city || "—"}, {user.country || "—"}
                    </Text>

                    <TouchableOpacity
                      style={styles.primaryActionFull}
                      onPress={() => handleUnblockUser(user)}
                    >
                      <Text style={styles.actionButtonText}>
                        Снять блокировку
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.backLinkText}>← Назад</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleNotices}
            activeOpacity={0.85}
            disabled={savingNotices}
            style={[
              styles.noticeSwitch,
              !noticesEnabled && styles.noticeSwitchOff,
            ]}
          >
            <Text
              style={[
                styles.noticeSwitchText,
                !noticesEnabled && styles.noticeSwitchTextOff,
              ]}
            >
              {noticesEnabled ? "Уведомления вкл." : "Выходной"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Модерация</Text>
        <Tekmet style={styles.tekmet} />

        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "new" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("new")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "new" && styles.tabButtonTextActive,
              ]}
            >
              Новое
            </Text>

            {queueCounts.new > 0 && (
              <View
                style={[
                  styles.tabCount,
                  activeTab === "new" && styles.tabCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    activeTab === "new" && styles.tabCountTextActive,
                  ]}
                >
                  {queueCounts.new}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "in_progress" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("in_progress")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "in_progress" && styles.tabButtonTextActive,
              ]}
            >
              В работе
            </Text>

            {queueCounts.in_progress > 0 && (
              <View
                style={[
                  styles.tabCount,
                  activeTab === "in_progress" && styles.tabCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    activeTab === "in_progress" && styles.tabCountTextActive,
                  ]}
                >
                  {queueCounts.in_progress}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "needs_revision" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("needs_revision")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "needs_revision" && styles.tabButtonTextActive,
              ]}
            >
              На доработке
            </Text>

            {queueCounts.needs_revision > 0 && (
              <View
                style={[
                  styles.tabCount,
                  activeTab === "needs_revision" && styles.tabCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    activeTab === "needs_revision" && styles.tabCountTextActive,
                  ]}
                >
                  {queueCounts.needs_revision}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "done" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("done")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "done" && styles.tabButtonTextActive,
              ]}
            >
              Завершено
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "new" && (
          <View style={styles.kindsRow}>
            {NEW_KINDS.map((kind) => {
              const count =
                kind.key === "all"
                  ? newKindCounts.all || 0
                  : newKindCounts[kind.key] || 0;

              if (kind.key !== "all" && count === 0) return null;

              const isActive = kindFilter === kind.key;

              return (
                <TouchableOpacity
                  key={kind.key}
                  activeOpacity={0.85}
                  onPress={() => setKindFilter(kind.key)}
                  style={[
                    styles.subTabButton,
                    isActive && styles.subTabButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.subTabButtonText,
                      isActive && styles.subTabButtonTextActive,
                    ]}
                  >
                    {kind.label} {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {canSwitchOwnership &&
          (activeTab === "in_progress" ||
            activeTab === "needs_revision" ||
            activeTab === "done") && (
            <View style={styles.subTabsRow}>
              <TouchableOpacity
                style={[
                  styles.subTabButton,
                  ownershipFilter === "all" && styles.subTabButtonActive,
                ]}
                onPress={() => setOwnershipFilter("all")}
              >
                <Text
                  style={[
                    styles.subTabButtonText,
                    ownershipFilter === "all" && styles.subTabButtonTextActive,
                  ]}
                >
                  Все
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subTabButton,
                  ownershipFilter === "mine" && styles.subTabButtonActive,
                ]}
                onPress={() => setOwnershipFilter("mine")}
              >
                <Text
                  style={[
                    styles.subTabButtonText,
                    ownershipFilter === "mine" && styles.subTabButtonTextActive,
                  ]}
                >
                  Мои
                </Text>
              </TouchableOpacity>
            </View>
          )}
        <ScrollView contentContainerStyle={styles.container}>
          {unifiedItems.length === 0 ? (
            <Text style={styles.emptyText}>Список пуст</Text>
          ) : (
            unifiedItems.map(renderUnifiedCard)
          )}
        </ScrollView>
      </View>

      <Modal
        visible={!!actionModal}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{actionModal?.title}</Text>

            <TextInput
              style={styles.modalInput}
              value={actionComment}
              onChangeText={setActionComment}
              placeholder={actionModal?.placeholder}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeActionModal}
                disabled={submittingAction}
              >
                <Text style={styles.modalCancelButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={submitActionModal}
                disabled={submittingAction}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {submittingAction
                    ? "Сохранение..."
                    : actionModal?.confirmText || "Сохранить"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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

  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },

  noticeSwitch: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: "rgba(105,183,141,0.55)",
    backgroundColor: "rgba(105,183,141,0.12)",
  },

  noticeSwitchOff: {
    borderColor: "rgba(192,91,77,0.45)",
    backgroundColor: "rgba(192,91,77,0.08)",
  },

  noticeSwitchText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  noticeSwitchTextOff: {
    color: "#C05B4D",
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 30,
    color: "#3F6B5B",
    textAlign: "center",
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },

  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  tabButton: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 999,
    paddingHorizontal: 15,
    marginRight: 8,
    marginBottom: 8,
  },

  tabButtonActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(255,255,255,0.85)",
  },

  tabButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: "#3F6B5B",
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  tabButtonTextActive: {
    color: "#FFFFFF",
  },

  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    marginLeft: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(105,183,141,0.16)",
  },

  tabCountActive: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  tabCountText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  tabCountTextActive: {
    color: "#FFFFFF",
  },

  kindsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },

  subTabsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },

  subTabButton: {
    // Жёсткая высота: иначе дробный абрис округляется по-разному
    // и текст в соседних кнопках прыгает на пиксель
    height: 34,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
    borderRadius: 999,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },

  subTabButtonActive: {
    backgroundColor: "rgba(105,183,141,0.12)",
    borderColor: "rgba(105,183,141,0.55)",
  },

  subTabButtonText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "600",
    color: "#7E988B",
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  subTabButtonTextActive: {
    color: "#3F6B5B",
  },

  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
    flexGrow: 1,
  },

  emptyText: {
    color: "#7E988B",
    fontSize: 14.5,
    marginTop: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardHeaderMain: {
    flex: 1,
    paddingRight: 10,
  },

  cardCollapsedHint: {
    marginTop: 4,
    fontSize: 12,
    color: "#8FA79A",
  },

  // Полоса состояния: цвет сразу говорит, насколько заявка горит
  statusLine: {
    marginBottom: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
  },

  statusLineNormal: {
    backgroundColor: "rgba(105,183,141,0.10)",
    borderLeftColor: "#69B78D",
  },

  statusLineWarning: {
    backgroundColor: "rgba(224,163,62,0.12)",
    borderLeftColor: "#E0A33E",
  },

  statusLineCritical: {
    backgroundColor: "rgba(192,91,77,0.10)",
    borderLeftColor: "#C05B4D",
  },

  statusLineText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(105,183,141,0.12)",
    borderWidth: 1,
    borderColor: "rgba(105,183,141,0.55)",
  },

  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#3F6B5B",
  },

  archiveChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },

  archiveChipText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },

  archiveChipApproved: {
    backgroundColor: "rgba(105,183,141,0.12)",
    borderColor: "rgba(105,183,141,0.55)",
  },

  archiveChipApprovedText: {
    color: "#3F6B5B",
  },

  archiveChipRejected: {
    backgroundColor: "rgba(192,91,77,0.08)",
    borderColor: "rgba(192,91,77,0.45)",
  },

  archiveChipRejectedText: {
    color: "#C05B4D",
  },

  archiveChipNeutral: {
    backgroundColor: "rgba(93,140,120,0.08)",
    borderColor: "rgba(93,140,120,0.35)",
  },

  archiveChipNeutralText: {
    color: "#7E988B",
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#3F6B5B",
    marginBottom: 4,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#C05B4D",
    marginLeft: 8,
    marginTop: 6,
  },

  mutedText: {
    fontSize: 12.5,
    color: "#8FA79A",
    marginTop: 2,
  },

  infoBlock: {
    marginTop: 8,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(93,140,120,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 10,
    marginBottom: 8,
  },

  personRowAccent: {
    backgroundColor: "rgba(192,91,77,0.06)",
    borderColor: "rgba(192,91,77,0.35)",
  },

  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    backgroundColor: "#EAF4EE",
  },

  personInfo: {
    flex: 1,
    minWidth: 0,
  },

  personLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginBottom: 2,
  },

  personLabelAccent: {
    color: "#C05B4D",
  },

  personName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2F4A3C",
  },

  personArrow: {
    fontSize: 22,
    color: "#A8BDB1",
    marginLeft: 8,
  },

  reasonLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginTop: 10,
    marginBottom: 4,
  },

  messageBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(105,183,141,0.07)",
    borderWidth: 0.75,
    borderColor: "rgba(105,183,141,0.28)",
  },

  messageLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginBottom: 8,
  },

  messageItem: {
    marginBottom: 10,
  },

  messageMeta: {
    fontSize: 11.5,
    color: "#8FA79A",
    marginBottom: 2,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#2F4A3C",
  },

  assignmentBlock: {
    marginTop: 12,
  },

  takeAction: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
  },

  primaryActionFull: {
    marginTop: 14,
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
  },

  secondaryActionFull: {
    marginTop: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
  },

  secondaryActionFullText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  primaryAction: {
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },

  warningAction: {
    backgroundColor: "#E0A33E",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },

  dangerAction: {
    backgroundColor: "#C05B4D",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },

  actionGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  lockedText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: "#8FA79A",
  },

  replyInput: {
    minHeight: 84,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#FFFFFF",
    fontSize: 14.5,
    color: "#2F4A3C",
    textAlignVertical: "top",
  },

  actionDisabled: {
    opacity: 0.6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(31,58,47,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#3F6B5B",
    marginBottom: 14,
  },

  modalInput: {
    minHeight: 110,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#2F4A3C",
    textAlignVertical: "top",
  },

  modalButtonsRow: {
    flexDirection: "row",
    marginTop: 16,
  },

  modalCancelButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
    marginRight: 8,
  },

  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  modalConfirmButton: {
    flex: 1,
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
  },

  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
