import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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

  const formValid = !!phone.trim() && !!message.trim();

  const handleSend = async () => {
    if (!phone.trim() || !message.trim()) {
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
      } else {
        const finalMessage = [
          `Телефон для связи: ${phone.trim()}`,
          "",
          message.trim(),
        ].join("\n");

        await sendAppealMessage(profile.id, finalMessage);
      }

      setSuccess(true);
      setMessage("");
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Не удалось отправить сообщение";
      setError(msg);
      Alert.alert("Ошибка", msg);
    } finally {
      setSending(false);
    }
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
                : "Напишите администрации — обращение попадёт к модераторам, ответ придёт уведомлением."}
          </Text>

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

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={(text) => {
                setMessage(text);
                setError("");
              }}
              placeholder="Опишите проблему или вопрос *"
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
