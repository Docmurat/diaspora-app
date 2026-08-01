import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MingiBackground, Tekmet } from "../components/mingi";

const SPLASH_DURATION_MS = 3000;

export default function SplashScreen() {
  const { width } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  const logoWidth = Math.min(width * 0.62, 280);
  const logoHeight = logoWidth * 0.62;

  return (
    <MingiBackground idPrefix="sp">
      <View style={styles.content}>
        <Image
          source={require("../assets/Logo-start.png")}
          style={{
            width: logoWidth,
            height: logoHeight,
            resizeMode: "contain",
          }}
        />

        {fontsLoaded && (
          <>
            <Text style={styles.title}>Минги-Тау</Text>
            <Tekmet style={styles.tekmet} />
          </>
        )}
      </View>
    </MingiBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 34,
    color: "#3F6B5B",
    textAlign: "center",
    marginTop: 18,
  },

  tekmet: {
    marginTop: 14,
  },
});
