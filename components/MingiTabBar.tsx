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
//
// МЕТКА НА «ЧАТАХ» (закрытие п.6, хвост Вехи 47): зелёный кружок с
// суммарным числом непрочитанных. Живёт на liveService: слушает
// messages (пришло новое) и СВОЮ строку chat_participants (я прочитал
// чат — last_read_at сдвинулся, метка гаснет). Счёт — лёгкая функция
// getTotalUnread из chatService; при любой ошибке метка просто 0.

import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { supabase } from "../lib/supabase";
import { getTotalUnread } from "../services/chatService";
import { subscribeToChanges } from "../services/liveService";

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

  // Суммарное число непрочитанных для метки на вкладке «Чаты».
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    let alive = true; // панель размонтировали — ничего не трогаем
    let unsubscribe: (() => void) | null = null;

    const refresh = async () => {
      const total = await getTotalUnread();
      if (alive) setUnreadTotal(total);
    };

    (async () => {
      // Первый счёт сразу при появлении панели.
      refresh();

      // Для подписки на СВОЮ строку chat_participants нужен свой id.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!alive || !user?.id) return;

      unsubscribe = subscribeToChanges(
        "tabbar-unread",
        [
          { table: "messages" },
          {
            table: "chat_participants",
            filter: { column: "user_id", value: user.id },
          },
        ],
        refresh,
      );
    })();

    return () => {
      alive = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

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

          const showBadge = tab.name === "chats" && unreadTotal > 0;

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={
                showBadge
                  ? `${tab.label}, непрочитанных: ${unreadTotal}`
                  : tab.label
              }
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={26}
                  color={color}
                />

                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </Text>
                  </View>
                )}
              </View>
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

  // Обёртка иконки — точка привязки метки (position: relative по умолчанию).
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  // Зелёный кружок с числом — в тон меткам списка чатов.
  badge: {
    position: "absolute",
    top: -5,
    right: -11,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "rgba(105,183,141,1)",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
