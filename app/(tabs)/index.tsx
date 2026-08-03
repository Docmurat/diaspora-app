import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import TopBar from "../../components/TopBar";
import { formatLocations } from "../../components/locations";
import { Glass, MingiBackground, Tekmet } from "../../components/mingi";
import {
  addFavoriteToDb,
  getMyFavorites,
  removeFavoriteFromDb,
} from "../../services/favoritesService";
import {
  DirectoryUser,
  getApprovedUsers,
} from "../../services/userDirectoryService";
import { getAgeFromBirthDate } from "../../store/user";

type PreparedUser = DirectoryUser & {
  fullName: string;
};

const glassInputProps = {
  radius: 16,
  tintColor: "rgba(255,255,255,0.95)",
  borderColor: "rgba(93,140,120,0.45)",
  borderWidth: 0.75,
} as const;

// До поиска — живой фон с боке. Как только показан список, фон обычный белый,
// чтобы карточки читались спокойно.
function ScreenBackground({
  alive,
  children,
}: {
  alive: boolean;
  children: ReactNode;
}) {
  if (alive) {
    return <MingiBackground idPrefix="ppl">{children}</MingiBackground>;
  }

  return <View style={styles.whiteScreen}>{children}</View>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<PreparedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // «Все» — всё сообщество, «Мои» — сохранённые закладкой (бывшее избранное)
  const [mode, setMode] = useState<"all" | "saved">("all");
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadUsers = async () => {
        try {
          setLoading(true);

          const [usersData, favoritesData] = await Promise.all([
            getApprovedUsers(),
            getMyFavorites(),
          ]);

          const prepared: PreparedUser[] = usersData.map((user) => ({
            ...user,
            fullName: `${user.first_name} ${user.last_name}`,
          }));

          const favoriteUserIds = (favoritesData || []).map(
            (item: any) => item.favorite_user_id,
          );

          setUsers(prepared);
          setFavoriteIds(favoriteUserIds);
        } catch (e) {
          console.log("Ошибка загрузки пользователей:", e);
          setUsers([]);
          setFavoriteIds([]);
        } finally {
          setLoading(false);
        }
      };

      loadUsers();
    }, []),
  );

  // Нажатие на вкладку «Люди» сразу открывает список.
  // Главный экран остаётся при запуске приложения и после «Сбросить поиск».
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      setIsSearching(true);
    });

    return unsubscribe;
  }, [navigation]);

  // Что показываем в списке: сначала выбираем набор («Все» или «Мои»),
  // потом, если идёт поиск, отфильтровываем его по словам запроса.
  const visibleResults = useMemo(() => {
    const base =
      mode === "saved"
        ? users.filter((user) => favoriteIds.includes(user.id))
        : users;

    const cleanQuery = query.trim().toLowerCase();

    if (!isSearching || !cleanQuery) return base;

    const words = cleanQuery.split(/\s+/).filter(Boolean);

    return base.filter((user) => {
      const searchableText = [
        user.fullName,
        user.category || "",
        user.profession || "",
        user.city || "",
        user.country || "",
        user.bio || "",
      ]
        .join(" ")
        .toLowerCase();

      return words.every((word) => searchableText.includes(word));
    });
  }, [mode, users, favoriteIds, isSearching, query]);

  // Список виден при поиске и всегда в режиме «Мои»
  const showList = isSearching || mode === "saved";

  const openUser = (user: PreparedUser) => {
    router.push({
      pathname: "/user-profile",
      params: {
        id: user.id,
        name: user.fullName,
        category: user.category || "",
        profession: user.profession || "",
        city: user.city || "",
        country: user.country || "",
        birthDate: user.birth_date || "",
        telegram: user.telegram || "",
        bio: user.bio || "",
        extraInfo: user.extra_info || "",
        avatarUri: user.avatar_path || "",
      },
    });
  };

  const handleSupport = () => {
    Alert.alert(
      "Скоро",
      "Здесь появится страница о проекте и способ поддержать его.",
    );
  };

  const handleSearch = () => {
    setIsSearching(true);
  };

  const toggleFavorite = async (user: PreparedUser) => {
    const isFav = favoriteIds.includes(user.id);

    // Сначала мгновенно меняем закладку на экране, потом сообщаем серверу.
    // Если сервер откажет — возвращаем как было.
    if (isFav) {
      setFavoriteIds((prev) => prev.filter((id) => id !== user.id));
    } else {
      setFavoriteIds((prev) => [...prev, user.id]);
    }

    try {
      if (isFav) {
        await removeFavoriteFromDb(user.id);
      } else {
        await addFavoriteToDb(user.id);
      }
    } catch (e) {
      console.log("Ошибка изменения избранного:", e);
      if (isFav) {
        setFavoriteIds((prev) => [...prev, user.id]);
      } else {
        setFavoriteIds((prev) => prev.filter((id) => id !== user.id));
      }
    }
  };

  // Скользящий штрих под вкладками «Все / Избранные»: замеряем ширину
  // полосы вкладок и плавно перевозим штрих под активное слово.
  // ВАЖНО: блок стоит ДО ранних выходов (fontsLoaded / loading) —
  // таково правило React для подобных блоков.
  const [tabsWidth, setTabsWidth] = useState(0);
  const underlineX = useRef(new Animated.Value(0)).current;
  const underlineReady = useRef(false);

  useEffect(() => {
    if (!tabsWidth) return;
    const half = tabsWidth / 2;
    const target = (mode === "saved" ? half : 0) + half / 2 - 40;

    if (!underlineReady.current) {
      underlineReady.current = true;
      underlineX.setValue(target);
      return;
    }

    Animated.timing(underlineX, {
      toValue: target,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mode, tabsWidth, underlineX]);

  if (!fontsLoaded) {
    return <View style={styles.whiteScreen} />;
  }

  if (loading && !showList) {
    return (
      <MingiBackground idPrefix="pplload">
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#69B78D" />
        </View>
      </MingiBackground>
    );
  }

  // Строка поиска с фильтрами. На главной живёт внутри страницы,
  // в режиме списка — прибита сверху и не зависит от прокрутки.
  const searchBar = (
    <>
      <View style={styles.searchRow}>
        <Glass {...glassInputProps} style={styles.inputWrap}>
          <View style={styles.inputInner}>
            <TextInput
              placeholder="Например: стоматолог Москва"
              placeholderTextColor="#8FA79A"
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              underlineColorAndroid="transparent"
              returnKeyType="search"
            />

            {showList && query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                activeOpacity={0.7}
                style={styles.clearButton}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#8FA79A" />
              </TouchableOpacity>
            )}
          </View>
        </Glass>

        {!showList && (
          <TouchableOpacity
            style={styles.searchButtonShadow}
            onPress={handleSearch}
            activeOpacity={0.85}
          >
            <Glass
              radius={16}
              tintColor="rgba(105,183,141,0.92)"
              borderColor="rgba(255,255,255,0.85)"
            >
              <View style={styles.searchButtonInner}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </Glass>
          </TouchableOpacity>
        )}
      </View>

      {showList && (
        <View
          style={styles.modeRow}
          onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setQuery("");
              setMode("all");
            }}
            style={styles.modeTab}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === "all" && styles.modeTabTextActive,
              ]}
            >
              Все
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setQuery("");
              setMode("saved");
            }}
            style={styles.modeTab}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === "saved" && styles.modeTabTextActive,
              ]}
            >
              Избранные
            </Text>
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.modeUnderline,
              tabsWidth === 0 && { opacity: 0 },
              { transform: [{ translateX: underlineX }] },
            ]}
          />
        </View>
      )}
    </>
  );

  return (
    <ScreenBackground alive={!showList}>
      {showList && <TopBar transparent />}

      {!showList && (
        <TouchableOpacity
          onPress={handleSupport}
          activeOpacity={0.85}
          style={[styles.supportButton, { marginTop: insets.top + 16 }]}
        >
          <Glass
            radius={999}
            tintColor="rgba(247,205,216,0.55)"
            borderColor="rgba(219,143,163,0.65)"
            borderWidth={1}
          >
            <View style={styles.supportInner}>
              <Ionicons name="heart-outline" size={16} color="#A85A72" />
              <Text style={styles.supportText}>Поддержать проект</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      )}

      {showList && <View style={styles.listHeader}>{searchBar}</View>}

      <ScrollView
        contentContainerStyle={[
          styles.container,
          showList && styles.containerList,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!showList && (
          <View style={styles.halfTop}>
            <Text style={styles.title}>Поиск</Text>
            <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

            <Tekmet style={styles.tekmet} />
          </View>
        )}

        {!showList && <View style={styles.stickyBar}>{searchBar}</View>}

        <View style={!showList && styles.halfBottom}>
          {!showList && users.length > 0 && (
            <View style={styles.counterRow}>
              <Text style={styles.counterLabel}>Нас уже</Text>
              <Text style={styles.counterValue}>{users.length}</Text>
            </View>
          )}

          {showList &&
            visibleResults.map((user) => {
              const age = user.birth_date
                ? getAgeFromBirthDate(user.birth_date)
                : "";

              return (
                <View key={user.id} style={styles.card}>
                  <View style={styles.cardContent}>
                    <TouchableOpacity
                      style={styles.userMain}
                      activeOpacity={0.85}
                      onPress={() => openUser(user)}
                    >
                      <Image
                        source={
                          user.avatar_path
                            ? { uri: user.avatar_path }
                            : require("../../assets/default-avatar.png")
                        }
                        style={styles.avatar}
                      />

                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={2}>
                          {user.fullName}
                        </Text>
                        {!!age && <Text style={styles.age}>{age} лет</Text>}
                        <Text style={styles.profession}>
                          {user.profession || "—"}
                        </Text>
                        <Text style={styles.location}>
                          {formatLocations(user.country, user.city) || "—"}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={() => toggleFavorite(user)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    >
                      <Ionicons
                        name={
                          favoriteIds.includes(user.id)
                            ? "bookmark"
                            : "bookmark-outline"
                        }
                        size={20}
                        color="#69B78D"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

          {showList && visibleResults.length === 0 && (
            <Text style={styles.emptyText}>
              {mode === "saved" && !isSearching
                ? "В избранных пока никого нет. Отмечайте людей закладкой — они появятся здесь."
                : "Ничего не найдено"}
            </Text>
          )}

          {showList && <Tekmet style={styles.footerTekmet} />}

          {!showList && (
            <Text style={styles.founder}>
              Основатель проекта — Мурат Курджиев
            </Text>
          )}
        </View>
      </ScrollView>

      {showList && (
        <TouchableOpacity
          style={styles.fabShadow}
          activeOpacity={0.85}
          onPress={() => router.push("/invites" as any)}
        >
          <Glass
            radius={22}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.fabInner}>
              <Feather name="user-plus" size={18} color="#FFFFFF" />
            </View>
          </Glass>
        </TouchableOpacity>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  whiteScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    flexGrow: 1,
  },

  containerList: {
    paddingTop: 0,
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

  stickyBar: {
    paddingBottom: 8,
  },

  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 2,
  },

  footerTekmet: {
    alignSelf: "center",
    marginTop: 26,
    marginBottom: 6,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  inputWrap: {
    flex: 1,
  },

  inputInner: {
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },

  clearButton: {
    paddingHorizontal: 12,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  searchButtonShadow: {
    marginLeft: 10,
    borderRadius: 16,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  searchButtonInner: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  modeRow: {
    flexDirection: "row",
    marginTop: 10,
    paddingBottom: 7,
  },

  modeTab: {
    flex: 1,
    alignItems: "center",
  },

  modeTabText: {
    fontSize: 14,
    color: "#96AC9E",
  },

  modeTabTextActive: {
    color: "#3F6B5B",
  },

  modeUnderline: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 80,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(105,183,141,0.9)",
  },

  card: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 0.75,
    borderColor: "rgba(93,140,120,0.28)",
    overflow: "hidden",
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  userMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 66,
    height: 66,
    borderRadius: 20,
    marginRight: 14,
    backgroundColor: "#EAF4EE",
  },

  info: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 17.5,
    color: "#3F6B5B",
  },

  age: {
    color: "#69B78D",
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },

  profession: {
    color: "#4E7364",
    fontSize: 14,
    marginTop: 2,
  },

  location: {
    color: "#8FA79A",
    fontSize: 12.5,
    marginTop: 2,
  },

  favoriteButton: {
    padding: 12,
    marginLeft: 2,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 24,
    color: "#7E988B",
    fontSize: 15,
  },

  supportButton: {
    alignSelf: "center",
    marginBottom: 6,
  },

  counterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },

  counterLabel: {
    fontFamily: "Philosopher_400Regular",
    fontSize: 16,
    color: "#719686",
  },

  counterValue: {
    fontFamily: "Philosopher_700Bold",
    fontSize: 24,
    color: "#3F6B5B",
  },

  halfTop: {
    flex: 1,
    justifyContent: "flex-end",
  },

  halfBottom: {
    flex: 1,
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

  founder: {
    marginTop: "auto",
    paddingTop: 18,
    marginBottom: -24,
    fontSize: 12.5,
    color: "#8FA79A",
    textAlign: "center",
    paddingHorizontal: 24,
  },

  fabShadow: {
    position: "absolute",
    right: 20,
    bottom: 26,
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

  disabled: {
    opacity: 0.7,
  },
});
