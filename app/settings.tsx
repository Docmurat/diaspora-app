import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";
import { softDeleteMyAccount } from "../services/profileService";
import { signOutUser } from "../services/sessionService";

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
  last?: boolean;
};

function SettingsRow({
  icon,
  label,
  hint,
  danger,
  onPress,
  last,
}: RowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.row, last && styles.rowLast]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? "#C05B4D" : "#69B78D"}
        style={styles.rowIcon}
      />

      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>
          {label}
        </Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#A8BDB1" />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Удаление подтверждается вторым нажатием — так работает
  // одинаково и в браузере, и на телефоне.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    try {
      await signOutUser();
      router.replace("/welcome");
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось выйти");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    if (busy) return;

    try {
      setBusy(true);
      await softDeleteMyAccount();
      router.replace("/profile-deleted" as any);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Не удалось удалить профиль";
      Alert.alert("Ошибка", message);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>← Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.blockLabel}>ВХОД И СВЯЗЬ</Text>

        <View style={styles.sectionCard}>
          <SettingsRow
            icon="mail-outline"
            label="Сменить почту"
            onPress={() => router.push("/change-email")}
          />

          <SettingsRow
            icon="key-outline"
            label="Сменить пароль"
            onPress={() => router.push("/change-password")}
          />

          <SettingsRow
            icon="person-outline"
            label="Изменить имя или фамилию"
            hint="Через заявку модератору"
            onPress={() => router.push("/request-name-change")}
            last
          />
        </View>

        <Text style={styles.blockLabel}>ПОМОЩЬ</Text>

        <View style={styles.sectionCard}>
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            label="Написать администрации"
            onPress={() => router.push("/contact-admin")}
            last
          />
        </View>

        <Text style={styles.blockLabel}>АККАУНТ</Text>

        <View style={styles.sectionCard}>
          <SettingsRow
            icon="log-out-outline"
            label="Выйти из аккаунта"
            danger
            onPress={handleLogout}
          />

          <SettingsRow
            icon="trash-outline"
            label={
              confirmDelete ? "Нажмите ещё раз, чтобы удалить" : "Удалить профиль"
            }
            hint={
              confirmDelete
                ? "Профиль скроется из сообщества. Отменить нельзя."
                : undefined
            }
            danger
            onPress={handleDelete}
            last
          />
        </View>

        {confirmDelete && (
          <TouchableOpacity
            onPress={() => setConfirmDelete(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelLink}>Не удалять</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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

  blockLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#719686",
    marginBottom: 10,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    overflow: "hidden",
    marginBottom: 24,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 0.75,
    borderBottomColor: "rgba(93,140,120,0.18)",
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowIcon: {
    marginRight: 12,
  },

  rowTextWrap: {
    flex: 1,
  },

  rowLabel: {
    fontSize: 15,
    color: "#2F4A3C",
  },

  rowLabelDanger: {
    color: "#C05B4D",
  },

  rowHint: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#8FA79A",
  },

  cancelLink: {
    textAlign: "center",
    fontSize: 15,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
