import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Glass, MingiBackground, Tekmet } from "../components/mingi";
import { subscribeToChanges } from "../services/liveService";
import { getMyProfile } from "../services/profileService";
import { signOutUser } from "../services/sessionService";

export default function AccessRestrictedScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  // Если блокировку сняли, человек не должен сидеть в тупике до
  // перезагрузки: слушаем живое обновление и на подстраховку тихо
  // проверяем статус раз в 7 секунд — и сразу возвращаем в приложение.
  useEffect(() => {
    let cancelled = false;

    const checkUnblocked = async () => {
      try {
        const profile = await getMyProfile();

        if (!cancelled && profile && !(profile as any).is_blocked) {
          router.replace("/(tabs)");
        }
      } catch (e) {
        console.log("Проверка снятия блокировки:", e);
      }
    };

    const interval = setInterval(checkUnblocked, 7000);
    const unsubscribe = subscribeToChanges(
      "access-restricted-screen",
      [{ table: "users" }],
      checkUnblocked,
    );

    checkUnblocked();

    return () => {
      cancelled = true;
      clearInterval(interval);
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
    <MingiBackground idPrefix="restricted">
      <View style={styles.content}>
        <Text style={styles.title}>Доступ ограничен</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          Ваш доступ к сообществу временно ограничен.
        </Text>

        <Text style={styles.hint}>
          Если вы считаете, что произошла ошибка, напишите администрации — мы
          разберёмся.
        </Text>

        <TouchableOpacity
          style={styles.primaryShadow}
          onPress={() => router.push("/contact-admin")}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>
                Написать администрации
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryWrap}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Glass
            radius={18}
            tintColor="rgba(255,255,255,0.75)"
            borderColor="rgba(93,140,120,0.45)"
            borderWidth={0.75}
          >
            <View style={styles.buttonInner}>
              <Text style={styles.secondaryButtonText}>Выйти из аккаунта</Text>
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
    backgroundColor: "#F3F8F4",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 32,
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

  text: {
    fontSize: 15.5,
    lineHeight: 23,
    color: "#3F6B5B",
    textAlign: "center",
    marginBottom: 10,
  },

  hint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 6,
  },

  primaryShadow: {
    marginTop: 22,
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
});
