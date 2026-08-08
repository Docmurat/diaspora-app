import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Glass, MingiBackground, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { getMyProfile } from "../services/profileService";
import { signOutUser } from "../services/sessionService";

const glassCardProps = {
  radius: 18,
  tintColor: "rgba(255,255,255,0.55)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.85)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function PendingApprovalScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [sendingAgain, setSendingAgain] = useState(false);
  const [resubmitMessage, setResubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const myProfile = await getMyProfile();
      setProfile(myProfile);

      if (!myProfile?.id) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from("moderation_messages")
        .select("*")
        .eq("request_type", "invite_request")
        .eq("request_id", myProfile.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setMessages(data || []);
    } catch (e) {
      console.log("Ошибка загрузки pending approval:", e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Стоп-кран: после первого перехода внутрь приложения все проверки
  // этого экрана глохнут. Без него таймер продолжал гонять человека
  // по кругу «заставка — главный экран — заставка».
  const redirectedRef = useRef(false);

  const goInside = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace("/splash");
  };

  // Живое обновление: решение модератора и его сообщения прилетают сами
  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !alive) return;

      channel = supabase
        // Имя канала уникальное на каждый заход на экран (капкан Вехи 29):
        // со статичным именем повторный вход ронял приложение.
        .channel(`pending-approval-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const fresh = payload.new as any;

            if (fresh?.moderation_status === "approved") {
              goInside();
              return;
            }

            loadData(true);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "moderation_messages",
            filter: `request_id=eq.${user.id}`,
          },
          () => {
            loadData(true);
          },
        )
        .subscribe();
    };

    subscribe();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Текущий статус анкеты (для сравнения в автопроверке)
  const statusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    statusRef.current = (profile as any)?.moderation_status;
  }, [profile]);

  // Автопроверка: экран сам замечает решение модератора без повторного входа
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        if (redirectedRef.current) {
          clearInterval(interval);
          return;
        }

        const fresh = await getMyProfile();
        if (!fresh) return;

        if (fresh.moderation_status === "approved") {
          clearInterval(interval);
          goInside();
          return;
        }

        if (fresh.moderation_status !== statusRef.current) {
          await loadData(true);
        }
      } catch (e) {
        console.log("Ошибка автопроверки статуса:", e);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [loadData]);

  const isNeedsRevision =
    (profile as any)?.moderation_status === "needs_revision";
  const isRejected = (profile as any)?.moderation_status === "rejected";

  const moderatorMessages = messages.filter(
    (msg) => msg.author_role === "moderator" || msg.author_role === "system",
  );

  const lastModeratorMessage =
    moderatorMessages.length > 0
      ? moderatorMessages[moderatorMessages.length - 1]
      : null;

  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;

  // Повторная отправка видна по серверному флажку изменений (он взводится
  // при отправке и гаснет, когда модератор открывает карточку). Раньше
  // экран смотрел только на последнее сообщение — при отправке без
  // сопроводительного текста он «не замечал» отправку.
  const hasUserResubmittedAfterRevision =
    isNeedsRevision &&
    ((profile as any)?.moderator_has_unread_changes === true ||
      lastMessage?.author_role === "user");

  const showRevisionActions =
    isNeedsRevision && !hasUserResubmittedAfterRevision;

  const handleSubmitAgain = async () => {
    if (!profile?.id) {
      setSubmitError("Профиль не найден");
      return;
    }

    try {
      setSendingAgain(true);
      setSubmitError("");

      // После доработки заявка остаётся закреплённой за своим модератором
      // (статус не меняется). После отклонения — подаётся заново: статус
      // «pending», карточка возвращается в «Новое» неназначенной, а
      // модераторам сам приходит триггер «Новая заявка на вступление».
      const updatePayload = isRejected
        ? {
            moderation_status: "pending",
            moderator_has_unread_changes: false,
            moderation_completed_by_name: null,
            moderation_completed_by: null,
            moderation_completed_at: null,
            moderation_assigned_to: null,
            moderation_assigned_name: null,
            moderation_taken_at: null,
            updated_at: new Date().toISOString(),
          }
        : {
            moderation_status: "needs_revision",
            moderator_has_unread_changes: true,
            updated_at: new Date().toISOString(),
          };

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const covering = resubmitMessage.trim();

      // След в хронологии остаётся всегда: либо сопроводительный текст
      // участника, либо автотекст — чтобы модератор, вернувшись в
      // карточку позже, видел, что произошло.
      const trailText =
        covering ||
        (isRejected
          ? "Заявка подана повторно после отклонения."
          : "Анкета отправлена повторно после исправлений.");

      {
        const { error: messageError } = await supabase
          .from("moderation_messages")
          .insert({
            request_type: "invite_request",
            request_id: profile.id, // ВАЖНОЕ 1
            author_user_id: profile.id,
            author_role: "user",
            message: trailText,
            read_by_user: true,
            read_by_moderator: false,
          });

        if (messageError) {
          throw new Error(messageError.message);
        }
      }

      setResubmitMessage("");
      // Экран сам переключится на «На рассмотрении»: loadData обновит
      // профиль, и серверный флажок изменений покажет отправку.
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отправить анкету повторно";
      setSubmitError(message);
    } finally {
      setSendingAgain(false);
    }
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  return (
    <MingiBackground idPrefix="pa">
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {isRejected
            ? "Анкета отклонена"
            : showRevisionActions
              ? "Нужна доработка"
              : "На рассмотрении"}
        </Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          {isRejected
            ? "Модератор отклонил вашу анкету. Ознакомьтесь с комментарием ниже. Вы можете исправить анкету и подать заявку повторно."
            : showRevisionActions
              ? "Исправьте данные, затем отправьте анкету на повторное рассмотрение."
              : hasUserResubmittedAfterRevision
                ? "Исправления отправлены модератору. Как только он проверит анкету, экран обновится сам."
                : "Спасибо за регистрацию. Сейчас ваша анкета проверяется модератором."}
        </Text>

        {!isRejected && !showRevisionActions && (
          <Text style={styles.autoHint}>
            Как только анкету одобрят, экран обновится сам
          </Text>
        )}

        {(showRevisionActions || isRejected) && lastModeratorMessage && (
          <Glass {...glassCardProps} style={styles.messageCard}>
            <View style={styles.messageInner}>
              <Text style={styles.messageAuthor}>
                {lastModeratorMessage.author_role === "moderator"
                  ? "СООБЩЕНИЕ МОДЕРАТОРА"
                  : "СИСТЕМНОЕ СООБЩЕНИЕ"}
              </Text>
              <Text style={styles.messageText}>
                {lastModeratorMessage.message}
              </Text>
            </View>
          </Glass>
        )}

        {showRevisionActions || isRejected ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/edit-profile")}
              style={styles.secondaryWrap}
            >
              <Glass
                radius={18}
                tintColor="rgba(255,255,255,0.5)"
                borderColor="rgba(93,140,120,0.45)"
                borderWidth={0.75}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.secondaryButtonText}>
                    Исправить анкету
                  </Text>
                </View>
              </Glass>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>
              Сообщение модератору (необязательно)
            </Text>

            <Glass {...glassInputProps} style={styles.inputWrap}>
              <TextInput
                style={styles.textArea}
                value={resubmitMessage}
                onChangeText={setResubmitMessage}
                placeholder={
                  isRejected
                    ? "Например: объясните, почему заявку стоит пересмотреть"
                    : "Например: исправил город и профессию"
                }
                placeholderTextColor="#8FA79A"
                multiline
                textAlignVertical="top"
              />
            </Glass>

            {!!submitError && (
              <Text style={styles.submitError}>{submitError}</Text>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmitAgain}
              disabled={sendingAgain}
              style={[styles.primaryShadow, sendingAgain && styles.disabled]}
            >
              <Glass
                radius={18}
                tintColor="rgba(105,183,141,0.92)"
                borderColor="rgba(255,255,255,0.85)"
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.primaryButtonText}>
                    {sendingAgain
                      ? "Отправка..."
                      : isRejected
                        ? "Подать заявку повторно"
                        : "Отправить повторно"}
                  </Text>
                </View>
              </Glass>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/contact-admin")}
            style={styles.primaryShadow}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  Связаться с администратором
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={async () => {
            await signOutUser();
            router.replace("/welcome");
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.link}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>
    </MingiBackground>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4FAF4",
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
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
    marginBottom: 18,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#4E7364",
    textAlign: "center",
    marginBottom: 8,
  },

  autoHint: {
    fontSize: 12.5,
    color: "#96AC9E",
    textAlign: "center",
    marginBottom: 16,
  },

  messageCard: {
    marginTop: 12,
    marginBottom: 16,
  },

  messageInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  messageAuthor: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 11.5,
    letterSpacing: 2,
    color: "#719686",
    marginBottom: 6,
  },

  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  secondaryWrap: {
    marginTop: 8,
    marginBottom: 16,
  },

  inputLabel: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 14,
    color: "#719686",
    marginBottom: 8,
    marginLeft: 4,
  },

  inputWrap: {
    marginBottom: 12,
  },

  textArea: {
    minHeight: 110,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: "#2F4A3C",
    textAlignVertical: "top",
  },

  primaryShadow: {
    marginTop: 8,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 16,
    fontWeight: "600",
  },

  link: {
    color: "#96AC9E",
    textAlign: "center",
    fontSize: 14,
    marginTop: 22,
    textDecorationLine: "underline",
  },

  submitError: {
    color: "#C05B4D",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },

  disabled: {
    opacity: 0.7,
  },
});
