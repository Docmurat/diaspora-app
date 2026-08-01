import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
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
import { createComplaint } from "../services/complaintsService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function ReportUserScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const params = useLocalSearchParams();
  const targetUserId = String(params.userId || "");
  const targetUserName = String(params.userName || "");

  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Опишите, что произошло");
      return;
    }

    if (sending) return;

    try {
      setSending(true);
      setError("");

      await createComplaint({ targetUserId, reason });

      setSuccess(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ошибка отправки жалобы";
      setError(message);
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

        <View style={styles.center}>
          <Text style={styles.title}>Жалоба отправлена</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.successText}>
            Модераторы рассмотрят обращение и сообщат вам о решении. Спасибо,
            что помогаете беречь сообщество.
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
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Жалоба</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          {!!targetUserName && (
            <View style={styles.targetCard}>
              <Text style={styles.targetLabel}>ЖАЛОБА НА УЧАСТНИКА</Text>
              <Text style={styles.targetName}>{targetUserName}</Text>
            </View>
          )}

          <Text style={styles.description}>
            Опишите, что произошло, как можно конкретнее: где и когда, какие
            слова или действия вас задели. Модератору важны подробности — по
            короткой жалобе он не сможет разобраться.
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              style={styles.textArea}
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                setError("");
              }}
              placeholder="Например: в переписке оскорбил(а) мою семью"
              placeholderTextColor="#8FA79A"
              multiline
              textAlignVertical="top"
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={sending || !reason.trim()}
            style={[
              styles.primaryShadow,
              (sending || !reason.trim()) && styles.disabled,
            ]}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {sending ? "Отправка..." : "Отправить жалобу"}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.cancelLink}>Отмена</Text>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            Жалобу видят только модераторы. Участник, на которого вы
            пожаловались, не узнает, кто её написал.
          </Text>
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
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    flexGrow: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  backLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
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

  targetCard: {
    backgroundColor: "rgba(192,91,77,0.06)",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(192,91,77,0.35)",
    padding: 16,
    marginBottom: 16,
  },

  targetLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: "#C05B4D",
    marginBottom: 6,
  },

  targetName: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 19,
    color: "#3F6B5B",
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7E988B",
    marginBottom: 16,
  },

  inputWrap: {
    marginBottom: 14,
  },

  textArea: {
    minHeight: 150,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15.5,
    lineHeight: 22,
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
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },

  cancelLink: {
    marginTop: 16,
    fontSize: 15,
    color: "#96AC9E",
    textDecorationLine: "underline",
    textAlign: "center",
  },

  privacyNote: {
    marginTop: 24,
    fontSize: 12.5,
    lineHeight: 18,
    color: "#8FA79A",
    textAlign: "center",
  },

  successText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 340,
  },
});
