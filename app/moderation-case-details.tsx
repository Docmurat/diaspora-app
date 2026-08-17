// Экран «Изучить» — подробности завершённого дела модерации.
// Веха 50: переведён на дизайн-систему «Минги-Тау» (был на старых
// серых стилях) и научен обращениям (kind === "appeal").
// Alert больше не используется — на вебе он не работает (капкан
// Вехи 14): ошибки показываются экранным состоянием с кнопкой назад.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { formatPhone } from "../services/contactsService";

type CaseKind =
  | "registration"
  | "invite_request"
  | "name_change"
  | "complaint"
  | "appeal"
  | "blocked";

type MessageItem = {
  id: string;
  author_role: "user" | "moderator" | "system";
  message: string;
  created_at?: string | null;
};

export default function ModerationCaseDetailsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    kind?: string;
    entityId?: string;
  }>();

  const kind = String(params.kind || "") as CaseKind;
  const entityId = String(params.entityId || "");

  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [record, setRecord] = useState<any>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  // Автор обращения (подгружается отдельной строкой из users).
  const [appealAuthor, setAppealAuthor] = useState<any>(null);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (
    createdAt?: string | null,
    completedAt?: string | null,
  ) => {
    if (!createdAt || !completedAt) return "—";

    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return "—";
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

  const loadMessages = async (requestType: string, requestId: string) => {
    const { data, error } = await supabase
      .from("moderation_messages")
      .select("*")
      .eq("request_type", requestType)
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []) as MessageItem[];
  };

  const loadRegistration = async () => {
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        *,
        users_private (phone),
        invited_by:invited_by_user_id (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages("invite_request", entityId).catch(
      () => [],
    );

    // Телефон — из users_private (Веха 62), пришиваем на место.
    setRecord({
      ...(data as any),
      phone: (data as any)?.users_private?.phone ?? null,
    });
    setMessages(history);
  };

  const loadInviteRequest = async () => {
    const { data, error } = await supabase
      .from("invite_requests")
      .select("*")
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages("invite_request", entityId).catch(
      () => [],
    );

    setRecord(data);
    setMessages(history);
  };

  const loadNameChange = async () => {
    const { data, error } = await supabase
      .from("name_change_requests")
      .select("*")
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages("name_change_request", entityId).catch(
      () => [],
    );

    setRecord(data);
    setMessages(history);
  };

  const loadComplaint = async () => {
    const { data, error } = await supabase
      .from("complaints")
      .select(
        `
        *,
        reporter:reporter_user_id (
          id,
          first_name,
          last_name,
          email
        ),
        target:target_user_id (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    setRecord(data);
    setMessages([]);
  };

  // Обращение (Веха 50): сама запись + автор отдельной строкой +
  // переписка из общего дневника moderation_messages.
  const loadAppeal = async () => {
    const { data, error } = await supabase
      .from("appeals")
      .select("*")
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    setRecord(data);

    // Автор: не роняем экран, если анкета скрыта правилами базы
    // (вычищен чистильщиком или отключён) — просто без карточки автора.
    if (data?.user_id) {
      try {
        const { data: author } = await supabase
          .from("users")
          .select("id, first_name, last_name, email, is_deleted")
          .eq("id", data.user_id)
          .maybeSingle();
        setAppealAuthor(author || null);
      } catch {
        setAppealAuthor(null);
      }
    }

    const history = await loadMessages("appeal", entityId).catch(() => []);
    setMessages(history);
  };

  const loadBlockedCase = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*, users_private(phone)")
      .eq("id", entityId)
      .single();

    if (error) throw new Error(error.message);

    // Телефон — из users_private (Веха 62), пришиваем на место.
    setRecord({
      ...(data as any),
      phone: (data as any)?.users_private?.phone ?? null,
    });
    setMessages([]);
  };

  const loadCase = useCallback(async () => {
    try {
      setLoading(true);
      setScreenError("");

      if (!kind || !entityId) {
        throw new Error("Не переданы параметры дела");
      }

      if (kind === "registration") {
        await loadRegistration();
      } else if (kind === "invite_request") {
        await loadInviteRequest();
      } else if (kind === "name_change") {
        await loadNameChange();
      } else if (kind === "complaint") {
        await loadComplaint();
      } else if (kind === "appeal") {
        await loadAppeal();
      } else if (kind === "blocked") {
        await loadBlockedCase();
      } else {
        throw new Error("Неизвестный тип дела");
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось загрузить дело";
      setScreenError(message);
    } finally {
      setLoading(false);
    }
  }, [kind, entityId]);

  useFocusEffect(
    useCallback(() => {
      loadCase();
    }, [loadCase]),
  );

  const headerTitle = useMemo(() => {
    if (kind === "registration") return "Регистрация";
    if (kind === "invite_request") return "Заявка на инвайт";
    if (kind === "name_change") return "Смена ФИО";
    if (kind === "complaint") return "Жалоба";
    if (kind === "appeal") return "Обращение";
    if (kind === "blocked") return "Блокировка";
    return "Дело";
  }, [kind]);

  const statusLabel = useMemo(() => {
    if (!record) return "—";

    if (kind === "registration") {
      if (record.moderation_status === "approved") return "Одобрено";
      if (record.moderation_status === "rejected") return "Отклонено";
      if (record.moderation_status === "needs_revision") return "На доработке";
      return record.moderation_status || "—";
    }

    if (kind === "invite_request" || kind === "name_change") {
      if (record.status === "approved") return "Одобрено";
      if (record.status === "rejected") return "Отклонено";
      return record.status || "—";
    }

    if (kind === "complaint") {
      if (record.status === "resolved") return "Принято";
      if (record.status === "rejected") return "Отклонено";
      return record.status || "—";
    }

    if (kind === "appeal") {
      return record.status === "closed" ? "Закрыто" : "Открыто";
    }

    if (kind === "blocked") {
      return record.is_blocked ? "Заблокирован" : "Разблокирован";
    }

    return "—";
  }, [kind, record]);

  // Тон ярлыка статуса: зелёный / красный / нейтральный.
  const statusTone = useMemo(() => {
    if (["Одобрено", "Принято", "Разблокирован"].includes(statusLabel)) {
      return "good";
    }
    if (["Отклонено", "Заблокирован"].includes(statusLabel)) {
      return "bad";
    }
    return "neutral";
  }, [statusLabel]);

  const resolutionDuration = useMemo(() => {
    if (!record) return "—";

    if (kind === "registration") {
      return formatDuration(record.created_at, record.moderation_completed_at);
    }

    if (kind === "invite_request") {
      return formatDuration(record.created_at, record.final_decision_at);
    }

    if (kind === "name_change" || kind === "complaint") {
      return formatDuration(record.created_at, record.reviewed_at);
    }

    if (kind === "appeal") {
      return formatDuration(record.created_at, record.closed_at);
    }

    return "—";
  }, [kind, record]);

  const moderatorName = useMemo(() => {
    if (!record) return "—";

    if (kind === "registration") {
      return record.moderation_completed_by_name || "—";
    }

    if (
      kind === "invite_request" ||
      kind === "name_change" ||
      kind === "complaint"
    ) {
      return record.completed_by_name || "—";
    }

    if (kind === "appeal") {
      return record.closed_by_name || "—";
    }

    return "—";
  }, [kind, record]);

  const moderatorNote = useMemo(() => {
    if (!record) return "";

    if (kind === "registration") {
      return record.moderation_note || "";
    }

    if (
      kind === "invite_request" ||
      kind === "name_change" ||
      kind === "complaint" ||
      kind === "appeal"
    ) {
      return record.review_note || "";
    }

    return "";
  }, [kind, record]);

  // Строка «подпись — значение» в стиле карточек модерации.
  const InfoRow = ({ label, value }: { label: string; value?: any }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>
        {value === null || value === undefined || value === "" ? "—" : value}
      </Text>
    </View>
  );

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

  if (screenError || !record) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Дело не открылось</Text>
        <Text style={styles.errorText}>
          {screenError || "Запись не найдена"}
        </Text>

        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.errorButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.headerSubtitle}>подробности дела</Text>
        </View>

        <View
          style={[
            styles.statusChip,
            statusTone === "good" && styles.statusChipGood,
            statusTone === "bad" && styles.statusChipBad,
          ]}
        >
          <Text
            style={[
              styles.statusChipText,
              statusTone === "good" && styles.statusChipTextGood,
              statusTone === "bad" && styles.statusChipTextBad,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>ИТОГ</Text>
          <InfoRow label="Обработал" value={moderatorName} />
          <InfoRow
            label="От создания до завершения"
            value={resolutionDuration}
          />

          {!!moderatorNote && (
            <>
              <Text style={styles.reasonLabel}>КОММЕНТАРИЙ МОДЕРАТОРА</Text>
              <Text style={styles.text}>{moderatorNote}</Text>
            </>
          )}
        </View>

        {kind === "registration" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>АНКЕТА</Text>
            <InfoRow
              label="Имя"
              value={`${record.first_name || ""} ${record.last_name || ""}`.trim()}
            />
            <InfoRow label="Телефон" value={formatPhone(record.phone)} />
            <InfoRow label="Email" value={record.email} />
            <InfoRow label="Категория" value={record.category} />
            <InfoRow label="Профессия" value={record.profession} />
            <InfoRow label="Город" value={record.city} />
            <InfoRow label="Страна" value={record.country} />
            <InfoRow label="Telegram" value={record.telegram} />
            <InfoRow label="Instagram" value={record.instagram} />

            {!!record.invited_by && (
              <InfoRow
                label="Пригласил"
                value={
                  `${record.invited_by.first_name || ""} ${record.invited_by.last_name || ""}`.trim() ||
                  record.invited_by.email
                }
              />
            )}

            <TouchableOpacity
              style={styles.primaryAction}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: "/user-profile",
                  params: { id: record.id },
                })
              }
            >
              <Text style={styles.primaryActionText}>Открыть профиль</Text>
            </TouchableOpacity>
          </View>
        )}

        {kind === "invite_request" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ЗАЯВКА</Text>
            <InfoRow label="Имя" value={record.full_name} />
            <InfoRow label="Телефон" value={record.phone} />
            <InfoRow label="Telegram" value={record.telegram} />
            {!!record.about && (
              <>
                <Text style={styles.reasonLabel}>О СЕБЕ</Text>
                <Text style={styles.text}>{record.about}</Text>
              </>
            )}
            <InfoRow
              label="Создано"
              value={formatDateTime(record.created_at)}
            />
            <InfoRow
              label="Завершено"
              value={formatDateTime(record.final_decision_at)}
            />
          </View>
        )}

        {kind === "name_change" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>СМЕНА ФИО</Text>
            <InfoRow
              label="Текущее имя"
              value={`${record.current_first_name || "—"} ${record.current_last_name || ""}`.trim()}
            />
            <InfoRow
              label="Новое имя"
              value={`${record.requested_first_name || "—"} ${record.requested_last_name || ""}`.trim()}
            />
            <Text style={styles.reasonLabel}>ПРИЧИНА</Text>
            <Text style={styles.text}>{record.reason || "—"}</Text>
            <InfoRow
              label="Создано"
              value={formatDateTime(record.created_at)}
            />
            <InfoRow
              label="Завершено"
              value={formatDateTime(record.reviewed_at)}
            />
          </View>
        )}

        {kind === "complaint" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ЖАЛОБА</Text>
            <InfoRow
              label="От"
              value={`${record.reporter?.first_name || ""} ${record.reporter?.last_name || ""}`.trim()}
            />
            <InfoRow
              label="На"
              value={`${record.target?.first_name || ""} ${record.target?.last_name || ""}`.trim()}
            />
            <Text style={styles.reasonLabel}>ПРИЧИНА</Text>
            <Text style={styles.text}>{record.reason || "—"}</Text>
            <InfoRow
              label="Создано"
              value={formatDateTime(record.created_at)}
            />
            <InfoRow
              label="Завершено"
              value={formatDateTime(record.reviewed_at)}
            />
          </View>
        )}

        {kind === "appeal" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ОБРАЩЕНИЕ</Text>
            <InfoRow
              label="Автор"
              value={
                appealAuthor
                  ? `${appealAuthor.first_name || ""} ${appealAuthor.last_name || ""}`.trim() ||
                    appealAuthor.email ||
                    "Удалённый участник"
                  : "Удалённый участник"
              }
            />
            {!!appealAuthor?.email && (
              <InfoRow label="Email" value={appealAuthor.email} />
            )}
            <InfoRow
              label="Создано"
              value={formatDateTime(record.created_at)}
            />
            <InfoRow label="Взято" value={formatDateTime(record.taken_at)} />
            <InfoRow label="Закрыто" value={formatDateTime(record.closed_at)} />
          </View>
        )}

        {kind === "blocked" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>УЧАСТНИК</Text>
            <InfoRow
              label="Имя"
              value={`${record.first_name || ""} ${record.last_name || ""}`.trim()}
            />
            <InfoRow label="Email" value={record.email} />
            <InfoRow label="Телефон" value={formatPhone(record.phone)} />
            <InfoRow label="Город" value={record.city} />
            <InfoRow label="Страна" value={record.country} />
            <InfoRow
              label="Обновлено"
              value={formatDateTime(record.updated_at)}
            />
          </View>
        )}

        {messages.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>ИСТОРИЯ ПЕРЕПИСКИ</Text>

            {messages.map((msg) => (
              <View key={msg.id} style={styles.messageItem}>
                <Text style={styles.messageMeta}>
                  {msg.author_role === "user"
                    ? "Участник"
                    : msg.author_role === "moderator"
                      ? "Модератор"
                      : "Система"}
                  {msg.created_at ? ` • ${formatDateTime(msg.created_at)}` : ""}
                </Text>
                <Text style={styles.messageText}>{msg.message}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.secondaryAction}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryActionText}>Назад</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
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

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
  },

  errorTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 22,
    color: "#3F6B5B",
    marginBottom: 10,
    textAlign: "center",
  },

  errorText: {
    fontSize: 14.5,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },

  errorButton: {
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  errorButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.28)",
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  backButtonText: {
    fontSize: 22,
    color: "#3F6B5B",
    fontWeight: "600",
  },

  headerInfo: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 20,
    color: "#3F6B5B",
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#8FA79A",
    marginTop: 2,
  },

  // Ярлык статуса в шапке: зелёный / красный / нейтральный.
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 8,
    backgroundColor: "rgba(93,140,120,0.08)",
    borderColor: "rgba(93,140,120,0.35)",
  },

  statusChipGood: {
    backgroundColor: "rgba(105,183,141,0.12)",
    borderColor: "rgba(105,183,141,0.55)",
  },

  statusChipBad: {
    backgroundColor: "rgba(192,91,77,0.08)",
    borderColor: "rgba(192,91,77,0.45)",
  },

  statusChipText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    color: "#7E988B",
  },

  statusChipTextGood: {
    color: "#3F6B5B",
  },

  statusChipTextBad: {
    color: "#C05B4D",
  },

  container: {
    padding: 16,
    paddingBottom: 40,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginBottom: 10,
  },

  infoRow: {
    marginBottom: 8,
  },

  infoLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginBottom: 2,
    textTransform: "uppercase",
  },

  infoValue: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  text: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  reasonLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    color: "#719686",
    marginTop: 10,
    marginBottom: 4,
  },

  messageItem: {
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: "rgba(93,140,120,0.18)",
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

  primaryAction: {
    marginTop: 14,
    backgroundColor: "rgba(105,183,141,0.92)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
  },

  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  secondaryAction: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    paddingVertical: 13,
    borderRadius: 18,
    alignItems: "center",
  },

  secondaryActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3F6B5B",
  },
});
