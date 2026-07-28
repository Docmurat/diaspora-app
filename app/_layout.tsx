import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" />
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
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="test-db" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
