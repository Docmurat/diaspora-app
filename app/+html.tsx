// Шаблон HTML-страницы веб-версии «Минги-Тау».
// Подключает манифест PWA, иконки и мета-теги для установки на телефон.

import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>Минги-Тау</title>
        <meta name="description" content="Карачаево-Балкарское сообщество" />
        <meta name="theme-color" content="#F4FAF4" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Минги-Тау" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
