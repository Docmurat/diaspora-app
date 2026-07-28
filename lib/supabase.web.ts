import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://insyuvpahjmclpxbvxjp.supabase.co';
const supabaseAnonKey = 'sb_publishable_-KrFp8fJFvcVsXOHiOu5kw_Mu6YKr18';

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