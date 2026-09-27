// Точка входа: решает, куда вести человека при запуске.
//
// Веха 70 «Без сети»: раньше без интернета проверка висла, падала — и
// приложение открывало ПРИВЕТСТВИЕ, будто человек вышел из аккаунта.
// Теперь:
//  • сеть есть — как раньше: анкета с сервера → маршрут; маршрут
//    запоминается на телефоне (lib/offline.ts);
//  • сети нет, но память есть — открываемся по памяти (без ожидания);
//    блокировку/удаление перепроверит часовой, когда сеть вернётся;
//  • человек не входил (на телефоне нет входа) — приветствие;
//  • сети нет и памяти нет — экран «Нет соединения» с «Повторить».

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../components/mingi";
import { supabase } from "../lib/supabase";
import {
  LaunchRoute,
  clearLaunchMemory,
  readLaunchMemory,
  saveLaunchMemory,
  withTimeout,
} from "../lib/offline";
import { getMyProfile } from "../services/profileService";
import { useLanguage } from "../services/i18nService";

type Route = LaunchRoute | "welcome" | "offline";

// Сколько ждём сервер при запуске, прежде чем открыться по памяти.
const PROFILE_TIMEOUT_MS = 8000;
const SESSION_TIMEOUT_MS = 5000;

export default function Index() {
  const lang = useLanguage();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>("welcome");

  const init = useCallback(async () => {
    setReady(false);

    // 1. Вход, сохранённый на телефоне (без сети). Ошибка здесь значит
    //    «вход есть, но обновить его без сети не вышло» — это не выход.
    let signedOut = false;
    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        SESSION_TIMEOUT_MS,
      );
      signedOut = !data?.session && !error;
    } catch {
      signedOut = false;
    }

    if (signedOut) {
      await clearLaunchMemory();
      setRoute("welcome");
      setReady(true);
      return;
    }

    // 2. Сервер: анкета и её состояние.
    try {
      const profile = await withTimeout(getMyProfile(), PROFILE_TIMEOUT_MS);

      if (!profile) {
        await clearLaunchMemory();
        setRoute("welcome");
        return;
      }

      const next: LaunchRoute = profile.is_deleted
        ? "deleted"
        : profile.is_blocked
          ? "blocked"
          : profile.moderation_status === "approved"
            ? "approved"
            : "pending";

      await saveLaunchMemory(profile.id, next);
      setRoute(next);
    } catch {
      // 3. Сервер не ответил. Сначала убедимся, что вход не отозван
      //    (если сервер отказал во входе, библиотека уже стёрла его с
      //    телефона — тогда это выход, а не отсутствие сети).
      let goneNow = false;
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SESSION_TIMEOUT_MS,
        );
        goneNow = !data?.session && !error;
      } catch {
        goneNow = false;
      }

      if (goneNow) {
        await clearLaunchMemory();
        setRoute("welcome");
      } else {
        // Открываемся по памяти, если она есть.
        const memory = await readLaunchMemory();
        setRoute(memory ? memory.route : "offline");
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  if (route === "offline") {
    const en = lang === "en";
    return (
      <View style={styles.offline}>
        <Ionicons name="cloud-offline-outline" size={44} color="#719686" />

        {fontsLoaded && (
          <Text style={styles.offlineTitle}>
            {en ? "No connection" : "Нет соединения"}
          </Text>
        )}

        <Tekmet style={styles.tekmet} />

        <Text style={styles.offlineText}>
          {en
            ? "Mingi-Tau needs the internet for the first launch. Check your connection and try again."
            : "Для первого запуска «Минги-Тау» нужен интернет. Проверьте соединение и попробуйте ещё раз."}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          activeOpacity={0.85}
          onPress={init}
        >
          <Text style={styles.retryText}>{en ? "Try again" : "Повторить"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (route === "deleted") {
    return <Redirect href="/profile-deleted" />;
  }

  if (route === "blocked") {
    return <Redirect href="/access-restricted" />;
  }

  if (route === "approved") {
    return <Redirect href="/splash" />;
  }

  if (route === "pending") {
    return <Redirect href="/pending-approval" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  offline: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
  },

  offlineTitle: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 26,
    color: "#3F6B5B",
    textAlign: "center",
    marginTop: 14,
  },

  tekmet: {
    marginTop: 12,
    marginBottom: 14,
  },

  offlineText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 24,
  },

  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(105,183,141,0.92)",
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
