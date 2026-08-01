import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Feather, Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import TopBar from "../../components/TopBar";
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

// Пирамида новых участников: ряды сверху вниз, широкое основание —
// у строки поиска, вершина — к кнопкам внизу.
const PYRAMID_ROWS = [4, 3];
const NEW_MEMBERS_COUNT = PYRAMID_ROWS.reduce((sum, n) => sum + n, 0);

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

  // Список уже приходит из базы свежими вперёд.
  // Разрезаем его на ряды пирамиды: 4, затем 3, затем 2, затем 1.
  const newMemberRows = useMemo(() => {
    const newest = users.slice(0, NEW_MEMBERS_COUNT);
    const rows: PreparedUser[][] = [];
    let cursor = 0;

    for (const size of PYRAMID_ROWS) {
      if (cursor >= newest.length) break;
      rows.push(newest.slice(cursor, cursor + size));
      cursor += size;
    }

    return rows;
  }, [users]);

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

  const handleReset = () => {
    setQuery("");
    setIsSearching(false);
  };

  const toggleFavorite = async (user: PreparedUser) => {
    try {
      const isFav = favoriteIds.includes(user.id);

      if (isFav) {
        await removeFavoriteFromDb(user.id);
        setFavoriteIds((prev) => prev.filter((id) => id !== user.id));
      } else {
        await addFavoriteToDb(user.id);
        setFavoriteIds((prev) => [...prev, user.id]);
      }
    } catch (e) {
      console.log("Ошибка изменения избранного:", e);
    }
  };

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

  return (
    <ScreenBackground alive={!showList}>
      <TopBar transparent />

      {!showList && (
        <TouchableOpacity
          onPress={handleSupport}
          activeOpacity={0.85}
          style={styles.supportButton}
        >
          <Glass
            radius={18}
            tintColor="rgba(255,255,255,0.9)"
            borderColor="rgba(105,183,141,0.75)"
            borderWidth={1}
          >
            <View style={styles.supportInner}>
              <Ionicons name="heart-outline" size={19} color="#3F6B5B" />
              <Text style={styles.supportText}>Поддержать проект</Text>
            </View>
          </Glass>
        </TouchableOpacity>
      )}

      {!showList && users.length > 0 && (
        <View style={styles.counterRow}>
          <Text style={styles.counterLabel}>Нас уже</Text>
          <Text style={styles.counterValue}>{users.length}</Text>
        </View>
      )}

      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={!showList && styles.halfTop}>
          <Text style={styles.title}>Поиск</Text>
          <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

          <Tekmet style={styles.tekmet} />
        </View>

        <View style={[styles.stickyBar, showList && styles.stickyBarSolid]}>
          <View style={styles.searchRow}>
            <Glass {...glassInputProps} style={styles.inputWrap}>
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
            </Glass>

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
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </View>
              </Glass>
            </TouchableOpacity>
          </View>

          {showList && (
            <View style={styles.modeRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setMode("all")}
                style={[styles.pill, mode === "all" && styles.pillActive]}
              >
                <Text
                  style={[
                    styles.pillText,
                    mode === "all" && styles.pillTextActive,
                  ]}
                >
                  Все
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setMode("saved")}
                style={[styles.pill, mode === "saved" && styles.pillActive]}
              >
                <Text
                  style={[
                    styles.pillText,
                    mode === "saved" && styles.pillTextActive,
                  ]}
                >
                  Избранные
                </Text>
              </TouchableOpacity>

              {isSearching && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  activeOpacity={0.8}
                >
                  <Text style={styles.resetButtonText}>Сбросить поиск</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={!showList && styles.halfBottom}>
          {!showList && newMemberRows.length > 0 && (
            <View style={styles.newBlock}>
              <Text style={styles.blockLabel}>НОВЫЕ УЧАСТНИКИ</Text>

              {newMemberRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.pyramidRow}>
                  {row.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.newItem}
                      activeOpacity={0.85}
                      onPress={() => openUser(user)}
                    >
                      <Image
                        source={
                          user.avatar_path
                            ? { uri: user.avatar_path }
                            : require("../../assets/default-avatar.png")
                        }
                        style={styles.newAvatar}
                      />
                      <Text style={styles.newName} numberOfLines={1}>
                        {user.first_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
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
                          {user.city || "—"}
                          {user.country ? `, ${user.country}` : ""}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={() => toggleFavorite(user)}
                      activeOpacity={0.7}
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
        </View>
      </ScrollView>

      {!showList && (
        <Text style={styles.founder}>Основатель проекта — Мурат Курджиев</Text>
      )}

      {showList && (
        <TouchableOpacity
          style={styles.fabShadow}
          activeOpacity={0.85}
          onPress={() => router.push("/invites" as any)}
        >
          <Glass
            radius={31}
            tintColor="rgba(105,183,141,0.92)"
            borderColor="rgba(255,255,255,0.85)"
          >
            <View style={styles.fabInner}>
              <Feather name="user-plus" size={24} color="#FFFFFF" />
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

  stickyBarSolid: {
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  inputWrap: {
    flex: 1,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15.5,
    color: "#2F4A3C",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
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
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },

  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },

  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
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

  resetButton: {
    marginLeft: "auto",
  },

  resetButtonText: {
    color: "#96AC9E",
    fontSize: 14,
    textDecorationLine: "underline",
  },

  newBlock: {
    marginTop: 22,
  },

  blockLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    color: "#719686",
    marginBottom: 12,
    textAlign: "center",
  },

  pyramidRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },

  newItem: {
    width: 66,
    alignItems: "center",
    marginHorizontal: 6,
  },

  newAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EAF4EE",
    borderWidth: 1,
    borderColor: "rgba(93,140,120,0.28)",
  },

  newName: {
    marginTop: 6,
    fontSize: 12.5,
    color: "#4E7364",
    textAlign: "center",
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
    padding: 8,
    marginLeft: 4,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 24,
    color: "#7E988B",
    fontSize: 15,
  },

  supportButton: {
    marginHorizontal: 24,
    marginBottom: 6,
  },

  counterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
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
    gap: 8,
    paddingVertical: 15,
    minHeight: 52,
  },

  supportText: {
    color: "#3F6B5B",
    fontSize: 15.5,
    fontWeight: "600",
  },

  founder: {
    fontSize: 12.5,
    color: "#8FA79A",
    textAlign: "center",
    paddingHorizontal: 24,
    paddingBottom: 14,
  },

  fabShadow: {
    position: "absolute",
    right: 20,
    bottom: 26,
    borderRadius: 31,
    shadowColor: "#69B78D",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    zIndex: 30,
  },

  fabInner: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
    opacity: 0.7,
  },
});
