// Мост пушей (Веха 65). Живёт в корне приложения, ничего не рисует.
// Обязанности (только в браузере):
// 1) при старте и при входе тихо обновляет запись подписки в базе;
// 2) при смене языка в настройках переписывает язык подписки —
//    пуши начинают приходить на новом языке;
// 3) при выходе из аккаунта отключает подписку этого браузера;
// 4) принимает от public/sw.js просьбу «открой экран», когда человек
//    нажал на пуш при уже открытом сайте, — переходим без перезагрузки.

import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "../lib/supabase";
import { useLanguage } from "../services/i18nService";
import {
  dropPushOnLogout,
  isPushSupported,
  syncPushSubscription,
} from "../services/pushService";

export default function PushBridge() {
  const lang = useLanguage();

  // Смена языка (и первый запуск): обновляем язык подписки.
  useEffect(() => {
    if (Platform.OS !== "web" || !isPushSupported()) return;
    syncPushSubscription();
  }, [lang]);

  useEffect(() => {
    if (Platform.OS !== "web" || !isPushSupported()) return;

    // Вход/выход из аккаунта.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") syncPushSubscription();
      if (event === "SIGNED_OUT") dropPushOnLogout();
    });

    // Нажатие на пуш при открытом сайте: sw.js просит перейти по ссылке.
    const onMessage = (e: MessageEvent) => {
      const link =
        e && e.data && e.data.type === "open-link" ? e.data.link : null;
      if (typeof link === "string" && link.startsWith("/")) {
        router.push(link as any);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    return () => {
      authListener.subscription.unsubscribe();
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
