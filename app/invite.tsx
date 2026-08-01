import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Glass, Tekmet } from "../components/mingi";
import { translateInviteError } from "../services/errorService";
import { validateInviteCode } from "../services/inviteService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function InviteScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      setError("Введите инвайт-код");
      return;
    }

    try {
      setChecking(true);
      setError("");

      await validateInviteCode(normalized);

      router.push({
        pathname: "/register",
        params: { inviteCode: normalized },
      });
    } catch (e) {
      console.log("invite check error:", e);
      setError(translateInviteError(e));
    } finally {
      setChecking(false);
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
          <Text style={styles.title}>Приглашение</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Инвайт-код"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setError("");
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!checking}
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCheck}
            disabled={checking}
            style={[styles.primaryShadow, checking && styles.disabled]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                {checking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Продолжить</Text>
                )}
              </View>
            </Glass>
          </TouchableOpacity>

          <Text style={styles.hint}>Нет инвайта?</Text>

          <TouchableOpacity
            onPress={() => router.push("/request-invite")}
            activeOpacity={0.8}
          >
            <Text style={styles.link}>Оставить заявку</Text>
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

  disabled: {
    opacity: 0.7,
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

  hint: {
    color: "#7E988B",
    textAlign: "center",
    fontSize: 14,
    marginTop: 20,
  },

  link: {
    color: "#96AC9E",
    textAlign: "center",
    fontSize: 14,
    marginTop: 6,
    textDecorationLine: "underline",
  },
});
