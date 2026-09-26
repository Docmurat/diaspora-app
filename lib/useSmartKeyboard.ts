import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useKeyboardController } from "react-native-keyboard-controller";

// «Умная клавиатура» (Веха 69 «Клавиатура-2»).
//
// Библиотека react-native-keyboard-controller подключена в app/_layout.tsx
// ВЫКЛЮЧЕННОЙ: пока она выключена, телефон ведёт себя по-старому (pan).
// Экран, который уже переделан под новую клавиатуру (поле липнет к
// клавиатуре, как в Telegram), вызывает useSmartKeyboard() — и библиотека
// включается, пока этот экран на виду, и выключается, когда с него ушли.
//
// Счётчик нужен на случай перехода с одного «умного» экрана на другой:
// порядок событий «ушли / пришли» не гарантирован, поэтому выключаем
// только тогда, когда на виду не осталось ни одного «умного» экрана.
//
// Временная конструкция: в конце вехи библиотека включается для всего
// приложения, а этот помощник удаляется вместе с вызовами.

let activeSmartScreens = 0;

export function useSmartKeyboard() {
  const { setEnabled } = useKeyboardController();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return;
      activeSmartScreens += 1;
      setEnabled(true);
      return () => {
        activeSmartScreens = Math.max(0, activeSmartScreens - 1);
        setEnabled(activeSmartScreens > 0);
      };
    }, [setEnabled]),
  );
}
