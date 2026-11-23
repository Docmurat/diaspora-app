// «Предложить ресурс» (Веха 71). Участник пишет администрации о
// сервисе, которого ещё нет в разделе «Ресурсы».
//
// Механика — готовый конвейер «Обращения» (как «Связаться с
// администрацией»): предложение ложится карточкой в модерацию в
// «Новое», основатель и модераторы получают уведомление и пуш,
// ответ приходит участнику в колокольчик, переписка видна на экране
// «Связаться с администрацией». Если у человека уже есть открытое
// обращение — предложение допишется в него (правило «одна переписка —
// одна карточка»).
//
// ⚠️ Строки экрана — INLINE по lang (ru/en/kb), как в Вехе 70;
// карачаевский утверждён владельцем 23.11 → потом ключами в сводную
// таблицу. «В демо-режиме…» — без карачаевского (как в chat.tsx).

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, Tekmet } from "../components/mingi";
import { amIDemo } from "../lib/demoData";
import { t, useLanguage } from "../services/i18nService";
import {
  normalizeUrl,
  RESOURCE_TITLE_MAX,
  suggestResource,
} from "../services/resourcesService";

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

export default function SuggestResourceScreen() {
  const lang = useLanguage(); // перерисовка при смене языка
  const insets = useSafeAreaInsets(); // «Назад» на одном уровне со всеми экранами
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const L = (ru: string, en: string, kb?: string) =>
    lang === "en" ? en : lang === "kb" && kb ? kb : ru;

  useEffect(() => {
    amIDemo().then(setIsDemo);
  }, []);

  const formValid = !!title.trim() && !!comment.trim();

  const handleSend = async () => {
    if (isDemo) {
      setError(
        L(
          "В демо-режиме отправка отключена",
          "Sending is disabled in demo mode",
        ),
      );
      return;
    }

    if (!formValid) {
      setError(t("feedback.error.fill"));
      return;
    }

    if (url.trim() && !normalizeUrl(url)) {
      setError(
        L(
          "Проверьте ссылку: нужен адрес сайта, например site.ru",
          "Check the link: a website address is needed, e.g. site.com",
          "Ссылкагъа къарагъыз: сайтны адреси керекди, сёз ючюн site.ru",
        ),
      );
      return;
    }

    try {
      setSending(true);
      setError("");

      await suggestResource({ title, url, comment });

      setSuccess(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("feedback.error.send");
      setError(msg);
      Alert.alert(t("common.error"), msg);
    } finally {
      setSending(false);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.screen} />;
  }

  if (success) {
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" />

        <View style={styles.successContent}>
          <Text style={styles.title}>{t("feedback.sent.title")}</Text>
          <Text style={styles.subtitle}>{t("common.brandCaps")}</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.text}>
            {L(
              "Спасибо! Администрация рассмотрит предложение. Ответ придёт в уведомления.",
              "Thank you! The administration will review your suggestion. The reply will arrive in your notifications.",
              "Сау болугъуз! Администрация теджеуге къарар. Джууаб уведомлениелеге келир.",
            )}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.primaryShadow}
          >
            <Glass
              radius={18}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.buttonInner}>
                <Text style={styles.primaryButtonText}>
                  {t("report.return")}
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {/* «Назад» сверху, на одном уровне со всеми экранами (Веха 65);
          в приложении скрыта — там системная кнопка (Веха 66). */}
      {Platform.OS === "web" && (
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={[styles.backLink, { top: insets.top + 10 }]}
        >
          <Text style={styles.backLinkText}>{t("common.backArrow")}</Text>
        </TouchableOpacity>
      )}

      {/* Образец Вехи 69: центрированная форма, прокрутка сама следит
          за клавиатурой, тап по пустому месту её прячет. */}
      <KeyboardAwareScrollView
        style={styles.keyboardWrap}
        contentContainerStyle={styles.container}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {L("Предложить ресурс", "Suggest a resource", "Ресурс теджерге")}
        </Text>
        <Text style={styles.subtitle}>{t("common.brandCaps")}</Text>

        <Tekmet style={styles.tekmet} />

        <Text style={styles.text}>
          {L(
            "Расскажите о сервисе или проекте, которого ещё нет в разделе. Администрация посмотрит и ответит вам в уведомлениях.",
            "Tell us about a service or project that is not in this section yet. The administration will take a look and reply in your notifications.",
            "Бу бёлюмде алкъын болмагъан сервисни неда проектни юсюнден джазыгъыз. Администрация къарар, джууаб уведомлениелеге келир.",
          )}
        </Text>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError("");
            }}
            placeholder={L("Название *", "Name *", "Аты *")}
            placeholderTextColor="#8FA79A"
            maxLength={RESOURCE_TITLE_MAX}
          />
        </Glass>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setError("");
            }}
            placeholder={L(
              "Ссылка, если есть",
              "Link, if any",
              "Ссылка, бар эсе",
            )}
            placeholderTextColor="#8FA79A"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Glass>

        <Glass {...glassInputProps} style={styles.inputWrap}>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={comment}
            onChangeText={(text) => {
              setComment(text);
              setError("");
            }}
            placeholder={L(
              "Что это и чем полезно *",
              "What it is and why it is useful *",
              "Бу неди эмда не хайыры барды *",
            )}
            placeholderTextColor="#8FA79A"
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
        </Glass>

        <Text style={styles.requiredHint}>{t("register.requiredHint")}</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSend}
          disabled={sending || !formValid}
          style={[
            styles.primaryShadow,
            (sending || !formValid) && styles.disabled,
          ]}
        >
          <Glass
            radius={18}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.buttonInner}>
              <Text style={styles.primaryButtonText}>
                {sending ? t("common.sending") : t("feedback.submit")}
              </Text>
            </View>
          </Glass>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  backLinkText: {
    fontSize: 15,
    color: "#96AC9E",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardWrap: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  successContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  title: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 34,
    color: "#3F6B5B",
    textAlign: "center",
  },

  subtitle: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 13.5,
    letterSpacing: 2.5,
    color: "#719686",
    textAlign: "center",
    marginTop: 8,
  },

  tekmet: {
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 18,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 20,
  },

  inputWrap: {
    marginBottom: 12,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  textArea: {
    height: 120,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
  },

  requiredHint: {
    fontSize: 12.5,
    color: "#96AC9E",
    marginBottom: 12,
    marginLeft: 4,
  },

  error: {
    color: "#C05B4D",
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },

  primaryShadow: {
    marginTop: 8,
    borderRadius: 18,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  buttonInner: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.7,
  },
});
