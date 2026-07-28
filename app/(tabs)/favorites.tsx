import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAgeFromBirthDate } from '../../store/user';
import {
  getMyFavorites,
  removeFavoriteFromDb,
} from '../../services/favoritesService';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const data = await getMyFavorites();
      setFavorites(data || []);
    } catch (e) {
      console.log('Ошибка загрузки избранного:', e);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const handleRemove = async (favoriteUserId: string) => {
    try {
      await removeFavoriteFromDb(favoriteUserId);
      setFavorites((prev) =>
        prev.filter((item) => item.favorite_user?.id !== favoriteUserId)
      );
    } catch (e) {
      console.log('Ошибка удаления избранного:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Избранные</Text>

        {favorites.length === 0 ? (
          <Text style={styles.emptyText}>Пока никого нет в избранном</Text>
        ) : (
          favorites.map((item) => {
            const user = item.favorite_user;
            if (!user) return null;

            const fullName = `${user.first_name} ${user.last_name}`.trim();
            const age = user.birth_date
              ? getAgeFromBirthDate(user.birth_date)
              : '';

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardContent}>
                  <TouchableOpacity
                    style={styles.userMain}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/user-profile',
                        params: {
                          id: user.id,
                          name: fullName,
                          category: user.category || '',
                          profession: user.profession || '',
                          city: user.city || '',
                          country: user.country || '',
                          birthDate: user.birth_date || '',
                          telegram: user.telegram || '',
                          bio: user.bio || '',
                          extraInfo: user.extra_info || '',
                          avatarUri: user.avatar_path || '',
                        },
                      })
                    }
                  >
                    <Image
                      source={
                        user.avatar_path
                          ? { uri: user.avatar_path }
                          : require('../../assets/default-avatar.png')
                      }
                      style={styles.avatar}
                    />

                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={2}>
                        {fullName}
                      </Text>

                      {!!age && <Text style={styles.age}>{age} лет</Text>}

                      <Text style={styles.profession}>
                        {user.profession || '—'}
                      </Text>

                      <Text style={styles.location}>
                        {user.city || '—'}
                        {user.country ? `, ${user.country}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
  style={styles.removeButton}
  onPress={() => handleRemove(user.id)}
  activeOpacity={0.7}
>
  <Ionicons name="close" size={16} color="#666" />
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
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111',
  },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 16,
    marginRight: 17,
  },
  info: {
    flex: 1,
  },
  removeButton: {
  padding: 6,
  marginLeft: 8,
  borderRadius: 10,
  backgroundColor: '#f5f5f5',
},
  name: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#111',
  },
  age: {
    color: '#2E7D32',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  profession: {
    color: '#555',
    marginTop: 2,
  },
  location: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  favoriteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontSize: 16,
  },
});