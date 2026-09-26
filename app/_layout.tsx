import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";

import AccountGuard from "../components/AccountGuard";
import PushBridge from "../components/PushBridge";

// Иммунитет к системному увеличению шрифта («режим для слабовидящих»):
// вёрстка остаётся как нарисована (решение владельца, Веха 66).
// ⚠️ ВАЖНО (Веха 68): приём ниже (defaultProps) УМЕР в React 19 —
// телефон его игнорирует, вёрстка плыла (поймано на APK v2).
// НАСТОЯЩИЙ замок теперь на уровне коробки: plugins/withFixedFontScale.js
// (подключён в app.json) фиксирует масштаб шрифта в Android-активности.
// Строки ниже оставлены как безвредная страховка на старых путях.
// @ts-ignore — defaultProps для Text официально поддерживается в React Native
Text.defaultProps = { ...(Text as any).defaultProps, allowFontScaling: false };
// @ts-ignore
TextInput.defaultProps = {
  ...(TextInput as any).defaultProps,
  allowFontScaling: false,
};

export const unstable_settings = {
  initialRouteName: "index",
};

function AppFrame({ children }: { children: React.ReactNode }) {
  // На телефонах и планшетах — как есть. В браузере на широком экране —
  // колонка шириной с планшет по центру (десктопная вёрстка — в будущем).
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }
  return (
    <View style={styles.webOuter}>
      <View style={styles.webFrame}>{children}</View>
    </View>
  );
}

export default function RootLayout() {
  // KeyboardProvider — библиотека «умной клавиатуры» (Веха 69 «Клавиатура-2»).
  // Стартует ВЫКЛЮЧЕННОЙ (enabled={false}): все экраны пока работают
  // по-старому (pan из app.json). Переделанный экран включает её на время
  // своего показа через useSmartKeyboard() из lib/useSmartKeyboard.ts.
  // В конце вехи — включить для всего приложения и убрать помощника.
  return (
    <KeyboardProvider enabled={false}>
      <ThemeProvider value={DefaultTheme}>
        <AccountGuard />
        <PushBridge />
        <AppFrame>
          {/* animation: "none" — переходы между экранами без анимации
            (в родном приложении по умолчанию включалась системная). */}
          <Stack screenOptions={{ headerShown: false, animation: "none" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="splash" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="help-post" />
            <Stack.Screen name="help-archive" />
            <Stack.Screen name="my-help-posts" />
            <Stack.Screen name="about-project" />
            <Stack.Screen name="new-help-post" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="user-profile" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="change-email" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="request-name-change" />
            <Stack.Screen name="invite" />
            <Stack.Screen name="invites" />
            <Stack.Screen name="request-invite" />
            <Stack.Screen name="pending-approval" />
            <Stack.Screen name="access-restricted" />
            <Stack.Screen name="profile-deleted" />
            <Stack.Screen name="contact-admin" />
            <Stack.Screen name="report-user" />
            <Stack.Screen name="moderation" />
            <Stack.Screen name="moderation-case-details" />
            <Stack.Screen name="moderation-edit-profile" />
            <Stack.Screen name="consent" />
            <Stack.Screen name="memorandum" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="privacy" />
          </Stack>
        </AppFrame>
        <StatusBar style="dark" />
      </ThemeProvider>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#E9EDEB",
  },
  webFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 768,
    backgroundColor: "#FFFFFF",
    ...(Platform.OS === "web"
      ? { boxShadow: "0 0 24px rgba(27, 67, 50, 0.10)" }
      : {}),
  },
});
