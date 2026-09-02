// Служебный рабочий «Минги-Тау» (Веха 65): принимает пуш-уведомления
// и показывает их, даже когда сайт закрыт.
//
// Нарочно НЕ кэширует сайт: только пуши. Обновления сайта приезжают
// как раньше, без сюрпризов со старыми копиями страниц.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  const title = data.title || "Минги-Тау";
  const link = typeof data.link === "string" ? data.link : "/notifications";

  event.waitUntil(
    (async () => {
      // Сайт сейчас на экране и в фокусе — колокольчик уже мигнул,
      // пуш поверх не показываем (решение владельца, Веха 65).
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const siteOnScreen = wins.some(
        (w) => w.focused && w.visibilityState === "visible",
      );
      if (siteOnScreen) return;

      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || undefined,
        data: { link: link },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link =
    (event.notification.data && event.notification.data.link) ||
    "/notifications";

  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      if (wins.length > 0) {
        // Сайт уже открыт: выводим вкладку на экран и просим её саму
        // перейти на нужный экран (слушает components/PushBridge.tsx) —
        // без перезагрузки страницы.
        const win = wins[0];
        try {
          await win.focus();
        } catch (e) {
          // не смогли сфокусировать — не страшно, сообщение всё равно уйдёт
        }
        win.postMessage({ type: "open-link", link: link });
        return;
      }

      await self.clients.openWindow(link);
    })(),
  );
});
