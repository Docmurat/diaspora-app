import { Tabs } from "expo-router";

import MingiTabBar from "../../components/MingiTabBar";
// Импорт нужен ради глобального отключения чёрной рамки фокуса в вебе
import "../../components/mingi";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <MingiTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Люди" }} />
      <Tabs.Screen name="help" options={{ title: "Помощь" }} />
      <Tabs.Screen name="knowledge" options={{ title: "Знания" }} />
      <Tabs.Screen name="chats" options={{ title: "Чаты" }} />

      {/* Экраны без кнопки в панели: профиль открывается по аватару вверху,
          избранное позже переедет внутрь вкладки «Люди». */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
    </Tabs>
  );
}
