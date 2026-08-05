import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Glass, MingiBackground, Tekmet } from "../components/mingi";
import { subscribeToChanges } from "../services/liveService";
import { getMyProfile } from "../services/profileService";
import { signOutUser } from "../services/sessionService";

export default function ProfileDeletedScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Где мы сейчас. Нужно перепроверке ниже: переброс разрешён, только
  // пока человек действительно стоит на этом экране.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Если основатель восстановил профиль, человек не должен сидеть в
  // тупике до перезагрузки: слушаем живое обновление и на подстраховку
  // тихо проверяем статус раз в 7 секунд — и сразу уводим в приложение.
  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const checkRestored = async () => {
      try {
        // Человек уже ушёл с этого экрана — перепроверке молчать.
        // Страховка от «осиротевшего» таймера: даже если он выжил,
        // выбрасывать людей с других экранов он больше не может.
        if (cancelled || pathnameRef.current !== "/profile-deleted") {
          return;
        }

        const profile = await getMyProfile();

        if (!cancelled && profile && !profile.is_deleted) {
          // Срабатываем один раз — и сразу глушим себя навсегда.
          cancelled = true;
          if (interval) clearInterval(interval);
          router.replace("/(tabs)");
        }
      } catch (e) {
        console.log("Проверка восстановления профиля:", e);
      }
    };

    interval = setInterval(checkRestored, 7000);
    const unsubscribe = subscribeToChanges(
      "profile-deleted-screen",
      [{ table: "users" }],
      checkRestored,
    );

    checkRestored();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      unsubscribe();
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.log("Не удалось выйти:", e);
    }

    router.replace("/welcome");
  };

  return (
    <MingiBackground idPrefix="del">
      <View style={styles.content}>
        <Text style={styles.title}>Профиль удалён</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          Ваш профиль удалён администрацией и больше недоступен в сообществе.
        </Text>

        <Text style={styles.hint}>
          Если вы считаете, что произошла ошибка, напишите администрации — мы
          разберёмся.
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/contact-admin")}
          style={styles.primaryShadow}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>
                Связаться с администрацией
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleLogout}
          style={styles.secondaryWrap}
        >
          <Glass
            radius={18}
            tintColor="rgba(255,255,255,0.5)"
            borderColor="rgba(93,140,120,0.45)"
            borderWidth={0.75}
          >
            <View style={styles.buttonInner}>
              <Text style={styles.secondaryButtonText}>Выйти</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </View>
    </MingiBackground>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#F4FAF4",
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

  text: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#4E7364",
    textAlign: "center",
    marginBottom: 12,
  },

  hint: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 26,
  },

  primaryShadow: {
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  secondaryWrap: {
    marginTop: 12,
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

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 15.5,
    fontWeight: "600",
  },
});
