import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getMyChats, ChatListItem } from '../../services/chatService';

function formatChatTime(dateString?: string | null) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Вчера';
  }

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
}

function getFullName(chat: ChatListItem) {
  const firstName = chat.otherUser?.first_name?.trim() || '';
  const lastName = chat.otherUser?.last_name?.trim() || '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || 'Пользователь';
}

function getAvatarLetter(chat: ChatListItem) {
  const fullName = getFullName(chat);
  return fullName[0]?.toUpperCase() || '?';
}

export default function ChatsScreen() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenError, setScreenError] = useState('');

  const loadChats = async () => {
    try {
      setLoading(true);
      setScreenError('');

      const data = await getMyChats();
      setChats(data);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось загрузить список чатов';
      setScreenError(message);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const preparedChats = useMemo(() => {
    return chats.map((chat) => {
      const fullName = getFullName(chat);

      return {
        ...chat,
        fullName,
        avatarLetter: getAvatarLetter(chat),
        timeLabel: formatChatTime(chat.lastMessageAt || chat.updatedAt || chat.createdAt),
        previewText: chat.lastMessageText?.trim() || 'Сообщений пока нет',
      };
    });
  }, [chats]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (screenError) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Не удалось загрузить чаты</Text>
        <Text style={styles.stateText}>{screenError}</Text>

        <TouchableOpacity style={styles.retryButton} onPress={loadChats}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
      </View>

      {preparedChats.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Пока нет чатов</Text>
          <Text style={styles.stateText}>
            Когда вы начнёте диалог с пользователем, он появится здесь
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {preparedChats.map((chat) => (
            <TouchableOpacity
              key={chat.chatId}
              style={styles.chatCard}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: {
                    userId: chat.otherUser?.id || '',
                    name: chat.fullName,
                  },
                })
              }
              activeOpacity={0.8}
            >
              {chat.otherUser?.avatar_path ? (
                <Image
                  source={{ uri: chat.otherUser.avatar_path }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{chat.avatarLetter}</Text>
                </View>
              )}

              <View style={styles.chatInfo}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {chat.fullName}
                  </Text>

                  <Text style={styles.time}>{chat.timeLabel}</Text>
                </View>

                <Text style={styles.lastMessage} numberOfLines={1}>
                  {chat.previewText}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 24,
  },

  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },

  stateText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },

  retryButton: {
    marginTop: 18,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },

  list: {
    padding: 12,
    paddingBottom: 24,
  },

  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },

  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  chatInfo: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginRight: 10,
  },

  time: {
    fontSize: 12,
    color: '#777',
  },

  lastMessage: {
    fontSize: 14,
    color: '#555',
  },
});