import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';

type CaseKind =
  | 'registration'
  | 'invite_request'
  | 'name_change'
  | 'complaint'
  | 'blocked';

type MessageItem = {
  id: string;
  author_role: 'user' | 'moderator' | 'system';
  message: string;
  created_at?: string | null;
};

export default function ModerationCaseDetailsScreen() {
  const params = useLocalSearchParams<{
    kind?: string;
    entityId?: string;
  }>();

  const kind = String(params.kind || '') as CaseKind;
  const entityId = String(params.entityId || '');

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (
    createdAt?: string | null,
    completedAt?: string | null
  ) => {
    if (!createdAt || !completedAt) return '—';

    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return '—';
    }

    const diffMs = end - start;
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const loadMessages = async (requestType: string, requestId: string) => {
    const { data, error } = await supabase
      .from('moderation_messages')
      .select('*')
      .eq('request_type', requestType)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []) as MessageItem[];
  };

  const loadRegistration = async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        invited_by:invited_by_user_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('id', entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages('invite_request', entityId).catch(() => []);

    setRecord(data);
    setMessages(history);
  };

  const loadInviteRequest = async () => {
    const { data, error } = await supabase
      .from('invite_requests')
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages('invite_request', entityId).catch(() => []);

    setRecord(data);
    setMessages(history);
  };

  const loadNameChange = async () => {
    const { data, error } = await supabase
      .from('name_change_requests')
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) throw new Error(error.message);

    const history = await loadMessages('name_change_request', entityId).catch(
      () => []
    );

    setRecord(data);
    setMessages(history);
  };

  const loadComplaint = async () => {
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        reporter:reporter_user_id (
          id,
          first_name,
          last_name,
          email
        ),
        target:target_user_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', entityId)
      .single();

    if (error) throw new Error(error.message);

    setRecord(data);
    setMessages([]);
  };

  const loadBlockedCase = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) throw new Error(error.message);

    setRecord(data);
    setMessages([]);
  };

  const loadCase = useCallback(async () => {
    try {
      setLoading(true);

      if (!kind || !entityId) {
        throw new Error('Не переданы параметры кейса');
      }

      if (kind === 'registration') {
        await loadRegistration();
      } else if (kind === 'invite_request') {
        await loadInviteRequest();
      } else if (kind === 'name_change') {
        await loadNameChange();
      } else if (kind === 'complaint') {
        await loadComplaint();
      } else if (kind === 'blocked') {
        await loadBlockedCase();
      } else {
        throw new Error('Неизвестный тип кейса');
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Не удалось загрузить кейс';
      Alert.alert('Ошибка', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [kind, entityId]);

  useFocusEffect(
    useCallback(() => {
      loadCase();
    }, [loadCase])
  );

  const headerTitle = useMemo(() => {
    if (kind === 'registration') return 'Детали регистрации';
    if (kind === 'invite_request') return 'Детали заявки';
    if (kind === 'name_change') return 'Детали смены ФИО';
    if (kind === 'complaint') return 'Детали жалобы';
    if (kind === 'blocked') return 'Детали блокировки';
    return 'Детали кейса';
  }, [kind]);

  const statusLabel = useMemo(() => {
    if (!record) return '—';

    if (kind === 'registration') {
      if (record.moderation_status === 'approved') return 'Одобрено';
      if (record.moderation_status === 'rejected') return 'Отклонено';
      if (record.moderation_status === 'needs_revision') return 'На доработке';
      return record.moderation_status || '—';
    }

    if (kind === 'invite_request') {
      if (record.status === 'approved') return 'Одобрено';
      if (record.status === 'rejected') return 'Отклонено';
      return record.status || '—';
    }

    if (kind === 'name_change') {
      if (record.status === 'approved') return 'Одобрено';
      if (record.status === 'rejected') return 'Отклонено';
      return record.status || '—';
    }

    if (kind === 'complaint') {
      if (record.status === 'resolved') return 'Принято';
      if (record.status === 'rejected') return 'Отклонено';
      return record.status || '—';
    }

    if (kind === 'blocked') {
      return record.is_blocked ? 'Заблокирован' : 'Разблокирован';
    }

    return '—';
  }, [kind, record]);

  const resolutionDuration = useMemo(() => {
    if (!record) return '—';

    if (kind === 'registration') {
      return formatDuration(record.created_at, record.moderation_completed_at);
    }

    if (kind === 'invite_request') {
      return formatDuration(record.created_at, record.final_decision_at);
    }

    if (kind === 'name_change') {
      return formatDuration(record.created_at, record.reviewed_at);
    }

    if (kind === 'complaint') {
      return formatDuration(record.created_at, record.reviewed_at);
    }

    return '—';
  }, [kind, record]);

  const moderatorName = useMemo(() => {
    if (!record) return '—';

    if (kind === 'registration') {
      return record.moderation_completed_by_name || '—';
    }

    if (kind === 'invite_request') {
      return record.completed_by_name || '—';
    }

    if (kind === 'name_change') {
      return record.completed_by_name || '—';
    }

    if (kind === 'complaint') {
      return record.completed_by_name || '—';
    }

    return '—';
  }, [kind, record]);

  const moderatorNote = useMemo(() => {
    if (!record) return '';

    if (kind === 'registration') {
      return record.moderation_note || '';
    }

    if (kind === 'invite_request') {
      return record.review_note || '';
    }

    if (kind === 'name_change') {
      return record.review_note || '';
    }

    if (kind === 'complaint') {
      return record.review_note || '';
    }

    return '';
  }, [kind, record]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Кейс не найден</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{headerTitle}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Итог</Text>
          <Text style={styles.text}>Статус: {statusLabel}</Text>
          <Text style={styles.text}>Обработал: {moderatorName}</Text>
          <Text style={styles.text}>
            От создания до завершения: {resolutionDuration}
          </Text>

          {!!moderatorNote && (
            <>
              <Text style={styles.reasonLabel}>Комментарий модератора</Text>
              <Text style={styles.text}>{moderatorNote}</Text>
            </>
          )}
        </View>

        {kind === 'registration' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Анкета</Text>
            <Text style={styles.text}>
              Имя: {`${record.first_name || ''} ${record.last_name || ''}`.trim() || '—'}
            </Text>
            <Text style={styles.text}>Телефон: {record.phone || '—'}</Text>
            <Text style={styles.text}>Email: {record.email || '—'}</Text>
            <Text style={styles.text}>Категория: {record.category || '—'}</Text>
            <Text style={styles.text}>Профессия: {record.profession || '—'}</Text>
            <Text style={styles.text}>Город: {record.city || '—'}</Text>
            <Text style={styles.text}>Страна: {record.country || '—'}</Text>
            <Text style={styles.text}>Telegram: {record.telegram || '—'}</Text>

            {!!record.invited_by && (
              <Text style={styles.text}>
                Пригласил:{' '}
                {`${record.invited_by.first_name || ''} ${record.invited_by.last_name || ''}`.trim() ||
                  record.invited_by.email ||
                  '—'}
              </Text>
            )}

            <TouchableOpacity
  style={styles.primaryButton}
  onPress={() =>
    router.push({
      pathname: '/user-profile',
      params: {
        id: record.id,
      },
    })
  }
>
  <Text style={styles.primaryButtonText}>Открыть профиль</Text>
</TouchableOpacity>
          </View>
        )}

        {kind === 'invite_request' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Заявка</Text>
            <Text style={styles.text}>Имя: {record.full_name || '—'}</Text>
            <Text style={styles.text}>Телефон: {record.phone || '—'}</Text>
            <Text style={styles.text}>Telegram: {record.telegram || '—'}</Text>
            {!!record.about && (
              <>
                <Text style={styles.reasonLabel}>О себе</Text>
                <Text style={styles.text}>{record.about}</Text>
              </>
            )}
            <Text style={styles.text}>
              Создано: {formatDateTime(record.created_at)}
            </Text>
            <Text style={styles.text}>
              Завершено: {formatDateTime(record.final_decision_at)}
            </Text>
          </View>
        )}

        {kind === 'name_change' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Запрос на смену ФИО</Text>
            <Text style={styles.text}>
              Текущее имя: {record.current_first_name || '—'} {record.current_last_name || ''}
            </Text>
            <Text style={styles.text}>
              Новое имя: {record.requested_first_name || '—'} {record.requested_last_name || ''}
            </Text>
            <Text style={styles.reasonLabel}>Причина</Text>
            <Text style={styles.text}>{record.reason || '—'}</Text>
            <Text style={styles.text}>
              Создано: {formatDateTime(record.created_at)}
            </Text>
            <Text style={styles.text}>
              Завершено: {formatDateTime(record.reviewed_at)}
            </Text>
          </View>
        )}

        {kind === 'complaint' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Жалоба</Text>
            <Text style={styles.text}>
              От: {`${record.reporter?.first_name || ''} ${record.reporter?.last_name || ''}`.trim() || '—'}
            </Text>
            <Text style={styles.text}>
              На: {`${record.target?.first_name || ''} ${record.target?.last_name || ''}`.trim() || '—'}
            </Text>
            <Text style={styles.reasonLabel}>Причина</Text>
            <Text style={styles.text}>{record.reason || '—'}</Text>
            <Text style={styles.text}>
              Создано: {formatDateTime(record.created_at)}
            </Text>
            <Text style={styles.text}>
              Завершено: {formatDateTime(record.reviewed_at)}
            </Text>
          </View>
        )}

        {kind === 'blocked' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Пользователь</Text>
            <Text style={styles.text}>
              Имя: {`${record.first_name || ''} ${record.last_name || ''}`.trim() || '—'}
            </Text>
            <Text style={styles.text}>Email: {record.email || '—'}</Text>
            <Text style={styles.text}>Телефон: {record.phone || '—'}</Text>
            <Text style={styles.text}>Город: {record.city || '—'}</Text>
            <Text style={styles.text}>Страна: {record.country || '—'}</Text>
            <Text style={styles.text}>
              Обновлено: {formatDateTime(record.updated_at)}
            </Text>
          </View>
        )}

        {messages.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>История переписки</Text>

            {messages.map((msg) => (
              <View key={msg.id} style={styles.messageItem}>
                <Text style={styles.messageMeta}>
                  {msg.author_role === 'user'
                    ? 'Пользователь'
                    : msg.author_role === 'moderator'
                    ? 'Модератор'
                    : 'Система'}
                  {msg.created_at ? ` • ${formatDateTime(msg.created_at)}` : ''}
                </Text>
                <Text style={styles.messageText}>{msg.message}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Назад</Text>
        </TouchableOpacity>
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
    padding: 16,
    paddingTop: 64,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
  reasonLabel: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  messageItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e3e3e3',
  },
  messageMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 14,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
});