import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { createNameChangeRequest } from "../services/nameChangeService";
import { DbUserProfile, getMyProfile } from "../services/profileService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function RequestNameChangeScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [user, setUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [requestedFirstName, setRequestedFirstName] = useState("");
  const [requestedLastName, setRequestedLastName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        try {
          setLoading(true);
          const profile = await getMyProfile();
          setUser(profile);
        } catch (e) {
          console.log("Ошибка загрузки профиля:", e);
          setUser(null);
        } finally {
          setLoading(false);
        }
      };

      loadProfile();
    }, []),
  );

  const handleSubmit = async () => {
    if (sending) return;

    if (
      !requestedFirstName.trim() ||
      !requestedLastName.trim() ||
      !reason.trim()
    ) {
      setError("Заполните все поля");
      return;
    }

    try {
      setSending(true);

      await createNameChangeRequest({
        requestedFirstName,
        requestedLastName,
        reason,
      });

      setError("");
      setSuccess(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Ошибка отправки запроса";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerState}>
        <StatusBar style="dark" />

        <Text style={styles.stateTitle}>Профиль не найден</Text>
        <Text style={styles.stateText}>
          Войдите в аккаунт и попробуйте ещё раз.
        </Text>

        <TouchableOpacity
          style={styles.primaryShadow}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>Назад</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={styles.centerState}>
        <StatusBar style="dark" />

        <Text style={styles.stateTitle}>Запрос отправлен</Text>

        <Tekmet style={styles.tekmetSuccess} />

        <Text style={styles.stateText}>
          Модератор рассмотрит запрос на изменение имени и фамилии. Ответ придёт
          в уведомления.
        </Text>

        <TouchableOpacity
          style={styles.primaryShadow}
          onPress={() => router.replace("/(tabs)/profile")}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>Вернуться в профиль</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
    );
  }

  const currentName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—";

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.backLink}
          >
            <Text style={styles.backLinkText}>← Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Изменение имени</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />

          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>СЕЙЧАС В ПРОФИЛЕ</Text>
            <Text style={styles.infoText}>{currentName}</Text>
          </View>

          <Text style={styles.hint}>
            Имя и фамилия меняются через заявку: модератор проверит запрос и
            обновит профиль.
          </Text>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Новое имя *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={requestedFirstName}
              onChangeText={(text) => {
                setRequestedFirstName(text);
                setError("");
              }}
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Новая фамилия *"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={requestedLastName}
              onChangeText={(text) => {
                setRequestedLastName(text);
                setError("");
              }}
            />
          </Glass>

          <Glass {...glassInputProps} style={styles.inputWrap}>
            <TextInput
              placeholder="Причина: например, опечатка при регистрации или смена фамилии *"
              placeholderTextColor="#8FA79A"
              style={[styles.input, styles.textArea]}
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                setError("");
              }}
              multiline
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={styles.secondaryWrap}
            >
              <Glass
                radius={18}
                tintColor="rgba(255,255,255,0.95)"
                borderColor="rgba(93,140,120,0.45)"
                borderWidth={0.75}
              >
                <View style={styles.buttonInner}>
                  <Text style={styles.secondaryButtonText}>Отмена</Text>
                </View>
              </Glass>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={sending}
              style={[
                styles.primaryHalf,
                styles.primaryShadowFlat,
                sending && styles.disabled,
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
          </View>
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

  flex: {
    flex: 1,
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  centerState: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  stateTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 26,
    color: "#3F6B5B",
    marginBottom: 10,
    textAlign: "center",
  },

  stateText: {
    fontSize: 14.5,
    color: "#7E988B",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 4,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
    flexGrow: 1,
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
    marginBottom: 22,
  },

  tekmetSuccess: {
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 18,
  },

  infoBlock: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    padding: 16,
    marginBottom: 12,
  },

  infoTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.4,
    marginBottom: 8,
    color: "#719686",
  },

  infoText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#2F4A3C",
  },

  hint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#96AC9E",
    marginBottom: 14,
    marginLeft: 4,
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
    fontSize: 13.5,
    marginBottom: 12,
    marginLeft: 4,
  },

  buttonsRow: {
    flexDirection: "row",
    marginTop: 8,
  },

  secondaryWrap: {
    flex: 1,
    marginRight: 8,
  },

  primaryHalf: {
    flex: 1,
    marginLeft: 8,
  },

  primaryShadow: {
    marginTop: 20,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  primaryShadowFlat: {
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontWeight: "600",
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 15.5,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },
});
