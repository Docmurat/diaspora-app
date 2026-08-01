import {
  Philosopher_400Regular,
  Philosopher_700Bold,
  useFonts,
} from "@expo-google-fonts/philosopher";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Tekmet } from "../../components/mingi";
import {
  getMyFavorites,
  removeFavoriteFromDb,
} from "../../services/favoritesService";
import { getAgeFromBirthDate } from "../../store/user";

export default function FavoritesScreen() {
  const [fontsLoaded] = useFonts({
    Philosopher_400Regular,
    Philosopher_700Bold,
  });

  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const data = await getMyFavorites();
      setFavorites(data || []);
    } catch (e) {
      console.log("Ошибка загрузки избранного:", e);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, []),
  );

  const handleRemove = async (favoriteUserId: string) => {
    try {
      await removeFavoriteFromDb(favoriteUserId);
      setFavorites((prev) =>
        prev.filter((item) => item.favorite_user?.id !== favoriteUserId),
      );
    } catch (e) {
      console.log("Ошибка удаления избранного:", e);
    }
  };

  if (!fontsLoaded) {
    return <View style={styles.emptyBg} />;
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#69B78D" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Избранное</Text>
        <Text style={styles.subtitle}>МИНГИ·ТАУ</Text>

        <Tekmet style={styles.tekmet} />

        {favorites.length === 0 ? (
          <Text style={styles.emptyText}>
            Пока никого нет в избранном. Отмечайте людей закладкой в поиске — они
            появятся здесь.
          </Text>
        ) : (
          favorites.map((item) => {
            const user = item.favorite_user;
            if (!user) return null;

            const fullName = `${user.first_name} ${user.last_name}`.trim();
            const age = user.birth_date
              ? getAgeFromBirthDate(user.birth_date)
              : "";

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <TouchableOpacity
                    style={styles.userMain}
                    activeOpacity={0.85}
                    onPress={() =>
                      router.push({
                        pathname: "/user-profile",
                        params: {
                          id: user.id,
                          name: fullName,
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
                      })
                    }
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
                        {fullName}
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
                    style={styles.removeButton}
                    onPress={() => handleRemove(user.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color="#7E988B" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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

  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 64,
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
    marginBottom: 12,
  },

  card: {
    marginTop: 10,
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

  removeButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: "rgba(105,183,141,0.10)",
  },

  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#7E988B",
    fontSize: 15,
    lineHeight: 22,
  },
});
