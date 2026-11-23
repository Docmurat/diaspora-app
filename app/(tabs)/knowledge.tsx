// Вкладка «Знания» — пилюли Ресурсы · Статьи · Афиша.
// Статьи и Афиша — пока заглушки. РЕСУРСЫ — живой раздел (Веха 71):
// список полезных сервисов карточками (картинка, название, описание,
// адрес и стрелка; карточка целиком открывает ссылку),
// кнопка «Предложить ресурс» у участников, «+» и карандаш — у
// основателя и модераторов.
//
// Правки 10.09.2026 (Веха 67, решения владельца):
//  1) блок заглушки больше НЕ центрируется по вертикали — раньше при
//     разной длине текста заголовок «прыгал» по высоте между пилюлями;
//     теперь всё растёт от фиксированного верхнего уровня;
//  2) внизу — розовый чип «Помогите проекту в развитии» (один в один
//     стиль кнопки «Помочь проекту» с главной), ведёт на экран
//     «О проекте и поддержка»: мягкий намёк, что проекту нужна помощь.
//
// ⚠️ Строки раздела «Ресурсы» — INLINE по lang (ru/en/kb), как в
// Вехе 70; карачаевский утверждён владельцем 23.11 → при следующей
// правке словаря перенести ключами в сводную таблицу переводов.

import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import TopBar from "../../components/TopBar";
import { Glass, Tekmet } from "../../components/mingi";
import { useOnline } from "../../lib/offline";
import { t, useLanguage } from "../../services/i18nService";
import {
  canManageResources,
  getCachedResources,
  getResources,
  isWideImage,
  prettyUrl,
  ResourceItem,
} from "../../services/resourcesService";

// Порядок пилюль: Ресурсы · Статьи · Афиша (решение владельца 23.11 —
// живой раздел первым, заглушки после него).
const SECTIONS = [
  {
    key: "resources",
    label: "know.resources",
    text: "know.resourcesText",
  },
  {
    key: "articles",
    label: "know.articles",
    text: "know.articlesText",
  },
  {
    key: "events",
    label: "know.events",
    text: "know.eventsText",
  },
];

