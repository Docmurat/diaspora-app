import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
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

import { supabase } from "../lib/supabase";

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

// Стеклянная карточка: размытие отдельным слоем, поверх него цветная плёнка,
// и только потом содержимое — так цвет не выцветает
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

export default function WelcomeScreen() {
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
  const x4 = useDrift(7800, 400);
  const y4 = useDrift(11800, 800);
  const x5 = useDrift(14000, 250);
  const y5 = useDrift(7200, 600);

  const logoWidth = Math.min(width * 0.62, 280);
  const logoHeight = logoWidth * 0.62;

  // «Нас уже N» (Веха 60): число одобренных участников с порога — функция
  // базы community_member_count отдаёт наружу ТОЛЬКО число. Пока не
  // загрузилось (или ошибка) — строка просто не показывается.
  const [memberCount, setMemberCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;

    // try/catch вместо .catch(): у ответа Supabase по типам «обещание-
    // лайт» без .catch — подсказчик подчёркивал красным (работало, но
    // формально он прав).
    const loadCount = async () => {
      try {
        const { data } = await supabase.rpc("community_member_count");
        if (alive && typeof data === "number" && data > 0) {
          setMemberCount(data);
        }
      } catch {
        // счётчик — украшение: при ошибке строка просто не показывается
      }
    };

    loadCount();
    return () => {
      alive = false;
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Blob
        id="b1"
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
        id="b2"
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
        id="b3"
        size={800}
        color="#DFEFE3"
        style={{ bottom: -330, left: -300 }}
        driftX={x3}
        driftY={y3}
        rangeX={width * 0.8}
        rangeY={-height * 0.65}
        scaleTo={1.16}
      />
      <Blob
        id="b4"
        size={680}
        color="#B7DEC8"
        style={{ top: 160, left: -310 }}
        driftX={x4}
        driftY={y4}
        rangeX={width * 0.95}
        rangeY={-height * 0.4}
        scaleTo={1.14}
      />
      <Blob
        id="b5"
        size={720}
        color="#CDE8D6"
        style={{ bottom: -120, right: -330 }}
        driftX={x5}
        driftY={y5}
        rangeX={-width * 0.85}
        rangeY={-height * 0.55}
        scaleTo={0.92}
      />

      <View style={styles.content}>
        <Image
          source={require("../assets/Logo-start.png")}
          style={{
            width: logoWidth,
            height: logoHeight,
            resizeMode: "contain",
          }}
        />

        <Text style={styles.title}>Минги-Тау</Text>
        <Text style={styles.tagline}>КАРАЧАЕВО·БАЛКАРСКОЕ</Text>
        <Text style={styles.taglineSecond}>СООБЩЕСТВО</Text>

        <Svg width={120} height={24} viewBox="0 0 120 24" style={styles.tekmet}>
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

        <View style={styles.chipsArea}>
          <View style={styles.chipsTopRow}>
            <Glass
              radius={999}
              tintColor="rgba(255,255,255,0.55)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
              style={styles.chipFlex}
            >
              <View style={styles.chipInner}>
                <Ionicons name="people-outline" size={16} color="#4E7364" />
                <Text style={styles.chipText}>Свои люди</Text>
              </View>
            </Glass>
            <Glass
              radius={999}
              tintColor="rgba(255,255,255,0.55)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
              style={styles.chipFlex}
            >
              <View style={styles.chipInner}>
                <MaterialCommunityIcons
                  name="handshake-outline"
                  size={16}
                  color="#4E7364"
                />
                <Text style={styles.chipText}>Взаимопомощь</Text>
              </View>
            </Glass>
          </View>
          <View style={styles.chipCenterRow}>
            <Glass
              radius={999}
              tintColor="rgba(255,255,255,0.55)"
              borderColor="rgba(93,140,120,0.45)"
              borderWidth={0.75}
            >
              <View style={styles.chipInner}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color="#4E7364"
                />
                <Text style={styles.chipText}>Закрытый круг</Text>
              </View>
            </Glass>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/login")}
          style={styles.primaryShadow}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>Войти</Text>
            </View>
          </Glass>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/invite")}
          style={styles.secondaryWrap}
        >
          <Glass
            radius={18}
            tintColor="rgba(255,255,255,0.5)"
            borderColor="rgba(93,140,120,0.45)"
            borderWidth={0.75}
          >
            <View style={styles.buttonInner}>
              <Text style={styles.secondaryButtonText}>Регистрация</Text>
            </View>
          </Glass>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Только по приглашению
          {memberCount !== null ? ` · нас уже ${memberCount}` : ""}
        </Text>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => router.push("/privacy" as any)}>
            <Text style={styles.linkText}>Конфиденциальность</Text>
          </TouchableOpacity>
          <Text style={styles.dot}>•</Text>
          <TouchableOpacity onPress={() => router.push("/terms" as any)}>
            <Text style={styles.linkText}>Соглашение</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.founder}>Основатель — Мурат Курджиев</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4FAF4",
    overflow: "hidden",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    marginTop: -10,
    fontSize: 34,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: "#3F6B5B",
  },

  tagline: {
    fontFamily: "Philosopher_400Regular",
    marginTop: 10,
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
  },

  taglineSecond: {
    fontFamily: "Philosopher_400Regular",
    marginTop: 2,
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
  },

  tekmet: {
    marginTop: 16,
  },

  chipsArea: {
    width: "100%",
    marginTop: 18,
    gap: 10,
  },

  chipsTopRow: {
    flexDirection: "row",
    gap: 10,
  },

  chipCenterRow: {
    alignItems: "center",
  },

  chipFlex: {
    flex: 1,
  },

  chipInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },

  chipText: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 14.5,
    color: "#4E7364",
  },

  bottomSection: {
    paddingHorizontal: 22,
    paddingBottom: 40,
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
    paddingVertical: 16,
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  secondaryWrap: {
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#3F6B5B",
    fontSize: 16,
    fontWeight: "600",
  },

  footer: {
    textAlign: "center",
    color: "#7E988B",
    fontSize: 12.5,
    marginTop: 12,
  },

  linksRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 44,
  },

  linkText: {
    fontSize: 11.5,
    color: "#96AC9E",
    textDecorationLine: "underline",
  },

  dot: {
    marginHorizontal: 6,
    color: "#96AC9E",
    fontSize: 11.5,
  },

  founder: {
    marginTop: 10,
    fontSize: 12,
    color: "#8FA79A",
    textAlign: "center",
  },
});
