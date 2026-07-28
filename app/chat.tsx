import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getOrCreateDirectChat } from '../services/chatService';
import {
  ChatMessage,
  getMessages,
  markChatAsRead,
  sendMessage,
  subscribeToMessages,
} from '../services/messageService';

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const name = String(params.name || 'Пользователь');
  const otherUserId = String(params.userId || '');

  console.log('CHAT SCREEN OPENED');
console.log('CHAT PARAMS:', params);
console.log('CHAT NAME:', name);
console.log('CHAT OTHER USER ID:', otherUserId);

  const scrollViewRef = useRef<ScrollView>(null);
  const unsubscribeRef = useRef<null | (() => void)>(null);
  const myUserIdRef = useRef<string>('');

  const [chatId, setChatId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [screenError, setScreenError] = useState('');

  const groupedMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      sender: message.sender_id === myUserIdRef.current ? 'me' : 'other',
    }));
  }, [messages]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);

    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  };

  const upsertMessage = (incomingMessage: ChatMessage) => {
    setMessages((prev) => {
      const exists = prev.some((item) => item.id === incomingMessage.id);

      if (exists) {
        return prev.map((item) =>
          item.id === incomingMessage.id ? incomingMessage : item
        );
      }

      const next = [...prev, incomingMessage];
      next.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      return next;
    });
  };

  useEffect(() => {
    const initChat = async () => {
  try {
    console.log('initChat started');
    setLoading(true);
    setScreenError('');

    if (!otherUserId) {
      console.log('otherUserId missing');
      throw new Error('Не передан userId собеседника');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('auth user result:', user);
    console.log('auth error:', authError);

    if (authError || !user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    myUserIdRef.current = user.id;
    console.log('myUserIdRef set:', myUserIdRef.current);

    console.log('calling getOrCreateDirectChat with:', otherUserId);
    const directChatId = await getOrCreateDirectChat(otherUserId);
    console.log('directChatId received:', directChatId);

    setChatId(directChatId);

    console.log('loading messages for chat:', directChatId);
    const initialMessages = await getMessages(directChatId);
    console.log('initialMessages:', initialMessages);

    setMessages(initialMessages);

    console.log('markChatAsRead start');
    await markChatAsRead(directChatId);
    console.log('markChatAsRead done');

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = subscribeToMessages({
      chatId: directChatId,
      onInsert: async (newMessage) => {
        console.log('realtime INSERT:', newMessage);
        upsertMessage(newMessage);

        if (newMessage.sender_id !== myUserIdRef.current) {
          try {
            await markChatAsRead(directChatId);
          } catch (e) {
            console.log('Ошибка markChatAsRead after insert:', e);
          }
        }
      },
      onUpdate: (updatedMessage) => {
        console.log('realtime UPDATE:', updatedMessage);
        upsertMessage(updatedMessage);
      },
    });

    console.log('subscription attached');
  } catch (e) {
    console.log('initChat ERROR:', e);
    const message =
      e instanceof Error ? e.message : 'Не удалось открыть чат';
    setScreenError(message);
  } finally {
    console.log('initChat finished');
    setLoading(false);
  }
};

    initChat();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [otherUserId]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom(false);
    }
  }, [loading]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  const handleSend = async () => {
  console.log('handleSend called');
  console.log('current chatId:', chatId);
  console.log('current input:', input);

  if (sending) {
    console.log('send blocked: sending=true');
    return;
  }

  if (!chatId) {
    console.log('send blocked: no chatId');
    return;
  }

  if (!input.trim()) {
    console.log('send blocked: empty input');
    return;
  }

  const textToSend = input.trim();
  setInput('');
  setSending(true);

  try {
    console.log('sendMessage start');
    const result = await sendMessage(chatId, textToSend);
    console.log('sendMessage success:', result);

    console.log('markChatAsRead after send');
    await markChatAsRead(chatId);
  } catch (e) {
    console.log('Ошибка отправки сообщения:', e);
    setInput(textToSend);
  } finally {
    console.log('handleSend finished');
    setSending(false);
  }
};

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (screenError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Не удалось открыть чат</Text>
        <Text style={styles.errorText}>{screenError}</Text>

        <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{name[0] || '?'}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{name}</Text>
          <Text style={styles.headerStatus}>личный чат</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {groupedMessages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Сообщений пока нет</Text>
            <Text style={styles.emptySubtext}>
              Напишите первое сообщение, чтобы начать диалог
            </Text>
          </View>
        ) : (
          groupedMessages.map((message) => {
            const isMine = message.sender === 'me';

            return (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  isMine ? styles.myMessageWrapper : styles.otherMessageWrapper,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isMine ? styles.myMessage : styles.otherMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isMine && styles.myMessageText,
                    ]}
                  >
                    {message.is_deleted ? 'Сообщение удалено' : message.text}
                  </Text>

                  <Text
                    style={[
                      styles.messageTime,
                      isMine && styles.myMessageTime,
                    ]}
                  >
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          placeholder="Введите сообщение..."
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!sending}
        />

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>{sending ? '...' : '→'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
    textAlign: 'center',
  },

  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },

  errorButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  errorButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  header: {
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  backButtonText: {
    fontSize: 22,
    color: '#222',
    fontWeight: '600',
  },

  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  headerAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },

  headerInfo: {
    flex: 1,
  },

  headerName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111',
  },

  headerStatus: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  messagesContainer: {
    padding: 14,
    paddingBottom: 10,
    flexGrow: 1,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },

  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 6,
  },

  emptySubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
  },

  messageWrapper: {
    marginBottom: 10,
    flexDirection: 'row',
  },

  myMessageWrapper: {
    justifyContent: 'flex-end',
  },

  otherMessageWrapper: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: '78%',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },

  myMessage: {
    backgroundColor: '#2E7D32',
    borderBottomRightRadius: 6,
  },

  otherMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
  },

  messageText: {
    color: '#222',
    fontSize: 15,
    lineHeight: 20,
  },

  myMessageText: {
    color: '#fff',
  },

  messageTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 6,
    alignSelf: 'flex-end',
  },

  myMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },

  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 100,
    backgroundColor: '#f3f3f3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  sendButtonDisabled: {
    opacity: 0.6,
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 