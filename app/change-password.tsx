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

function getPasswordErrorMessage(message?: string) {
  if (!message) {
    return "Не удалось изменить пароль.";
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("same password")) {
    return "Новый пароль должен отличаться от текущего.";
  }

  if (normalized.includes("weak password")) {
    return "Пароль слишком слабый.";
  }

  if (normalized.includes("password should be at least")) {
    return "Пароль слишком короткий.";
  }

  if (normalized.includes("reauthentication")) {
    return "Для смены пароля нужно подтвердить личность повторно.";
  }

  if (normalized.includes("nonce")) {
    return "Не пройдена повторная проверка безопасности.";
  }

  if (normalized.includes("current password")) {
    return "Текущий пароль указан неверно.";
  }

  return "Не удалось изменить пароль.";
}

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function ChangePasswordScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formValid = !!newPassword.trim() && !!repeatPassword.trim();

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      setError("Введите новый пароль.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Новый пароль должен содержать минимум 6 символов.");
      return;
    }

    if (newPassword !== repeatPassword) {
      setError("Новый пароль и подтверждение не совпадают.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const payload: {
        password: string;
        current_password?: string;
      } = {
        password: newPassword,
      };

      if (currentPassword.trim()) {
        payload.current_password = currentPassword;
      }

      const { error: updateError } = await supabase.auth.updateUser(payload);

      if (updateError) {
        setError(getPasswordErrorMessage(updateError.message));
        return;
      }

      setSuccessMessage("Пароль успешно изменён.");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch (e: any) {
      console.log("Ошибка смены пароля:", e);
      setError(getPasswordErrorMessage(e?.message));
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
          <Text style={styles.title}>Смена пароля</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.description}>
            Придумайте новый пароль — не короче 6 символов.
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Текущий пароль"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                setError("");
                setSuccessMessage("");
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Новый пароль *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                setError("");
                setSuccessMessage("");
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Повторите новый пароль *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={repeatPassword}
              onChangeText={(text) => {
                setRepeatPassword(text);
                setError("");
                setSuccessMessage("");
              }}
              secureTextEntry
              autoCapitalize="none"
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!successMessage && (
            <Text style={styles.success}>{successMessage}</Text>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleChangePassword}
            disabled={loading || !formValid}
            style={[
              styles.primaryShadow,
              (loading || !formValid) && styles.disabled,
            ]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {loading ? "Сохранение..." : "Сменить пароль"}
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
