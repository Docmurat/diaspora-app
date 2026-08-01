import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
        .channel(`pending-approval-${user.id}`)
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
              router.replace("/splash");
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
        const fresh = await getMyProfile();
        if (!fresh) return;

        if (fresh.moderation_status === "approved") {
          router.replace("/splash");
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

  const hasUserResubmittedAfterRevision =
    isNeedsRevision && lastMessage?.author_role === "user";

  const showRevisionActions =
    isNeedsRevision && !hasUserResubmittedAfterRevision;

  const handleSubmitAgain = async () => {
    if (!profile?.id) {
      Alert.alert("Ошибка", "Профиль не найден");
      return;
    }

    try {
      setSendingAgain(true);

      const { error: updateError } = await supabase
        .from("users")
        .update({
          // Статус НЕ меняем: заявка остаётся в очереди «На доработке»
          // и закреплённой за своим модератором. Признак ниже говорит
          // модератору, что человек прислал исправления, — на нём же
          // висит уведомление.
          moderation_status: "needs_revision",
          moderator_has_unread_changes: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const covering = resubmitMessage.trim();

      if (covering) {
        const { error: messageError } = await supabase
          .from("moderation_messages")
          .insert({
            request_type: "invite_request",
            request_id: profile.id, // ВАЖНОЕ 1
            author_user_id: profile.id,
            author_role: "user",
            message: covering,
            read_by_user: true,
            read_by_moderator: false,
          });

        if (messageError) {
          throw new Error(messageError.message);
        }
      }

      setResubmitMessage("");
      await loadData();

      Alert.alert(
        "Отправлено",
        "Анкета повторно отправлена модератору на рассмотрение.",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отправить анкету повторно";
      Alert.alert("Ошибка", message);
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
            ? "Модератор отклонил вашу анкету. Ознакомьтесь с комментарием ниже."
            : showRevisionActions
              ? "Исправьте данные, затем отправьте анкету на повторное рассмотрение."
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

        {showRevisionActions ? (
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
                placeholder="Например: исправил город и профессию"
                placeholderTextColor="#8FA79A"
                multiline
                textAlignVertical="top"
              />
            </Glass>

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
                    {sendingAgain ? "Отправка..." : "Отправить повторно"}
                  </Text>
                </View>
              </Glass>
            </TouchableOpacity>
          </>
        ) : !isRejected ? (
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
        ) : null}

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

  disabled: {
    opacity: 0.7,
  },
});
