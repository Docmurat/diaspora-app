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
// Сердцебиение «я в сети»: раз в минуту тихо пишем last_seen_at.
// По нему чат показывает «в сети / был(а)…» (веха чата).
const HEARTBEAT_INTERVAL_MS = 60000;

export default function AccountGuard() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let alive = true;
    let watchedUserId: string | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let unsubscribeLive: (() => void) | null = null;

    const handleAccountState = (me: any) => {
      if (!me) return;

      if (me.is_deleted) {
        // Удалённому разрешены ДВА экрана: «Профиль удалён» и обращение
        // к администрации (законный путь просить восстановление в
        // 30-дневном окне). Раньше часовой выбрасывал из contact-admin
        // обратно через ~12 сек — гонка, пойманная казнью Рулона.
        const allowed =
          pathnameRef.current === "/profile-deleted" ||
          pathnameRef.current === "/contact-admin";

        if (!allowed) {
          router.replace("/profile-deleted");
        }
        return;
      }

      if (me.is_blocked) {
        // Заблокированному так же разрешено обращение к администрации
        // (кнопка «Написать администрации» стоит на самом экране).
        const allowed =
          pathnameRef.current === "/access-restricted" ||
          pathnameRef.current === "/contact-admin";

        if (!allowed) {
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

    // Сердцебиение — отдельно от трёх рубежей защиты, их не касается.
    const beat = async (userId: string) => {
      try {
        await supabase
          .from("users")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", userId);
      } catch (e) {
        // не в сети — следующий удар сердца сам всё поправит
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
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
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

      // Сердцебиение: сразу при входе и дальше раз в минуту.
      beat(userId);
      heartbeatTimer = setInterval(() => {
        if (alive && watchedUserId) beat(watchedUserId);
      }, HEARTBEAT_INTERVAL_MS);
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
