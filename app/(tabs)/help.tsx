// Вкладка «Помощь» — лента Стены помощи (Вехи 52, 54).
// Карточки с чипами (категория + Вопрос/Предложение), окно фильтра по
// категориям, плавающая кнопка нового поста. При входе на вкладку пишем
// help_seen_at — точка на вкладке гаснет.
// Веха 54: фильтр — ПРОСТО фильтр ленты (запоминается, ни на что не
// влияет). Рядом — шестерёнка «Уведомления»: какие категории важны
// (точка + колокольчик) и включён ли колокольчик. Две настройки
// независимы; по умолчанию у всех «все категории» и колокольчик включён.
// «Где новое»: карточки важных постов новее прошлого захода помечены
// зелёной точкой; если фильтр их прячет — точка на кнопке фильтра, точки
// на чипах и строка «Новое в: …» (нажатие переключает фильтр). Точка на
// вкладке гаснет ТОЛЬКО когда лента с текущим фильтром показала новое.
// Веха 56: карточка вынесена в components/HelpPostCard (общая с архивом);
// справа от колокольчика — кнопка архива → /help-archive (поиск).

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
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import HelpPostCard from "../../components/HelpPostCard";
import TopBar from "../../components/TopBar";
import { Glass, Tekmet } from "../../components/mingi";
import {
  HELP_CATEGORIES,
  HelpFeedItem,
  getHelpFeed,
  getMyHelpSettings,
  getUnseenHelpInfo,
  markHelpSeen,
  saveMyHelpFilter,
  saveMyHelpNotifySettings,
} from "../../services/helpService";
import { subscribeToChanges } from "../../services/liveService";

