// Живое обновление экранов: база сама сообщает об изменениях,
// приложение не переспрашивает её по таймеру.
//
// ВАЖНО ПРО ПЕРЕЕЗД НА ЯНДЕКС: это единственное место в проекте, где
// используется механизм трансляции изменений Supabase (Realtime).
// При переезде переписывается ТОЛЬКО этот файл — экраны трогать не нужно,
// они работают через функцию subscribeToChanges.
// Если на новом сервере трансляции не будет, здесь же можно вернуть
// опрос по таймеру: снаружи ничего не изменится.

import { supabase } from "../lib/supabase";

type Subscription = {
  table: string;
  // Слушать не всю таблицу, а одну строку: { column: "id", value: "..." }
  filter?: { column: string; value: string };
};

/**
 * Подписывает экран на изменения нужных таблиц.
 * Возвращает функцию отписки — её обязательно вызвать при уходе с экрана.
 */
export function subscribeToChanges(
  channelName: string,
  subscriptions: Subscription[],
  onChange: () => void,
): () => void {
  let channel: ReturnType<typeof supabase.channel> | null = null;

  try {
    channel = supabase.channel(channelName);

    subscriptions.forEach((item) => {
      channel = channel!.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: item.table,
          ...(item.filter
            ? { filter: `${item.filter.column}=eq.${item.filter.value}` }
            : {}),
        },
        () => {
          onChange();
        },
      );
    });

    // Подписываемся и честно докладываем результат: раньше отказ сервера
    // проглатывался молча, и живое обновление «умирало» незаметно.
    channel.subscribe((status: string, err?: Error) => {
      if (status === "SUBSCRIBED") {
        console.log(`Живой эфир: канал «${channelName}» подключён`);
      } else {
        console.log(
          `Живой эфир: канал «${channelName}» — статус ${status}`,
          err?.message || "",
        );
      }
    });
  } catch (e) {
    console.log("Не удалось подписаться на изменения:", e);
  }

  return () => {
    try {
      if (channel) supabase.removeChannel(channel);
    } catch (e) {
      console.log("Не удалось отписаться от изменений:", e);
    }
  };
}
