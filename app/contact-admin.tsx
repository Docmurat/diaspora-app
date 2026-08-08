import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import { sendAppealMessage } from "../services/moderationService";
import { getMyProfile } from "../services/profileService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function ContactAdminScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [profile, setProfile] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  // Открытое обращение обычного участника: если оно есть, экран
  // показывает переписку и дописывает сообщения в ту же карточку.
  const [appealId, setAppealId] = useState<string | null>(null);
  const [appealMessages, setAppealMessages] = useState<any[]>([]);
  const [threadReady, setThreadReady] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getMyProfile();
        setProfile(data);

        if (data?.phone) {
          setPhone(data.phone);
        }
      } catch (e) {
        console.log("Ошибка загрузки профиля:", e);
      }
    };

    loadProfile();
  }, []);

  // Новичок, чья анкета ещё в очереди: его сообщение прикрепляется к
  // заявке на вступление — модератор увидит его прямо в карточке.
  // Все остальные (одобренные и т.д.) пишут через «Обращения»:
  // у них карточки в очереди нет, и старый путь терял их сообщения.
  const isPendingApplicant =
    profile?.moderation_status === "pending" ||
    profile?.moderation_status === "needs_revision";

  // Удалённый не видит приложения (только экран «профиль удалён»),
  // колокольчика и уведомлений у него нет — обещаем связь по телефону.
  const isDeletedUser = !!profile?.is_deleted;

  // Переписка положена только обычному участнику (не новичку в очереди
  // и не удалённому) — у них свои режимы, их не трогаем.
  const isRegularUser = !!profile?.id && !isPendingApplicant && !isDeletedUser;

  // Ищем открытое обращение и, если оно есть, грузим переписку.
  const loadThread = useCallback(async () => {
    if (!isRegularUser) {
      setThreadReady(true);
      return;
    }

    try {
      const { data: appeal, error: appealError } = await supabase
        .from("appeals")
        .select("id")
        .eq("user_id", profile.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appealError) throw new Error(appealError.message);

      if (!appeal?.id) {
        setAppealId(null);
        setAppealMessages([]);
        return;
      }

      const { data: msgs, error: msgsError } = await supabase
        .from("moderation_messages")
        .select("*")
        .eq("request_type", "appeal")
        .eq("request_id", appeal.id)
        .order("created_at", { ascending: true });

      if (msgsError) throw new Error(msgsError.message);

      setAppealId(appeal.id);
      setAppealMessages(msgs || []);
    } catch (e) {
      // Если переписку загрузить не вышло — молча падаем в обычную
      // форму: отправка всё равно доклеит сообщение в открытую карточку.
      console.log("Ошибка загрузки обращения:", e);
      setAppealId(null);
      setAppealMessages([]);
    } finally {
      setThreadReady(true);
    }
  }, [isRegularUser, profile?.id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Живое обновление переписки: ответ модератора и закрытие обращения
  // прилетают сами. Имя канала уникальное на каждый заход (капкан Вехи 29).
  useEffect(() => {
    if (!appealId) return;

    const channel = supabase
      .channel(`contact-admin-${appealId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moderation_messages",
          filter: `request_id=eq.${appealId}`,
        },
        () => {
          loadThread();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appeals",
          filter: `id=eq.${appealId}`,
        },
        (payload) => {
          const fresh = payload.new as any;
          if (fresh?.status === "closed") {
            // Обращение закрыли — возвращаем обычную форму.
            setAppealId(null);
            setAppealMessages([]);
          } else {
            loadThread();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appealId, loadThread]);

  // Показ переписки: автопрокрутка к последнему сообщению.
  useEffect(() => {
    if (appealMessages.length === 0) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);

    return () => clearTimeout(timer);
  }, [appealMessages.length]);

  const hasOpenThread = isRegularUser && !!appealId;

  // В режиме переписки телефон уже был отправлен с первым сообщением —
  // второй раз его не требуем.
  const formValid = hasOpenThread
    ? !!message.trim()
    : !!phone.trim() && !!message.trim();

  const handleSend = async () => {
    if (!formValid) {
      setError("Заполните все поля");
      return;
    }

    if (!profile?.id) {
      setError("Не удалось определить пользователя");
      return;
    }

    try {
      setSending(true);
      setError("");

      if (isPendingApplicant) {
        const finalMessage = [
          "Сообщение от пользователя в режиме ожидания.",
          `Телефон для связи: ${phone.trim()}`,
          "",
          message.trim(),
        ].join("\n");

        const { error: insertError } = await supabase
          .from("moderation_messages")
          .insert({
            request_type: "invite_request",
            request_id: profile.id, // ВАЖНОЕ 1: временно используем userId вместо invite_requests.id
            author_user_id: profile.id,
            author_role: "user",
            message: finalMessage,
            read_by_user: true,
            read_by_moderator: false,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        const { error: updateError } = await supabase
          .from("users")
          .update({
            moderator_has_unread_changes: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        setSuccess(true);
        setMessage("");
        return;
      }

      if (hasOpenThread) {
        // Продолжение открытой переписки: телефон не дублируем,
        // сообщение доклеится в ту же карточку.
        await sendAppealMessage(profile.id, message.trim());
        setMessage("");
        await loadThread();
        return;
      }

      const finalMessage = [
        `Телефон для связи: ${phone.trim()}`,
        "",
        message.trim(),
      ].join("\n");

      await sendAppealMessage(profile.id, finalMessage);

      setSuccess(true);
      setMessage("");
      // Обращение теперь существует — при возврате на экран
      // человек увидит переписку.
      loadThread();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось отправить сообщение";
      setError(msg);
      Alert.alert("Ошибка", msg);
    } finally {
      setSending(false);
    }
  };

  const formatMessageDate = (dateString?: string | null) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (success) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <View style={styles.successContent}>
          <Text style={styles.title}>Отправлено</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.text}>
            {isPendingApplicant
              ? "Ваше сообщение передано администратору. Ожидайте ответа — оно появится на экране ожидания."
              : isDeletedUser
                ? "Ваше обращение передано администрации. Модератор свяжется с вами по указанному телефону."
                : "Ваше обращение передано администрации. Ответ придёт уведомлением — следите за колокольчиком вверху экрана."}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.primaryShadow}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>Вернуться</Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Обратная связь</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.text}>
            {isPendingApplicant
              ? "Напишите администратору — сообщение попадёт к модерации вместе с вашей анкетой."
              : isDeletedUser
                ? "Напишите администрации — модератор свяжется с вами по указанному телефону."
                : hasOpenThread
                  ? "У вас есть открытое обращение — переписка ниже. Новое сообщение добавится в него же."
                  : "Напишите администрации — обращение попадёт к модераторам, ответ придёт уведомлением."}
          </Text>

          {hasOpenThread && (
            <View style={styles.threadWrap}>
              {appealMessages.map((msg) => {
                const isMine = msg.author_role === "user";

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.bubbleRow,
                      isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isMine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      <Text style={styles.bubbleAuthor}>
                        {isMine ? "Вы" : "Администрация"}
                        {"  ·  "}
                        {formatMessageDate(msg.created_at)}
                      </Text>
                      <Text style={styles.bubbleText}>{msg.message}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!hasOpenThread && threadReady && (
            <>
              <Glass {...glassInputProps} style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    setError("");
                  }}
                  placeholder="Телефон для связи *"
                  placeholderTextColor="#8FA79A"
                  keyboardType="phone-pad"
                />
              </Glass>

              <Text style={styles.hint}>
                По умолчанию подставлен номер из анкеты — его можно изменить
              </Text>
            </>
          )}

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={(text) => {
                setMessage(text);
                setError("");
              }}
              placeholder={
                hasOpenThread
                  ? "Ваше сообщение *"
                  : "Опишите проблему или вопрос *"
              }
              placeholderTextColor="#8FA79A"
              multiline
              textAlignVertical="top"
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={sending || !formValid}
            style={[
              styles.primaryShadow,
              (sending || !formValid) && styles.disabled,
            ]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {sending ? "Отправка..." : "Отправить"}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.link}>Назад</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardWrap: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  successContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
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
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 20,
  },

  threadWrap: {
    marginBottom: 16,
  },

  bubbleRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  bubbleRowMine: {
    justifyContent: "flex-end",
  },

  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },

  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 0.75,
  },

  bubbleMine: {
    backgroundColor: "rgba(105,183,141,0.16)",
    borderColor: "rgba(93,140,120,0.35)",
    borderBottomRightRadius: 6,
  },

  bubbleTheirs: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "rgba(93,140,120,0.45)",
    borderBottomLeftRadius: 6,
  },

  bubbleAuthor: {
    fontSize: 11.5,
    color: "#719686",
    marginBottom: 4,
  },

  bubbleText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  inputWrap: {
    marginBottom: 12,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  textArea: {
    height: 120,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },

  hint: {
    fontSize: 12.5,
    color: "#96AC9E",
    marginBottom: 12,
    marginLeft: 4,
  },

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
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

  link: {
    color: "#96AC9E",
    textAlign: "center",
    fontSize: 14,
    marginTop: 20,
    textDecorationLine: "underline",
  },

  disabled: {
    opacity: 0.7,
  },
});
