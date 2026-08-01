import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { useState } from "react";
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
import { StatusBar } from "expo-status-bar";
import { Glass, Tekmet } from "../components/mingi";
import { createInviteRequest } from "../services/inviteRequestService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function RequestInviteScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [about, setAbout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setError("");

      await createInviteRequest({
        fullName,
        contact,
        about,
      });

      Alert.alert("Заявка отправлена", "Мы рассмотрим её и свяжемся с вами.");

      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось отправить заявку";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
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
          <Text style={styles.title}>Заявка</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.description}>
            Если у вас нет приглашения, оставьте заявку. Укажите имя и один
            способ связи: телефон или Telegram.
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Ваше имя"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setError("");
              }}
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Телефон или Telegram"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={contact}
              onChangeText={(text) => {
                setContact(text);
                setError("");
              }}
              autoCapitalize="none"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Кто вы и чем можете быть полезны (необязательно)"
              placeholderTextColor="#8FA79A"
              style={[styles.input, styles.textArea]}
              value={about}
              onChangeText={(text) => {
                setAbout(text);
                setError("");
              }}
              multiline
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.primaryShadow, submitting && styles.disabled]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {submitting ? "Отправка..." : "Отправить заявку"}
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
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardWrap: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "center",
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

  description: {
    fontSize: 14,
    lineHeight: 21,
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
    height: 110,
    paddingTop: 14,
    textAlignVertical: "top",
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
