// Своя панель вкладок «Минги-Тау».
// Стандартная панель react-navigation подмешивала лишние элементы
// (точки под иконками) и криво считала высоту, поэтому рисуем сами:
// здесь ровно одна иконка на кнопку, без подписей.
//
// Панель — «парящая капсула» (как у Telegram): она лежит ПОВЕРХ экрана
// (position: absolute), контент проезжает под ней, а белая градиентная
// дымка (белый снизу → прозрачный сверху) мягко растворяет его.
// ⚠️ Поэтому у прокручиваемых вкладок в contentContainerStyle стоит
// paddingBottom: 120 — иначе последние строки навсегда спрячутся
// под капсулой.

import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const ACTIVE_COLOR = "#3F6B5B";
const INACTIVE_COLOR = "#A8BDB1";

type TabDef = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

// Порядок кнопок в панели. Экраны, которых здесь нет
// (profile, favorites), кнопку не получают — они открываются иначе.
const TABS: TabDef[] = [
  {
    name: "index",
    label: "Люди",
    icon: "people-outline",
    iconActive: "people",
  },
  {
    name: "help",
    label: "Помощь",
    icon: "megaphone-outline",
    iconActive: "megaphone",
  },
  {
    name: "knowledge",
    label: "Знания",
    icon: "book-outline",
    iconActive: "book",
  },
  {
    name: "chats",
    label: "Чаты",
    icon: "chatbubbles-outline",
    iconActive: "chatbubbles",
  },
];

export default function MingiTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.wrap,
        // Отступ снизу: безопасная зона телефона + воздух под капсулой.
        { paddingBottom: Math.max(insets.bottom, 8) + 10 },
      ]}
      pointerEvents="box-none"
    >
      {/* Градиентная дымка: белый снизу → прозрачный сверху.
          Заполняет всю «полку» панели, нажатия сквозь неё проходят
          к контенту под ней. */}
      <View style={styles.fade} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            {/* id уникальный — по правилу проекта для svg-градиентов в вебе */}
            <LinearGradient id="mingiTabBarFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#mingiTabBarFade)"
          />
        </Svg>
      </View>

      <View style={styles.pill}>
        {TABS.map((tab) => {
          const route = state.routes.find((r) => r.name === tab.name);
          const isActive = activeRouteName === tab.name;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

          const onPress = () => {
            if (!route) return;

            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={26}
                color={color}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // «Полка» панели прибита к низу ПОВЕРХ экрана — контент едет под ней.
  // paddingTop — зона, где дымка тает кверху.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 26,
  },

  // Слой градиентной дымки — растянут на всю «полку».
  fade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Сама парящая капсула.
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",

    // Мягкая тень в фирменном зелёном тоне.
    shadowColor: "#3F6B5B",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 24px rgba(63,107,91,0.18)" } as any)
      : {}),
  },

  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
});
