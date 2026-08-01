import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import TopBar from "../../components/TopBar";
import { Tekmet } from "../../components/mingi";

export default function HelpScreen() {
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
      <TopBar />

      <View style={styles.center}>
        <Text style={styles.title}>Стена помощи</Text>
        <Text style={styles.subtitle}>СКОРО</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          Здесь появится лента тем: можно будет попросить помощи или
          предложить свою. Люди из вашей сферы деятельности получат
          уведомление.
        </Text>
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
    paddingBottom: 40,
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
});
