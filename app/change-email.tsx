import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Glass, Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";

function getChangeEmailErrorMessage(message?: string) {
  if (!message) {
    return "Не удалось изменить почту";
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes(
      "a user with this email address has already been registered",
    )
  ) {
    return "Пользователь с такой электронной почтой уже зарегистрирован.";
  }

  if (normalized.includes("unable to validate email address")) {
    return "Введите корректную электронную почту.";
  }

  if (normalized.includes("email rate limit exceeded")) {
    return "Слишком много попыток. Попробуйте немного позже.";
  }

  if (normalized.includes("same email")) {
    return "Вы указали текущую электронную почту.";
  }

  if (normalized.includes("for security purposes")) {
    return "Из соображений безопасности попробуйте выполнить действие позже.";
  }

  return "Не удалось отправить запрос на смену почты.";
}

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function ChangeEmailScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChangeEmail = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email) {
      setError("Введите новую почту");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Введите корректную почту");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const { error: updateError } = await supabase.auth.updateUser({
        email,
      });

      if (updateError) {
        setError(getChangeEmailErrorMessage(updateError.message));
        return;
      }

      setSuccessMessage(
        "Запрос отправлен. Подтвердите смену почты через письмо, которое пришло на ваш email.",
      );
    } catch (e: any) {
      console.log("Ошибка смены почты:", e);
      setError(getChangeEmailErrorMessage(e?.message));
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Смена почты</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.description}>
            Укажите новую электронную почту и подтвердите изменение через
            письмо, которое придёт на неё.
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Новая электронная почта"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={newEmail}
              onChangeText={(text) => {
                setNewEmail(text);
                setError("");
                setSuccessMessage("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!successMessage && (
            <Text style={styles.success}>{successMessage}</Text>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleChangeEmail}
            disabled={loading || !newEmail.trim()}
            style={[
              styles.primaryShadow,
              (loading || !newEmail.trim()) && styles.disabled,
            ]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {loading ? "Отправка..." : "Сменить почту"}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.link}>Назад</Text>
          </TouchableOpacity>
        </View>
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

  content: {
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

  description: {
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

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  success: {
    color: "#3F6B5B",
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 21,
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
