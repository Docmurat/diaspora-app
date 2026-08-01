// Своя панель вкладок «Минги-Тау».
// Стандартная панель react-navigation подмешивала лишние элементы
// (точки под иконками) и криво считала высоту, поэтому рисуем сами:
// здесь ровно одна иконка на кнопку, без подписей.

import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
        styles.bar,
        { paddingBottom: insets.bottom + 6, height: 58 + insets.bottom },
      ]}
    >
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
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(93,140,120,0.18)",
    paddingTop: 6,
  },

  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
});
