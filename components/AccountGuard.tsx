// Невидимый «часовой» аккаунта. Подключается один раз в корне приложения
// (app/_layout.tsx) и слушает изменения СВОЕЙ записи в таблице участников.
// Если человека удалили или заблокировали, пока он в приложении, —
// уводит на нужный экран сразу, с любого места, без перезагрузки.
//
// Раньше этим занималась верхняя панель (TopBar), но она стоит не на всех
// экранах: на главной, в карточках и в чате человека не выбрасывало.

import { router, usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { supabase } from "../lib/supabase";

// Свой номер каждому подключению, чтобы имена realtime-каналов не совпадали
// (см. такой же приём в TopBar).
let guardInstanceCounter = 0;

export default function AccountGuard() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let watchedUserId: string | null = null;

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

    const drop = () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.log("Часовой: не удалось отключить канал:", e);
        }
        channel = null;
      }
      watchedUserId = null;
    };

    const subscribeFor = (userId: string) => {
      guardInstanceCounter += 1;
      watchedUserId = userId;

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
