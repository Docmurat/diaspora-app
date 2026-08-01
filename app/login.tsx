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
import { translateAuthError } from "../services/errorService";
import { getCurrentProfile, signInUser } from "../services/sessionService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function LoginScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Введите email и пароль");
      return;
    }

    try {
      await signInUser(email, password);
      const profile = await getCurrentProfile();

      if (!profile) {
        setError("Профиль пользователя не найден");
        return;
      }

      if (profile.is_deleted) {
        setError("");
        router.replace("/profile-deleted");
        return;
      }

      if (profile.is_blocked) {
        setError("");
        router.replace("/access-restricted");
        return;
      }

      if (profile.moderation_status === "approved") {
        setError("");
        router.replace("/splash");
        return;
      }

      if (
        profile.moderation_status === "pending" ||
        profile.moderation_status === "needs_revision"
      ) {
        setError("");
        router.replace("/pending-approval");
        return;
      }

      setError("Доступ к аккаунту ограничен");
    } catch (e) {
      setError(translateAuthError(e));
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Вход</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Электронная почта"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Пароль"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
              secureTextEntry
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleLogin}
            style={styles.primaryShadow}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>Продолжить</Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/invite")}>
            <Text style={styles.link}>Нет аккаунта? Ввести инвайт-код</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginBottom: 26,
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
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  link: {
    color: "#4E7364",
    textAlign: "center",
    fontSize: 14,
    marginTop: 20,
    textDecorationLine: "underline",
  },
});