export default function KnowledgeScreen() {
  const lang = useLanguage(); // перерисовка при смене языка
  const insets = useSafeAreaInsets(); // кнопка «+» — над островком вкладок
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [active, setActive] = useState("resources");

  // ── Ресурсы ────────────────────────────────────────────────────────
  // Сначала показываем то, что уже загружали (памятка службы), потом
  // сервер поверх. Ошибка сети НЕ стирает показанное.
  const [resources, setResources] = useState<ResourceItem[]>(
    getCachedResources() || [],
  );
  const [loading, setLoading] = useState(!getCachedResources());
  const [loadFailed, setLoadFailed] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const isOnline = useOnline();
  const activeRef = useRef(active);
  activeRef.current = active;

  // Строки раздела на трёх языках (карачаевский утверждён владельцем 23.11).
  const L = (ru: string, en: string, kb?: string) =>
    lang === "en" ? en : lang === "kb" && kb ? kb : ru;

  const loadResources = useCallback(async () => {
    try {
      const list = await getResources();
      setResources(list);
      setLoadFailed(false);
    } catch (e) {
      console.log("Ошибка загрузки ресурсов:", e);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Заход на вкладку и возврат с экранов «Добавить» / «Предложить» —
  // список освежается, если открыта пилюля «Ресурсы».
  useFocusEffect(
    useCallback(() => {
      if (activeRef.current === "resources") loadResources();
    }, [loadResources]),
  );

  // Переключились на пилюлю «Ресурсы» — грузим.
  useEffect(() => {
    if (active === "resources") loadResources();
  }, [active, loadResources]);

  // Сеть вернулась — тихая перезагрузка (как в Людях и на Стене).
  useEffect(() => {
    if (isOnline && loadFailed && activeRef.current === "resources") {
      loadResources();
    }
  }, [isOnline, loadFailed, loadResources]);

  // Кто я: основателю и модераторам — «+» и карандаш на карточках.
  useEffect(() => {
    let alive = true;
    canManageResources().then((ok) => {
      if (alive) setCanManage(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const openResource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.log("Не удалось открыть ссылку:", e);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  const current = SECTIONS.find((s) => s.key === active) || SECTIONS[0];
  const isResources = active === "resources";

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TopBar />

      <View style={styles.pillsRow}>
        {SECTIONS.map((section) => {
          const isActive = section.key === active;

          return (
            <TouchableOpacity
              key={section.key}
              activeOpacity={0.85}
              onPress={() => setActive(section.key)}
              style={[styles.pill, isActive && styles.pillActive]}
            >
              <Text
                style={[styles.pillText, isActive && styles.pillTextActive]}
              >
                {t(section.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isResources ? (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {loadFailed && resources.length > 0 && (
            <Text style={styles.offlineNote}>
              {L(
                "Без сети — показан сохранённый список",
                "Offline — showing the saved list",
                "Сеть джокъду — сакъланнган список кёргюзюледи",
              )}
            </Text>
          )}

          {loading && resources.length === 0 && (
            <ActivityIndicator
              color="#69B78D"
              style={{ marginTop: 40 }}
              size="small"
            />
          )}

          {!loading && resources.length === 0 && (
            <View style={styles.emptyWrap}>
              <Tekmet style={styles.emptyTekmet} />
              <Text style={styles.emptyText}>
                {loadFailed
                  ? L(
                      "Не удалось загрузить список. Проверьте соединение.",
                      "Could not load the list. Check your connection.",
                      "Список джюкленмеди. Интернетге къарагъыз.",
                    )
                  : L(
                      "Здесь будут полезные сервисы и проекты. Знаете такой — предложите его.",
                      "Useful services and projects will appear here. Know one? Suggest it.",
                      "Мында хайырлы сервисле бла проектле боллукъдула. Аллайны биле эсегиз — теджегиз.",
                    )}
              </Text>
            </View>
          )}

          {resources.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openResource(item.url)}
            >
              {/* Широкая картинка (горизонтальный логотип) — небольшой
                  полосой над названием, у левого края. */}
              {isWideImage(item.image_url) && (
                <Image
                  source={{ uri: item.image_url as string }}
                  style={styles.cardImageWide}
                />
              )}

              <View style={styles.cardRow}>
                {/* Квадратная картинка — слева от текста. Стрелка — знак
                  «откроется сайт». */}
                {!!item.image_url && !isWideImage(item.image_url) && (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.cardImage}
                  />
                )}

                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{item.title}</Text>

                    {canManage && (
                      <TouchableOpacity
                        hitSlop={10}
                        activeOpacity={0.7}
                        onPress={() =>
                          router.push({
                            pathname: "/resource-edit" as any,
                            params: { id: item.id },
                          })
                        }
                        style={styles.editButton}
                      >
                        <Feather name="edit-2" size={16} color="#96AC9E" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.cardText}>{item.description}</Text>

                  <View style={styles.cardBottom}>
                    <Text style={styles.cardUrl} numberOfLines={1}>
                      {prettyUrl(item.url)}
                    </Text>

                    <Feather name="arrow-up-right" size={20} color="#69B78D" />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Предложить ресурс — уходит администрации обращением. */}
          {!loading && (
            <View style={styles.suggestWrap}>
              {resources.length > 0 && (
                <Text style={styles.suggestHint}>
                  {L(
                    "Знаете полезный сервис, которого здесь нет?",
                    "Know a useful service that is not listed here?",
                    "Мында болмагъан хайырлы сервисни билемисиз?",
                  )}
                </Text>
              )}

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/suggest-resource" as any)}
                style={styles.suggestButton}
              >
                <Feather name="send" size={15} color="#3F6B5B" />
                <Text style={styles.suggestButtonText}>
                  {L(
                    "Предложить ресурс",
                    "Suggest a resource",
                    "Ресурс теджерге",
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && resources.length > 0 && (
            <Tekmet style={styles.footerTekmet} />
          )}
        </ScrollView>
      ) : (
        /* Раньше justifyContent:"center" ронял заголовок на разную
           высоту (тексты у разделов разной длины). Теперь блок растёт
           сверху — заголовок у обеих заглушек на одном уровне. */
        <View style={styles.center}>
          <Text style={styles.title}>{t(current.label)}</Text>
          <Text style={styles.subtitle}>{t("know.soon")}</Text>

          <Tekmet style={styles.tekmet} />

          <Text style={styles.text}>{t(current.text)}</Text>

          {/* Розовый чип поддержки — как на главной, ведёт в
              «О проекте и поддержка».
              ⚠️ Текст по-русски на всех языках — ключ в сводную таблицу
              переводов при следующей правке (как заглушки демо). */}
          <TouchableOpacity
            onPress={() => router.push("/about-project" as any)}
            activeOpacity={0.85}
            style={styles.supportButton}
          >
            <Glass
              radius={999}
              tintColor="rgba(247,205,216,0.55)"
              borderColor="rgba(219,143,163,0.65)"
              borderWidth={1}
            >
              <View style={styles.supportInner}>
                <Ionicons name="heart-outline" size={16} color="#A85A72" />
                <Text style={styles.supportText}>
                  Помогите проекту в развитии
                </Text>
              </View>
            </Glass>
          </TouchableOpacity>
        </View>
      )}

      {/* Новый ресурс — плавающая кнопка над капсулой вкладок (как «+»
          на Стене). Только основатель и модераторы. */}
      {isResources && canManage && (
        <TouchableOpacity
          style={[styles.fabShadow, { bottom: 104 + insets.bottom }]}
          activeOpacity={0.85}
          onPress={() => router.push("/resource-edit" as any)}
        >
          <Glass
            radius={26}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.fabInner}>
              <Feather name="plus" size={24} color="#FFFFFF" />
            </View>
          </Glass>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBg: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },

  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
  },

  pillActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(255,255,255,0.85)",
  },

  pillText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  pillTextActive: {
    color: "#FFFFFF",
  },

  // Фиксированный верхний отступ вместо вертикального центрирования —
  // заголовок всегда на одном уровне (решение владельца 10.09).
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 40,
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
    marginBottom: 16,
  },

  text: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    maxWidth: 340,
  },

  // Розовый чип поддержки — стиль кнопки «Помочь проекту» с главной.
  supportButton: {
    alignSelf: "center",
    marginTop: 28,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  supportInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },

  supportText: {
    color: "#A85A72",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Ресурсы ────────────────────────────────────────────────────────

  listScroll: {
    flex: 1,
  },

  // paddingBottom 120 — правило проекта: контент не должен навсегда
  // спрятаться под парящей капсулой вкладок.
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },

  offlineNote: {
    fontSize: 12,
    color: "#96AC9E",
    textAlign: "center",
    marginBottom: 10,
  },

  emptyWrap: {
    alignItems: "center",
    marginTop: 44,
    paddingHorizontal: 12,
  },

  emptyTekmet: {
    marginBottom: 16,
  },

  emptyText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: "#7E988B",
    textAlign: "center",
    maxWidth: 340,
  },

  // Карточка ресурса — белая, по правилу списков (как пост Стены).
  card: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  // Широкая картинка 3:1 (900×300) — небольшой полосой над названием,
  // у левого края (решение владельца 23.11: во всю ширину карточки
  // было слишком крупно).
  cardImageWide: {
    width: 150,
    height: 50,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#EAF4EE",
  },

  // Картинка ресурса — квадрат со скруглением (кадрируется при
  // добавлении, 512×512).
  cardImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: "#EAF4EE",
  },

  cardBody: {
    flex: 1,
    minWidth: 0,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16.5,
    fontWeight: "600",
    color: "#2F4A3C",
  },

  editButton: {
    marginLeft: 10,
    paddingTop: 2,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  cardText: {
    fontSize: 14.5,
    lineHeight: 21,
    color: "#4E7364",
    marginTop: 6,
  },

  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  cardUrl: {
    flex: 1,
    minWidth: 0,
    fontSize: 12.5,
    color: "#96AC9E",
    marginRight: 10,
  },

  suggestWrap: {
    alignItems: "center",
    marginTop: 14,
  },

  suggestHint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#7E988B",
    textAlign: "center",
    marginBottom: 10,
  },

  // Кнопка secondary: белая, абрис, текст #3F6B5B.
  suggestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "#FFFFFF",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  suggestButtonText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  footerTekmet: {
    alignSelf: "center",
    marginTop: 18,
  },

  // Кнопка «+» — над капсулой вкладок, чтобы не спорить с ней.
  fabShadow: {
    position: "absolute",
    right: 24,
    bottom: 104,
    borderRadius: 26,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 30,
  },

  fabInner: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
});
