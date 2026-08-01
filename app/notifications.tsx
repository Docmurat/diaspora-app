import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Tekmet } from "../components/mingi";

export default function NotificationsScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <View style={styles.center}>
        <Text style={styles.title}>Уведомления</Text>
        <Text style={styles.subtitle}>СКОРО</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          Здесь будут все события: новые сообщения, темы в вашей сфере
          деятельности, ответы на ваши темы и решения по заявкам.
        </Text>

        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.link}>Назад</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
    marginBottom: 16,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    maxWidth: 340,
  },

  link: {
    marginTop: 24,
    fontSize: 15,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },
});
