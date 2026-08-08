// Живое обновление экранов: база сама сообщает об изменениях,
// приложение не переспрашивает её по таймеру.
//
// ВАЖНО: это единственное место в проекте, где используется механизм
// трансляции изменений Supabase (Realtime). Экраны знают только функцию
// subscribeToChanges — при любых переменах на сервере переписывается
// только этот файл.
//
// САМОЛЕЧЕНИЕ (Веха 41): подписки на сервере иногда падают
// (CHANNEL_ERROR / TIMED_OUT / CLOSED — видно в журнале realtime как
// subscription_errors и «Killing transport pids»). Теперь служба сама
// пересоздаёт канал с паузой (3 секунды, при повторных сбоях пауза
// растёт до 30 секунд, после успеха сбрасывается). После восстановления
// связи вызывается onChange — экран перечитывает данные и «догоняет»
// всё, что пропустил за время обрыва.
//
// ⚠️ КАПКАН (пойман живым тестом): выброшенный канал перед смертью
// кричит «CLOSED». Если слушать все каналы подряд, служба принимает
// предсмертный крик СВОЕГО ЖЕ выброшенного канала за новую поломку и
// заводит замену по кругу до бесконечности. Поэтому служба помнит,
// какой канал действующий, и слушает только его.
//
// ИМЕНА КАНАЛОВ: служба сама добавляет к имени сквозной номер, поэтому
// каждый канал гарантированно уникален. Капкан «cannot add
// postgres_changes callbacks after subscribe()» (Веха 29) больше
// невозможен — экранам не нужно самим выдумывать уникальные имена.

import { supabase } from "../lib/supabase";

type Subscription = {
  table: string;
  // Слушать не всю таблицу, а одну строку: { column: "id", value: "..." }
  filter?: { column: string; value: string };
};

// Пауза перед первой повторной попыткой и потолок паузы.
const RETRY_START_MS = 3000;
const RETRY_MAX_MS = 30000;

// Сквозной номер для уникальности имён каналов.
let liveChannelCounter = 0;

/**
 * Подписывает экран на изменения нужных таблиц.
 * Возвращает функцию отписки — её обязательно вызвать при уходе с экрана.
 */
export function subscribeToChanges(
  channelName: string,
  subscriptions: Subscription[],
  onChange: () => void,
): () => void {
  let stopped = false; // экран ушёл — больше ничего не делаем
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = RETRY_START_MS;
  let hadTrouble = false; // был обрыв — после восстановления догнать пропущенное

  const dropChannel = () => {
    // Сначала вычёркиваем канал из действующих, потом выбрасываем:
    // его предсмертный «CLOSED» придёт уже вычеркнутому — и будет
    // проигнорирован (см. проверку в подписке).
    const old = channel;
    channel = null;

    if (old) {
      try {
        supabase.removeChannel(old);
      } catch (e) {
        // канал мог уже умереть сам — не страшно
      }
    }
  };

  // Назначить повторную попытку (если она ещё не назначена).
  const scheduleRestart = () => {
    if (stopped || retryTimer) return;

    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (stopped) return;
      dropChannel();
      // Следующая пауза — вдвое длиннее, но не больше потолка.
      retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
      start();
    }, retryDelayMs);
  };

  const start = () => {
    if (stopped) return;

    liveChannelCounter += 1;
    const uniqueName = `${channelName}-${liveChannelCounter}`;

    try {
      let freshChannel = supabase.channel(uniqueName);

      subscriptions.forEach((item) => {
        freshChannel = freshChannel.on(
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
            if (!stopped) onChange();
          },
        );
      });

      channel = freshChannel;
      // Запоминаем «свой» канал: если к моменту прихода статуса он уже
      // не действующий (его выбросили при замене) — статус игнорируем.
      const myChannel = freshChannel;

      freshChannel.subscribe((status: string, err?: Error) => {
        if (stopped || channel !== myChannel) return;

        if (status === "SUBSCRIBED") {
          retryDelayMs = RETRY_START_MS; // связь есть — паузу к началу

          if (hadTrouble) {
            hadTrouble = false;
            console.log(
              `Живой эфир: канал «${channelName}» восстановлен, догоняем пропущенное`,
            );
            // Пока связи не было, события могли пройти мимо —
            // просим экран перечитать данные.
            onChange();
          } else {
            console.log(`Живой эфир: канал «${channelName}» подключён`);
          }
          return;
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          hadTrouble = true;
          console.log(
            `Живой эфир: канал «${channelName}» — статус ${status}, ` +
              `переподключение через ${Math.round(retryDelayMs / 1000)} с`,
            err?.message || "",
          );
          scheduleRestart();
        }
      });
    } catch (e) {
      hadTrouble = true;
      console.log(`Живой эфир: канал «${channelName}» не запустился:`, e);
      scheduleRestart();
    }
  };

  start();

  return () => {
    stopped = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    dropChannel();
  };
}
