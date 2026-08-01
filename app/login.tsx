import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { translateAuthError } from "../services/errorService";
import { getCurrentProfile, signInUser } from "../services/sessionService";

function useDrift(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

function Blob({
  size,
  color,
  style,
  driftX,
  driftY,
  rangeX,
  rangeY,
  scaleTo,
  id,
}: {
  size: number;
  color: string;
  style: object;
  driftX: Animated.Value;
  driftY: Animated.Value;
  rangeX: number;
  rangeY: number;
  scaleTo: number;
  id: string;
}) {
  const translateX = driftX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, rangeX],
  });
  const translateY = driftY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, rangeY],
  });
  const scale = driftY.interpolate({
    inputRange: [0, 1],
    outputRange: [1, scaleTo],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: size, height: size },
        style,
        { transform: [{ translateX }, { translateY }, { scale }] },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <Stop offset="70%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Glass({
  children,
  radius,
  tintColor,
  borderColor,
  borderWidth = 1,
  style,
}: {
  children: ReactNode;
  radius: number;
  tintColor: string;
  borderColor: string;
  borderWidth?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          borderWidth,
          borderColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <BlurView intensity={22} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      {children}
    </View>
  );
}

export default function LoginScreen() {
  const { width, height } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const x1 = useDrift(11200);
  const y1 = useDrift(8200, 300);
  const x2 = useDrift(9600, 150);
  const y2 = useDrift(13400, 500);
  const x3 = useDrift(12200, 700);
  const y3 = useDrift(8800, 100);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Введите email и пароль");
      return;
    }

    try {
      await signInUser(email, password);
      const profile = await getCurrentProfile();

      if (!profile) {
        setError("Профиль пользователя не найден");
        return;
      }

      if (profile.is_deleted) {
        setError("");
        router.replace("/profile-deleted");
        return;
      }

      if (profile.is_blocked) {
        setError("");
        router.replace("/access-restricted");
        return;
      }

      if (profile.moderation_status === "approved") {
        setError("");
        router.replace("/splash");
        return;
      }

      if (
        profile.moderation_status === "pending" ||
        profile.moderation_status === "needs_revision"
      ) {
        setError("");
        router.replace("/pending-approval");
        return;
      }

      setError("Доступ к аккаунту ограничен");
    } catch (e) {
      setError(translateAuthError(e));
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Blob
        id="l1"
        size={760}
        color="#A8D8C0"
        style={{ top: -300, left: -310 }}
        driftX={x1}
        driftY={y1}
        rangeX={width * 0.85}
        rangeY={height * 0.6}
        scaleTo={1.18}
      />
      <Blob
        id="l2"
        size={840}
        color="#C2E3CF"
        style={{ top: -90, right: -360 }}
        driftX={x2}
        driftY={y2}
        rangeX={-width * 0.9}
        rangeY={height * 0.5}
        scaleTo={0.9}
      />
      <Blob
        id="l3"
        size={800}
        color="#DFEFE3"
        style={{ bottom: -330, left: -300 }}
        driftX={x3}
        driftY={y3}
        rangeX={width * 0.8}
        rangeY={-height * 0.65}
        scaleTo={1.16}
      />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Вход</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Svg
            width={120}
            height={24}
            viewBox="0 0 120 24"
            style={styles.tekmet}
          >
            <Path d="M4 12 L44 12" stroke="#CBE2D3" strokeWidth={1.5} />
            <Circle
              cx={60}
              cy={12}
              r={9}
              fill="none"
              stroke="#9FC5AF"
              strokeWidth={1.6}
            />
            <Path
              d="M60 6 L66 12 L60 18 L54 12 Z"
              fill="none"
              stroke="#9FC5AF"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
            <Circle cx={60} cy={12} r={1.6} fill="#9FC5AF" />
            <Path d="M76 12 L116 12" stroke="#CBE2D3" strokeWidth={1.5} />
          </Svg>

          <Glass
            radius={16}
            tintColor="rgba(255,255,255,0.55)"
            borderColor="rgba(93,140,120,0.45)"
            borderWidth={0.75}
            style={styles.inputWrap}
          >
            <TextInput
              placeholder="Электронная почта"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Glass>

          <Glass
            radius={16}
            tintColor="rgba(255,255,255,0.55)"
            borderColor="rgba(93,140,120,0.45)"
            borderWidth={0.75}
            style={styles.inputWrap}
          >
            <TextInput
              placeholder="Пароль"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError("");
              }}
              secureTextEntry
            />
          </Glass>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleLogin}
            style={styles.primaryShadow}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>Продолжить</Text>
              </View>
            </Glass>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/invite")}>
            <Text style={styles.link}>Нет аккаунта? Ввести инвайт-код</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4FAF4",
    overflow: "hidden",
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

  buttonInner: {
    paddingVertical: 16,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  link: {
    color: "#4E7364",
    textAlign: "center",
    fontSize: 14,
    marginTop: 20,
    textDecorationLine: "underline",
  },
});