export default function HelpScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [posts, setPosts] = useState<HelpFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<string[]>([]);
  const [filterLoaded, setFilterLoaded] = useState(false);

  // «Где новое»: момент прошлого захода и категории с новыми важными
  // постами. seenRef держит момент до тех пор, пока не погасим точку —
  // иначе после markHelpSeen карточки мгновенно перестали бы быть «новыми».
  const [unseenCats, setUnseenCats] = useState<string[]>([]);
  const seenRef = useRef<string | null>(null);
  const seenLoadedRef = useRef(false);
  // Открытые на этой вкладке посты — у них метка «новое» гаснет сразу.
  const [openedIds, setOpenedIds] = useState<string[]>([]);

  // Настройки уведомлений (Веха 54): важные категории и колокольчик.
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyCategories, setNotifyCategories] = useState<string[]>([]);
  const [notifyNewPosts, setNotifyNewPosts] = useState(true);

  // Свежий фильтр для перезагрузок из подписки (замыкание не устаревает).
  const filterRef = useRef<string[]>([]);
  filterRef.current = filter;

  const loadFeed = useCallback(async (categories: string[]) => {
    try {
      const feed = await getHelpFeed(categories);
      setPosts(feed);

      // Где новое (по важным категориям), затем — умное гашение точки:
      // гасим только если текущий фильтр показывает ВСЕ категории с новым.
      const info = await getUnseenHelpInfo();
      if (!seenLoadedRef.current) {
        // Момент прошлого захода запоминаем ОДИН раз за визит; при живых
        // обновлениях (и после markHelpSeen) не трогаем — иначе метка
        // «новое» слетала бы с непрочитанных постов при каждом новом.
        seenRef.current = info.seenAt;
        seenLoadedRef.current = true;
      }
      setUnseenCats(info.categories);

      const shownAll =
        info.categories.length > 0 &&
        (categories.length === 0 ||
          info.categories.every((c) => categories.includes(c)));

      if (shownAll) {
        // Точка на вкладке гаснет; карточки остаются «новыми» до ухода
        // с вкладки (seenRef не трогаем).
        markHelpSeen();
      }
    } catch (e) {
      console.log("Ошибка загрузки Стены помощи:", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // При входе на вкладку: гасим точку, тянем фильтр и ленту.
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        let categories = filterRef.current;

        if (!filterLoaded) {
          try {
            const settings = await getMyHelpSettings();
            categories = settings.filterCategories;
            if (alive) {
              setFilter(categories);
              setNotifyCategories(settings.notifyCategories);
              setNotifyNewPosts(settings.notifyNewPosts);
              setFilterLoaded(true);
            }
          } catch {
            categories = [];
          }
        }

        if (alive) loadFeed(categories);
      })();

      return () => {
        alive = false;
        // Ушёл с вкладки — при следующем заходе «новизна» считается заново.
        seenLoadedRef.current = false;
        setOpenedIds([]);
      };
    }, [filterLoaded, loadFeed]),
  );

  // Переключить фильтр на категории с новым (нажатие на строку «Новое в»).
  const showUnseen = () => {
    if (unseenCats.length === 0) return;
    const next = [...unseenCats];
    setFilter(next);
    setLoading(true);
    loadFeed(next);
    saveMyHelpFilter(next).catch(() => {});
  };

  // Живая лента: новый пост появляется сам, без кнопки «Обновить».
  useEffect(() => {
    const unsubscribe = subscribeToChanges(
      "help-feed",
      [{ table: "help_posts" }],
      () => loadFeed(filterRef.current),
    );

    return unsubscribe;
  }, [loadFeed]);

  const toggleCategory = (category: string) => {
    const next = filter.includes(category)
      ? filter.filter((c) => c !== category)
      : [...filter, category];

    setFilter(next);
    setLoading(true);
    loadFeed(next);

    // Сохраняем тихо: просто чтобы фильтр помнился между заходами.
    saveMyHelpFilter(next).catch((e) =>
      console.log("Фильтр не сохранился:", e),
    );
  };

  // Настройки уведомлений — сохраняем тихо при каждом изменении.
  const persistNotify = (categories: string[], bell: boolean) => {
    saveMyHelpNotifySettings(categories, bell).catch((e) =>
      console.log("Настройки уведомлений не сохранились:", e),
    );
  };

  const toggleNotifyCategory = (category: string) => {
    const next = notifyCategories.includes(category)
      ? notifyCategories.filter((c) => c !== category)
      : [...notifyCategories, category];
    setNotifyCategories(next);
    persistNotify(next, notifyNewPosts);
  };

  const setNotifyAll = () => {
    setNotifyCategories([]);
    persistNotify([], notifyNewPosts);
  };

  const toggleBell = () => {
    const next = !notifyNewPosts;
    setNotifyNewPosts(next);
    persistNotify(notifyCategories, next);
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  // Категории с новым, которые текущий фильтр не показывает.
  const hiddenUnseen =
    filter.length === 0 ? [] : unseenCats.filter((c) => !filter.includes(c));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TopBar />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок «Стена помощи» убран по решению владельца — больше
            света; остаётся только подзаголовок. */}
        <Text style={styles.subtitle}>ВОПРОСЫ · ПРЕДЛОЖЕНИЯ</Text>

        {/* Кнопка фильтра + шестерёнка уведомлений */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.8}
            onPress={() => {
              setFilterOpen((v) => !v);
              setNotifyOpen(false);
            }}
          >
            <Ionicons
              name={filterOpen ? "options" : "options-outline"}
              size={17}
              color="#3F6B5B"
            />
            <Text style={styles.filterButtonText}>
              {filter.length === 0
                ? "Все категории"
                : `Категории: ${filter.length}`}
            </Text>
            {hiddenUnseen.length > 0 && <View style={styles.miniDot} />}
            <Ionicons
              name={filterOpen ? "chevron-up" : "chevron-down"}
              size={15}
              color="#719686"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gearButton, notifyOpen && styles.gearButtonActive]}
            activeOpacity={0.8}
            onPress={() => {
              setNotifyOpen((v) => !v);
              setFilterOpen(false);
            }}
            accessibilityLabel="Настройки уведомлений Стены"
          >
            <Ionicons
              name={
                notifyNewPosts
                  ? "notifications-outline"
                  : "notifications-off-outline"
              }
              size={18}
              color={notifyOpen ? "#FFFFFF" : "#3F6B5B"}
            />
          </TouchableOpacity>

          {/* Архив с поиском (Веха 56) */}
          <TouchableOpacity
            style={styles.gearButton}
            activeOpacity={0.8}
            onPress={() => router.push("/help-archive" as any)}
            accessibilityLabel="Архив Стены"
          >
            <Ionicons name="search-outline" size={18} color="#3F6B5B" />
          </TouchableOpacity>
        </View>

        {filterOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterHint}>
              Показывать в ленте только выбранные категории. Ничего не выбрано —
              видно всё. На уведомления фильтр не влияет.
            </Text>

            <View style={styles.chipsWrap}>
              {HELP_CATEGORIES.map((category) => {
                const active = filter.includes(category);

                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.75}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {category}
                    </Text>
                    {unseenCats.includes(category) && (
                      <View
                        style={[
                          styles.chipDot,
                          active && styles.chipDotOnActive,
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {notifyOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.notifyTitle}>Какие посты мне важны</Text>
            <Text style={styles.filterHint}>
              По ним загорается точка на вкладке и приходят уведомления.
            </Text>

            <View style={styles.chipsWrap}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  notifyCategories.length === 0 && styles.chipActive,
                ]}
                activeOpacity={0.75}
                onPress={setNotifyAll}
              >
                <Text
                  style={[
                    styles.chipText,
                    notifyCategories.length === 0 && styles.chipTextActive,
                  ]}
                >
                  Все категории
                </Text>
              </TouchableOpacity>

              {HELP_CATEGORIES.map((category) => {
                const active = notifyCategories.includes(category);

                return (
                  <TouchableOpacity
                    key={`n-${category}`}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.75}
                    onPress={() => toggleNotifyCategory(category)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.bellRow}
              activeOpacity={0.75}
              onPress={toggleBell}
            >
              <Ionicons
                name={
                  notifyNewPosts
                    ? "notifications-outline"
                    : "notifications-off-outline"
                }
                size={18}
                color="#3F6B5B"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bellTitle}>
                  {notifyNewPosts
                    ? "Уведомления о новых постах включены"
                    : "Уведомления о новых постах выключены"}
                </Text>
                <Text style={styles.bellHint}>
                  {notifyNewPosts
                    ? "Приходят в колокольчик, гаснут при открытии поста."
                    : "Только точка на вкладке, колокольчик молчит."}
                </Text>
              </View>
              <View
                style={[
                  styles.switchTrack,
                  notifyNewPosts && styles.switchTrackOn,
                ]}
              >
                <View
                  style={[
                    styles.switchKnob,
                    notifyNewPosts && styles.switchKnobOn,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.filterHint2}>
              Ответы и комментарии к вашим постам приходят всегда.
            </Text>
          </View>
        )}

        {/* Новое спрятано фильтром — подсказка, где именно; нажатие
            переключает фильтр на эти категории. */}
        {hiddenUnseen.length > 0 && (
          <TouchableOpacity
            style={styles.newInRow}
            activeOpacity={0.8}
            onPress={showUnseen}
          >
            <View style={styles.newInDot} />
            <Text style={styles.newInText} numberOfLines={2}>
              Новое в: {hiddenUnseen.join(" · ")}
            </Text>
            <Ionicons name="arrow-forward" size={15} color="#3F6B5B" />
          </TouchableOpacity>
        )}

        {loading && (
          <ActivityIndicator
            color="#69B78D"
            style={{ marginTop: 40 }}
            size="small"
          />
        )}

        {!loading && posts.length === 0 && (
          <View style={styles.emptyWrap}>
            <Tekmet style={styles.emptyTekmet} />
            <Text style={styles.emptyText}>
              {filter.length > 0
                ? "По выбранным категориям пока нет постов. Ослабьте фильтр или создайте пост первым."
                : "Пока пусто. Создайте первый пост — задайте вопрос сообществу или предложите свою помощь."}
            </Text>
          </View>
        )}

        {!loading &&
          posts.map((post) => {
            const isClosed = post.status === "archived";

            // «Новое» — любой чужой пост новее моего прошлого захода,
            // категория не важна (важные категории — только для точки и
            // колокольчика). Гаснет при открытии поста или при следующем
            // заходе на вкладку.
            const isNew =
              !isClosed &&
              !post.isMine &&
              !openedIds.includes(post.id) &&
              (!seenRef.current ||
                new Date(post.createdAt).getTime() >
                  new Date(seenRef.current).getTime());

            // Карточка целиком открывает пост (решение владельца);
            // в профиль автора ведут аватарка и имя уже внутри поста.
            return (
              <HelpPostCard
                key={post.id}
                post={post}
                isNew={isNew}
                onPress={() => {
                  setOpenedIds((ids) =>
                    ids.includes(post.id) ? ids : [...ids, post.id],
                  );
                  router.push({
                    pathname: "/help-post" as any,
                    params: { id: post.id },
                  });
                }}
              />
            );
          })}

        {!loading && posts.length > 0 && <Tekmet style={styles.footerTekmet} />}
      </ScrollView>

      {/* Новый пост — плавающая кнопка над капсулой вкладок */}
      <TouchableOpacity
        style={styles.fabShadow}
        activeOpacity={0.85}
        onPress={() => router.push("/new-help-post" as any)}
      >
        <Glass
          radius={22}
          tintColor="rgba(105,183,141,0.92)"
          borderColor="rgba(255,255,255,0.85)"
        >
          <View style={styles.fabInner}>
            <Feather name="plus" size={20} color="#FFFFFF" />
          </View>
        </Glass>
      </TouchableOpacity>
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

  // paddingBottom 120 — правило проекта: контент не должен навсегда
  // спрятаться под парящей капсулой вкладок.
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
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
    marginTop: 4,
    marginBottom: 16,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },

  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  gearButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  gearButtonActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  notifyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3F6B5B",
    marginBottom: 4,
  },

  bellRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.75,
    borderTopColor: "rgba(93,140,120,0.18)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  bellTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  bellHint: {
    fontSize: 11.5,
    color: "#7E988B",
    marginTop: 2,
  },

  switchTrack: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D7DCD9",
    padding: 2,
    justifyContent: "center",
  },

  switchTrackOn: {
    backgroundColor: "rgba(105,183,141,0.92)",
  },

  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },

  switchKnobOn: {
    alignSelf: "flex-end",
  },

  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(105,183,141,1)",
    marginLeft: 2,
  },

  chipDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "rgba(105,183,141,1)",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  chipDotOnActive: {
    backgroundColor: "#3F6B5B",
  },

  newInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "rgba(105,183,141,0.10)",
    borderWidth: 0.75,
    borderColor: "rgba(105,183,141,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  newInDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(105,183,141,1)",
  },

  newInText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  filterHint2: {
    fontSize: 11.5,
    color: "#96AC9E",
    marginTop: 10,
  },

  filterButtonText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#3F6B5B",
  },

  filterPanel: {
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 16,
  },

  filterHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#7E988B",
    marginBottom: 12,
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.45)",
    backgroundColor: "rgba(255,255,255,0.95)",
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },

  chipActive: {
    backgroundColor: "rgba(105,183,141,0.92)",
    borderColor: "rgba(105,183,141,0.92)",
  },

  chipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#4E7364",
  },

  chipTextActive: {
    color: "#FFFFFF",
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

  footerTekmet: {
    alignSelf: "center",
    marginTop: 10,
  },

  // Кнопка нового поста — над капсулой вкладок, чтобы не спорить с ней.
  fabShadow: {
    position: "absolute",
    right: 20,
    bottom: 104,
    borderRadius: 22,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    zIndex: 30,
  },

  fabInner: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
