// Общие элементы дизайн-системы «Минги-Тау»:
// живой фон с боке, стеклянные карточки и текмет-разделитель.
// Используется на всех экранах вместо копирования кода.

import { BlurView } from "expo-blur";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
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

// В вебе браузер рисует чёрную рамку фокуса поверх полей, переключателей
// и кнопок, а панель вкладок собирается из списка — браузер добавляет ей
// точки-маркеры. Отключаем и то, и другое один раз для всего приложения.
if (Platform.OS === "web" && typeof document !== "undefined") {
  // Метку меняем при каждом изменении правил, иначе старый стиль остаётся
  // висеть на странице и новые правила не применяются.
  const STYLE_ID = "mingi-web-css-v7";
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }

  // 1) чёрная рамка фокуса у полей и кнопок;
  // 2) точки-маркеры, которые браузер рисует у панели вкладок (она собрана
  //    из списка);
  // 3) слой пятен фона прибит к физическому экрану: клавиатура телефона
  //    сжимает страницу, но не должна двигать фон.
  style.textContent = [
    "*:focus, *:focus-visible { outline: none !important; }",
    "ul, ol, [role='list'], [role='tablist'] {",
    "  list-style: none !important; list-style-type: none !important;",
    "  padding-left: 0 !important; margin-left: 0 !important;",
    "}",
    "li, [role='listitem'], [role='tab'] {",
    "  list-style: none !important; list-style-type: none !important;",
    "}",
    "li::marker, [role='listitem']::marker, [role='tab']::marker {",
    "  content: '' !important; color: transparent !important;",
    "  font-size: 0 !important;",
    "}",
  ].join("\n");

  // Просим мобильный браузер класть клавиатуру ПОВЕРХ страницы, а не
  // сжимать страницу под неё (иначе фон и раскладка «подъезжают» вверх).
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, shrink-to-fit=no, " +
        "interactive-widget=resizes-visual",
    );
  }
}

export function useDrift(duration: number, delay = 0) {
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

export function Blob({
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
// и только потом содержимое — контент принудительно поднят поверх стекла
export function Glass({
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
      <BlurView
        intensity={22}
        tint="light"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]}
        pointerEvents="none"
      />
      <View style={{ position: "relative", zIndex: 1 }}>{children}</View>
    </View>
  );
}

// Текмет-разделитель: линия — круг с ромбом и точкой — линия
export function Tekmet({ style }: { style?: ViewStyle }) {
  return (
    <Svg width={120} height={24} viewBox="0 0 120 24" style={style}>
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
  );
}

// Живой фон экрана: мятный цвет + 3 дышащих пятна боке.
// idPrefix должен быть уникальным для каждого экрана (например "r", "q").
export function MingiBackground({
  children,
  idPrefix,
}: {
  children: ReactNode;
  idPrefix: string;
}) {
  const { width: liveWidth, height: liveHeight } = useWindowDimensions();

  const x1 = useDrift(11200);
  const y1 = useDrift(8200, 300);
  const x2 = useDrift(9600, 150);
  const y2 = useDrift(13400, 500);
  const x3 = useDrift(12200, 700);
  const y3 = useDrift(8800, 100);

  // На вебе клавиатура телефона сжимает страницу, и фон «подъезжал» вверх.
  // Запоминаем высоту экрана В ПИКСЕЛЯХ при загрузке и держим слой пятен
  // этой высоты. Сжатие от клавиатуры (высота уменьшилась, ширина та же)
  // игнорируем; поворот экрана (ширина изменилась) — принимаем честно.
  const [webSize, setWebSize] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : null,
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onResize = () => {
      setWebSize((prev) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (!prev) return { w, h };
        if (w !== prev.w) return { w, h }; // поворот экрана
        // Любые изменения одной лишь высоты (клавиатура, адресная
        // строка браузера) игнорируем — фон стоит как вкопанный.
        return prev;
      });
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const blobLayerStyle =
    Platform.OS === "web" && webSize
      ? ({
          position: "fixed",
          top: 0,
          left: 0,
          width: webSize.w,
          height: webSize.h,
          overflow: "hidden",
        } as any)
      : [StyleSheet.absoluteFillObject, { overflow: "hidden" as const }];

  // Размах движения пятен: на вебе — от замороженных размеров (иначе
  // клавиатура дёргала бы траектории), на телефонах — от живых.
  const width = webSize ? webSize.w : liveWidth;
  const height = webSize ? webSize.h : liveHeight;

  return (
    <View style={bgStyles.container}>
      <StatusBar style="dark" />

      <View pointerEvents="none" style={blobLayerStyle}>
        <Blob
          id={`${idPrefix}1`}
          size={380}
          color="#A8D8C0"
          style={{ top: -150, left: -155 }}
          driftX={x1}
          driftY={y1}
          rangeX={width * 0.85}
          rangeY={height * 0.6}
          scaleTo={1.18}
        />
        <Blob
          id={`${idPrefix}2`}
          size={420}
          color="#C2E3CF"
          style={{ top: -45, right: -180 }}
          driftX={x2}
          driftY={y2}
          rangeX={-width * 0.9}
          rangeY={height * 0.5}
          scaleTo={0.9}
        />
        <Blob
          id={`${idPrefix}3`}
          size={400}
          color="#DFEFE3"
          style={{ bottom: -165, left: -150 }}
          driftX={x3}
          driftY={y3}
          rangeX={width * 0.8}
          rangeY={-height * 0.65}
          scaleTo={1.16}
        />
      </View>

      {children}
    </View>
  );
}

const bgStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4FAF4",
    overflow: "hidden",
  },
});
