import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getAgeFromBirthDate } from '../../store/user';
import { createInvite, markInviteAsSent } from '../../services/inviteService';
import {
  getApprovedUsers,
  DirectoryUser,
} from '../../services/userDirectoryService';
import { Ionicons, Feather } from '@expo/vector-icons';
import {
  addFavoriteToDb,
  removeFavoriteFromDb,
  getMyFavorites,
} from '../../services/favoritesService';

type PreparedUser = DirectoryUser & {
  fullName: string;
};

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PreparedUser[]>([]);
  const [results, setResults] = useState<PreparedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  

  const runSearch = useCallback((searchText: string, sourceUsers: PreparedUser[]) => {
    const cleanQuery = searchText.trim().toLowerCase();

    if (!cleanQuery) {
      setResults(sourceUsers);
      return;
    }

    const words = cleanQuery.split(/\s+/).filter(Boolean);

    const filtered = sourceUsers.filter((user) => {
      const searchableText = [
        user.fullName,
        user.category || '',
        user.profession || '',
        user.city || '',
        user.country || '',
        user.bio || '',
      ]
        .join(' ')
        .toLowerCase();

      return words.every((word) => searchableText.includes(word));
    });

    setResults(filtered);
  }, []);

  // Загружаем данные только при входе/возврате на экран
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
            (item: any) => item.favorite_user_id
          );

          setUsers(prepared);
          setFavoriteIds(favoriteUserIds);
        } catch (e) {
          console.log('Ошибка загрузки пользователей:', e);
          setUsers([]);
          setResults([]);
          setFavoriteIds([]);
        } finally {
          setLoading(false);
        }
      };

      loadUsers();
    }, [])
  );

  // Реактивный поиск только после первого поиска
  useEffect(() => {
    if (!isSearching) return;
    runSearch(query, users);
  }, [isSearching, query, users, runSearch]);

  const visibleResults = useMemo(() => {
    return isSearching ? results : [];
  }, [isSearching, results]);

  const handleCreateInvite = async () => {
  try {
    setCreatingInvite(true);

    const invite = await createInvite();

    const result = await Share.share({
      message: `Мой инвайт-код для Diaspora: ${invite.code}`,
    });

    if (result.action === Share.sharedAction) {
      await markInviteAsSent(invite.id);
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Ошибка создания инвайта';
    Alert.alert('Ошибка', message);
  } finally {
    setCreatingInvite(false);
  }
};

  const handleSearch = () => {
    setIsSearching(true);
    runSearch(query, users);
  };

  const handleReset = () => {
    setQuery('');
    setResults([]);
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
      console.log('Ошибка изменения избранного:', e);
    }
  };

  if (loading && !isSearching) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

return (
  <View style={styles.screen}>
    <ScrollView
      contentContainerStyle={[
        styles.container,
        isSearching && styles.containerTop,
        styles.containerWithFab,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {!isSearching && (
        <Image
          source={require('../../assets/pattern.png')}
          style={styles.heroImage}
        />
      )}

      <View style={styles.searchBlock}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Например: стоматолог Москва"
            placeholderTextColor="#bbb"
            style={[
              styles.input,
              {
                outlineStyle: 'none',
                outlineWidth: 0,
              } as any,
            ]}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            underlineColorAndroid="transparent"
          />

          <TouchableOpacity style={styles.searchIcon} onPress={handleSearch}>
            <Text style={styles.searchIconText}>→</Text>
          </TouchableOpacity>
        </View>

        {isSearching && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Сбросить поиск</Text>
          </TouchableOpacity>
        )}
      </View>

      {isSearching &&
        visibleResults.map((user) => {
          const age = user.birth_date
            ? getAgeFromBirthDate(user.birth_date)
            : '';

          return (
            <View key={user.id} style={styles.card}>
              <View style={styles.cardContent}>
                <TouchableOpacity
                  style={styles.userMain}
                  onPress={() =>
                    router.push({
                      pathname: '/user-profile',
                      params: {
                        id: user.id,
                        name: user.fullName,
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
                    <Text style={styles.name}>{user.fullName}</Text>
                    {!!age && <Text style={styles.age}>{age} лет</Text>}
                    <Text style={styles.profession}>{user.profession || '—'}</Text>
                    <Text style={styles.location}>
                      {user.city || '—'}, {user.country || '—'}
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
                        ? 'bookmark'
                        : 'bookmark-outline'
                    }
                    size={20}
                    color="#2E7D32"
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

      {isSearching && visibleResults.length === 0 && (
        <Text style={styles.emptyText}>Ничего не найдено</Text>
      )}
    </ScrollView>

    <TouchableOpacity
      style={[styles.addPersonFab, creatingInvite && styles.disabledFab]}
      activeOpacity={0.85}
      onPress={handleCreateInvite}
      disabled={creatingInvite}
    >
      <Feather name="user-plus" size={24} color="#1F6BFF" />
    </TouchableOpacity>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  disabledFab: {
  opacity: 0.7,
},
  containerTop: {
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  heroImage: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginBottom: 30,
    resizeMode: 'contain',
  },
  screen: {
  flex: 1,
  backgroundColor: '#fff',
},

containerWithFab: {
  paddingBottom: 110,
},

addPersonFab: {
  position: 'absolute',
  right: 20,
  bottom: 26,
  width: 62,
  height: 62,
  borderRadius: 31,
  backgroundColor: '#F4F8FF',
  borderWidth: 1.5,
  borderColor: '#1F6BFF',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 30,
  elevation: 6,
},
  searchBlock: {
    width: '100%',
  },
  searchRow: {
    flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 4,
  },
  input: {
    flex: 1,
  height: 50,
  borderWidth: 1,
  borderColor: '#eee',
  borderRadius: 12,
  paddingHorizontal: 15,
  backgroundColor: '#fafafa',
  },
  searchIcon: {
    marginLeft: 10,
    backgroundColor: '#2E7D32',
    width: 45,
    height: 45,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resetButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 14,
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
  name: {
    fontWeight: 'bold',
    fontSize: 16,
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
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
});