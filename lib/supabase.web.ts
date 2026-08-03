import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Адрес сервера и публичный ключ берутся из файла .env в корне проекта
// (файла нет в репозитории — см. .env.example). После правки .env
// перезапускать так: npx expo start -c
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Не задан адрес сервера: создайте файл .env в корне проекта по образцу .env.example и перезапустите приложение командой npx expo start -c',
  );
}

const isSSR = typeof window === 'undefined';

const WebStorageAdapter = {
  getItem: (key: string) => {
    if (isSSR) return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isSSR) return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (isSSR) return;
    window.localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: WebStorageAdapter,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
