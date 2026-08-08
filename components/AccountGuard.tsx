// Невидимый «часовой» аккаунта. Подключается один раз в корне приложения
// (app/_layout.tsx) и следит за СВОЕЙ записью в таблице участников.
// Если человека удалили или заблокировали — уводит на нужный экран
// сразу, с любого места.
//
// Три рубежа защиты:
// 1) осмотр сразу при входе/перезагрузке (раньше его не было — после F5
//    удалённый оставался внутри);
// 2) живые обновления (мгновенно, когда сервер их доставляет);
// 3) тихий опрос раз в 12 секунд — страховка на случай, если живое
//    событие не дошло (как запасная проверка на экране ожидания).

import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { supabase } from "../lib/supabase";

// Свой номер каждому подключению, чтобы имена realtime-каналов не совпадали
// (см. такой же приём в TopBar).
let guardInstanceCounter = 0;

const POLL_INTERVAL_MS = 12000;

export default function AccountGuard() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let watchedUserId: string | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const handleAccountState = (me: any) => {
      if (!me) return;

      if (me.is_deleted) {
        if (pathnameRef.current !== "/profile-deleted") {
          router.replace("/profile-deleted");
        }
        return;
      }

      if (me.is_blocked) {
        if (pathnameRef.current !== "/access-restricted") {
          router.replace("/access-restricted");
        }
      }
    };

    const checkNow = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("users")
          .select("id, is_deleted, is_blocked")
          .eq("id", userId)
          .maybeSingle();

        if (alive && data) handleAccountState(data);
      } catch (e) {
        console.log("Часовой: проверка не удалась:", e);
      }
    };

    const drop = () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.log("Часовой: не удалось отключить канал:", e);
        }
        channel = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      watchedUserId = null;
    };

    const subscribeFor = (userId: string) => {
      guardInstanceCounter += 1;
      watchedUserId = userId;

      // Рубеж 1: осмотр сразу — важно после перезагрузки страницы.
      checkNow(userId);

      // Рубеж 2: живые обновления.
      channel = supabase
        .channel(`account-guard-${userId}-${guardInstanceCounter}`)
        .on(
          "postgres_changes" as any,
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${userId}`,
          },
          (payload: any) => {
            if (alive) handleAccountState(payload.new);
          },
        )
        .subscribe();

      // Рубеж 3: тихий опрос-страховка.
      pollTimer = setInterval(() => {
        if (alive && watchedUserId) checkNow(watchedUserId);
      }, POLL_INTERVAL_MS);
    };

    // Следим за входом/выходом: при входе подписываемся на свою запись,
    // при выходе отписываемся. Начальное состояние onAuthStateChange
    // сообщает сам, отдельно спрашивать не нужно.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!alive) return;

        const userId = session?.user?.id || null;

        // Тот же человек — подписка уже стоит, не пересоздаём
        // (события обновления токена приходят регулярно).
        if (userId === watchedUserId) return;

        drop();
        if (userId) subscribeFor(userId);
      },
    );

    return () => {
      alive = false;
      drop();
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
