import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';

import {
  createInvite,
  getMyInvites,
  markInviteAsSent,
  getMyInvitedUsers,
  disableInvite,
} from '../services/inviteService';

type TabType = 'created' | 'sent' | 'invited';

function formatDate(dateString?: string | null) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('ru-RU');
}

export default function Invites() {
  const [invites, setInvites] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('created');

  const loadData = async () => {
    try {
      setLoading(true);

      const [invitesData, invitedUsersData] = await Promise.all([
        getMyInvites(),
        getMyInvitedUsers(),
      ]);

      setInvites(invitesData || []);
      setInvitedUsers(invitedUsersData || []);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка загрузки данных';
      Alert.alert('Ошибка', message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleCreateInvite = async () => {
    try {
      setCreating(true);

      const invite = await createInvite();
      setInvites((prev) => [invite, ...prev]);
      setActiveTab('created');

      const result = await Share.share({
        message: `Мой инвайт-код для Diaspora: ${invite.code}`,
      });

      if (result.action === Share.sharedAction) {
        const sentAt = new Date().toISOString();
        await markInviteAsSent(invite.id);

        setInvites((prev) =>
          prev.map((item) =>
            item.id === invite.id
              ? {
                  ...item,
                  sent_at: sentAt,
                }
              : item
          )
        );

        setActiveTab('sent');
      }

      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка создания инвайта';
      Alert.alert('Ошибка', message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyInvite = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert('Готово', 'Инвайт-код скопирован');
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать код');
    }
  };

  const handleShareInvite = async (invite: any) => {
    try {
      setSharingId(invite.id);

      const result = await Share.share({
        message: `Мой инвайт-код для Diaspora: ${invite.code}`,
      });

      if (result.action === Share.sharedAction) {
        const sentAt = new Date().toISOString();
        await markInviteAsSent(invite.id);

        setInvites((prev) =>
          prev.map((item) =>
            item.id === invite.id
              ? {
                  ...item,
                  sent_at: sentAt,
                }
              : item
          )
        );

        setActiveTab('sent');
        await loadData();
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка отправки инвайта';
      Alert.alert('Ошибка', message);
    } finally {
      setSharingId(null);
    }
  };

  const confirmDeleteInvite = (invite: any) => {
  Alert.alert(
    'Удалить инвайт?',
    'Инвайт исчезнет из списка и больше не сможет быть использован.',
    [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          void handleDeleteInvite(invite);
        },
      },
    ]
  );
};

const handleDeleteInvite = async (invite: any) => {
  try {
    setDeletingId(invite.id);
    await disableInvite(invite.id);
    setInvites((prev) => prev.filter((item) => item.id !== invite.id));
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Ошибка удаления инвайта';
    Alert.alert('Ошибка', message);
  } finally {
    setDeletingId(null);
  }
};

  const sortedInvites = useMemo(() => {
    return [...invites]
      .filter((invite) => !invite.is_disabled)
      .sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [invites]);

  const createdInvites = sortedInvites.filter(
    (invite) => !invite.is_used && !invite.sent_at
  );

  const sentInvites = sortedInvites.filter(
    (invite) => !invite.is_used && !!invite.sent_at
  );

  const createdCount = createdInvites.length;
  const sentCount = sentInvites.length;
  const invitedCount = invitedUsers.length;

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Инвайты</Text>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[
            styles.statCard,
            activeTab === 'created' && styles.activeStatCard,
          ]}
          activeOpacity={0.85}
          onPress={() => setActiveTab('created')}
        >
          <Text
            style={[
              styles.statNumber,
              activeTab === 'created' && styles.activeStatNumber,
            ]}
          >
            {createdCount}
          </Text>
          <Text
            style={[
              styles.statLabel,
              activeTab === 'created' && styles.activeStatLabel,
            ]}
          >
            Создано
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            activeTab === 'sent' && styles.activeStatCard,
          ]}
          activeOpacity={0.85}
          onPress={() => setActiveTab('sent')}
        >
          <Text
            style={[
              styles.statNumber,
              activeTab === 'sent' && styles.activeStatNumber,
            ]}
          >
            {sentCount}
          </Text>
          <Text
            style={[
              styles.statLabel,
              activeTab === 'sent' && styles.activeStatLabel,
            ]}
          >
            Отправлено
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statCard,
            activeTab === 'invited' && styles.activeStatCard,
          ]}
          activeOpacity={0.85}
          onPress={() => setActiveTab('invited')}
        >
          <Text
            style={[
              styles.statNumber,
              activeTab === 'invited' && styles.activeStatNumber,
            ]}
          >
            {invitedCount}
          </Text>
          <Text
            style={[
              styles.statLabel,
              activeTab === 'invited' && styles.activeStatLabel,
            ]}
          >
            Приглашённых
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, creating && styles.disabled]}
        onPress={handleCreateInvite}
        disabled={creating}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>
          {creating ? 'Создание...' : 'Создать и отправить инвайт'}
        </Text>
      </TouchableOpacity>

      {activeTab === 'created' && (
        <>
          <Text style={styles.sectionTitle}>Созданные инвайты</Text>

          {createdInvites.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>У вас пока нет инвайтов</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {createdInvites.map((invite) => (
                <View key={invite.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.code}>{invite.code}</Text>
                  </View>

                  {invite.created_at ? (
                    <Text style={styles.meta}>
                      Создан: {formatDate(invite.created_at)}
                    </Text>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleCopyInvite(invite.code)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionButtonText}>Копировать</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        sharingId === invite.id && styles.disabled,
                      ]}
                      onPress={() => handleShareInvite(invite)}
                      disabled={sharingId === invite.id}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionButtonText}>
                        {sharingId === invite.id ? 'Отправка...' : 'Отправить'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        deletingId === invite.id && styles.disabled,
                      ]}
                      onPress={() => confirmDeleteInvite(invite)}
                      disabled={deletingId === invite.id}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.deleteButtonText}>
                        {deletingId === invite.id ? 'Удаление...' : 'Удалить'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {activeTab === 'sent' && (
        <>
          <Text style={styles.sectionTitle}>Отправленные инвайты</Text>

          {sentInvites.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>У вас пока нет отправленных инвайтов</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {sentInvites.map((invite) => (
                <View key={invite.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.code}>{invite.code}</Text>
                    <View style={[styles.badge, styles.badgeSent]}>
                      <Text style={[styles.badgeText, styles.badgeSentText]}>
                        Отправлен
                      </Text>
                    </View>
                  </View>

                  {invite.sent_at ? (
                    <Text style={styles.meta}>
                      Отправлен: {formatDate(invite.sent_at)}
                    </Text>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleCopyInvite(invite.code)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.actionButtonText}>Копировать</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        deletingId === invite.id && styles.disabled,
                      ]}
                      onPress={() => confirmDeleteInvite(invite)}
                      disabled={deletingId === invite.id}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.deleteButtonText}>
                        {deletingId === invite.id ? 'Удаление...' : 'Удалить'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {activeTab === 'invited' && (
        <>
          <Text style={styles.sectionTitle}>Мои приглашённые</Text>

          {invitedUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Пока никто не зарегистрировался по вашим инвайтам
              </Text>
            </View>
          ) : (
            <View style={styles.invitedListContainer}>
              {invitedUsers.map((item) => (
                <View key={item.invite_id} style={styles.invitedRow}>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 70,
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
    fontWeight: '700',
    marginBottom: 20,
    color: '#111',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statCard: {
    width: '31.5%',
    backgroundColor: '#fafafa',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  activeStatCard: {
    backgroundColor: '#EDF7EE',
    borderColor: '#2E7D32',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  activeStatNumber: {
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
  },
  activeStatLabel: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  primaryButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
    color: '#111',
  },
  listContainer: {
    width: '100%',
  },
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  code: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeActive: {
    backgroundColor: '#EAF7EC',
  },
  badgeSent: {
    backgroundColor: '#FFF4E5',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeActiveText: {
    color: '#2E7D32',
  },
  badgeSentText: {
    color: '#B26A00',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7e7e7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#f0d3d3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#b23b3b',
  },
  invitedListContainer: {
    width: '100%',
  },
  invitedRow: {
    width: '100%',
    backgroundColor: '#fafafa',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  emptyCard: {
    backgroundColor: '#fafafa',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.5,
  },
});