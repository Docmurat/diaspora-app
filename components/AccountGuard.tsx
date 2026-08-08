// Невидимый «часовой» аккаунта. Подключается один раз в корне приложения
// (app/_layout.tsx) и следит за СВОЕЙ записью в таблице участников.
// Если человека удалили или заблокировали — уводит на нужный экран
// сразу, с любого места.
//
// Три рубежа защиты (Веха 40 — НЕ упрощать):
// 1) осмотр сразу при входе/перезагрузке (раньше его не было — после F5
//    удалённый оставался внутри);
// 2) живые обновления — с Вехи 41 через общую службу liveService:
//    при обрыве связи она сама переподключается и вызывает проверку;
// 3) тихий опрос раз в 12 секунд — страховка на случай, если живое
//    событие не дошло (как запасная проверка на экране ожидания).

import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { supabase } from "../lib/supabase";
import { subscribeToChanges } from "../services/liveService";

const POLL_INTERVAL_MS = 12000;

export default function AccountGuard() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let alive = true;
    let watchedUserId: string | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let unsubscribeLive: (() => void) | null = null;

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
      if (unsubscribeLive) {
        unsubscribeLive();
        unsubscribeLive = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      watchedUserId = null;
    };

    const subscribeFor = (userId: string) => {
      watchedUserId = userId;

      // Рубеж 1: осмотр сразу — важно после перезагрузки страницы.
      checkNow(userId);

      // Рубеж 2: живые обновления через liveService. Пришло событие
      // (или связь восстановилась после обрыва) — перечитываем свою
      // запись из базы и решаем, куда вести человека.
      unsubscribeLive = subscribeToChanges(
        "account-guard",
        [{ table: "users", filter: { column: "id", value: userId } }],
        () => {
          if (alive && watchedUserId) checkNow(watchedUserId);
        },
      );

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
