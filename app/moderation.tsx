import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../services/sessionService';
import {
  getPendingUsers,
  approveUser,
  rejectUser,
  getPendingNameChangeRequests,
  approveNameChangeRequest,
  rejectNameChangeRequest,
  getBlockedUsers,
  unblockUser,
  getPendingComplaints,
  resolveComplaint,
  rejectComplaint,
  takeUserModeration,
  takeNameChangeRequest,
  takeComplaint,
} from '../services/moderationService';

type QueueTab = 'new' | 'in_progress' | 'needs_revision' | 'done';
type OwnershipFilter = 'all' | 'mine';

type ModerationAction =
  | {
      type:
        | 'reject_user'
        | 'revision_user'
        | 'reject_name_change'
        | 'reject_complaint'
        | 'reject_invite_request';
      targetId: string;
      title: string;
      placeholder: string;
      confirmText: string;
    }
  | null;

type UnifiedItem = {
  id: string;
  kind:
    | 'registration'
    | 'invite_request'
    | 'name_change'
    | 'complaint'
    | 'blocked';
  queue: QueueTab;
  createdAt?: string | null;
  assignedTo?: string | null;
  assignedName?: string | null;
  takenAt?: string | null;
  badge: string;
  title: string;
  subtitle?: string;
  raw: any;
};

export default function ModerationScreen() {
  const [activeTab, setActiveTab] = useState<QueueTab>('new');
  const [ownershipFilter, setOwnershipFilter] =
  useState<OwnershipFilter>('all');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(
    {}
  );
  const [me, setMe] = useState<any>(null);

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [inviteRequests, setInviteRequests] = useState<any[]>([]);
  const [nameRequests, setNameRequests] = useState<any[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);

  const [completedUsers, setCompletedUsers] = useState<any[]>([]);
  const [completedInviteRequests, setCompletedInviteRequests] = useState<any[]>(
    []
  );
  const [completedNameRequests, setCompletedNameRequests] = useState<any[]>([]);
  const [completedComplaints, setCompletedComplaints] = useState<any[]>([]);

  const [latestInviteMessages, setLatestInviteMessages] = useState<
    Record<string, any[]>
  >({});
  const [loading, setLoading] = useState(true);

  const [actionModal, setActionModal] = useState<ModerationAction>(null);
  const [actionComment, setActionComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const toggleCard = (cardId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const openActionModal = (action: NonNullable<ModerationAction>) => {
    setActionComment('');
    setActionModal(action);
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionComment('');
  };

  const loadInviteRequests = async () => {
    const { data, error } = await supabase
      .from('invite_requests')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedUsers = async () => {
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
      .in('moderation_status', ['approved', 'rejected'])
      .eq('is_deleted', false)
      .not('moderation_completed_at', 'is', null)
      .order('moderation_completed_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedInviteRequests = async () => {
    const { data, error } = await supabase
      .from('invite_requests')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .not('final_decision_at', 'is', null)
      .order('final_decision_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedNameRequests = async () => {
    const { data, error } = await supabase
      .from('name_change_requests')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadCompletedComplaints = async () => {
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
      .in('status', ['resolved', 'rejected'])
      .not('reviewed_at', 'is', null)
      .order('reviewed_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  };

  const loadLatestInviteMessages = async (users: any[]) => {
    try {
      const userIds = users.map((user) => user.id).filter(Boolean);

      if (userIds.length === 0) {
        setLatestInviteMessages({});
        return;
      }

      const { data, error } = await supabase
        .from('moderation_messages')
        .select('*')
        .eq('request_type', 'invite_request')
        .in('request_id', userIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const map: Record<string, any[]> = {};

      for (const item of data || []) {
        if (!map[item.request_id]) {
          map[item.request_id] = [];
        }
        if (map[item.request_id].length < 5) {
          map[item.request_id].push(item);
        }
      }

      Object.keys(map).forEach((key) => {
        map[key] = [...map[key]].reverse();
      });

      setLatestInviteMessages(map);
    } catch (e) {
      console.log('Ошибка загрузки сообщений модерации:', e);
      setLatestInviteMessages({});
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [
        profile,
        users,
        inviteReqs,
        requests,
        blocked,
        complaintsData,
        finishedUsers,
        finishedInviteRequests,
        finishedNameRequests,
        finishedComplaints,
      ] = await Promise.all([
        getCurrentProfile(),
        getPendingUsers(),
        loadInviteRequests(),
        getPendingNameChangeRequests(),
        getBlockedUsers(),
        getPendingComplaints(),
        loadCompletedUsers(),
        loadCompletedInviteRequests(),
        loadCompletedNameRequests(),
        loadCompletedComplaints(),
      ]);

      setMe(profile);
      setPendingUsers(users);
      setInviteRequests(inviteReqs);
      setNameRequests(requests);
      setBlockedUsers(blocked);
      setComplaints(complaintsData);

      setCompletedUsers(finishedUsers);
      setCompletedInviteRequests(finishedInviteRequests);
      setCompletedNameRequests(finishedNameRequests);
      setCompletedComplaints(finishedComplaints);

      await loadLatestInviteMessages(users);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка загрузки модерации';
      Alert.alert('Ошибка', message);
    } finally {
      setLoading(false);
    }
  };

  const refreshOneUser = async (userId: string) => {
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
        ),
        assigned_moderator:moderation_assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', userId)
      .single();

    if (error) throw new Error(error.message);

    setPendingUsers((prev) =>
      prev.map((item) => (item.id === userId ? data : item))
    );
  };

  const refreshOneInviteRequest = async (requestId: string) => {
    const { data, error } = await supabase
      .from('invite_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error) throw new Error(error.message);

    setInviteRequests((prev) =>
      prev.map((item) => (item.id === requestId ? data : item))
    );
  };

  const refreshOneNameChange = async (requestId: string) => {
    const { data, error } = await supabase
      .from('name_change_requests')
      .select(`
        *,
        assigned_moderator:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', requestId)
      .single();

    if (error) throw new Error(error.message);

    setNameRequests((prev) =>
      prev.map((item) => (item.id === requestId ? data : item))
    );
  };

  const refreshOneComplaint = async (complaintId: string) => {
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
        ),
        assigned_moderator:assigned_to (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', complaintId)
      .single();

    if (error) throw new Error(error.message);

    setComplaints((prev) =>
      prev.map((item) => (item.id === complaintId ? data : item))
    );
  };

  const markRegistrationRead = async (userId: string) => {
    try {
      const target = pendingUsers.find((item) => item.id === userId);
      if (!target?.moderator_has_unread_changes) return;

      const { error } = await supabase
        .from('users')
        .update({
          moderator_has_unread_changes: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw new Error(error.message);

      setPendingUsers((prev) =>
        prev.map((item) =>
          item.id === userId
            ? { ...item, moderator_has_unread_changes: false }
            : item
        )
      );
    } catch (e) {
      console.log('Не удалось сбросить маркер изменений:', e);
    }
  };

  const handleRegistrationCardPress = async (userId: string) => {
    const cardId = `registration-${userId}`;
    const isOpening = !expandedCards[cardId];

    toggleCard(cardId);

    if (isOpening) {
      await markRegistrationRead(userId);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const myDisplayName =
    `${me?.first_name || ''} ${me?.last_name || ''}`.trim() ||
    'Неизвестный модератор';

  const isOwner = me?.role === 'owner';

  const canManageAssignedTask = (assignedTo?: string | null) => {
    if (isOwner) return true;
    if (!assignedTo) return false;
    return assignedTo === me?.id;
  };

  const formatShortDate = (dateString?: string | null) => {
    if (!dateString) return '—';

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDuration = (dateString?: string | null) => {
    if (!dateString) return null;

    const start = new Date(dateString).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - start);

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}д ${hours}ч`;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    return `${minutes}м`;
  };

  const formatResolutionDuration = (
    createdAt?: string | null,
    completedAt?: string | null
  ) => {
    if (!createdAt || !completedAt) return null;

    const start = new Date(createdAt).getTime();
    const end = new Date(completedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
      return null;
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

  const getTaskAgeLevel = (dateString?: string | null) => {
    if (!dateString) return 'normal';

    const start = new Date(dateString).getTime();
    const now = Date.now();
    const diffHours = (now - start) / (1000 * 60 * 60);

    if (diffHours >= 24) return 'critical';
    if (diffHours >= 6) return 'warning';
    return 'normal';
  };

  const getTaskStatusText = (
    assignedName?: string | null,
    takenAt?: string | null
  ) => {
    if (!assignedName) return 'Свободна';

    const duration = formatDuration(takenAt);
    return duration
      ? `В работе у ${assignedName} • ${duration}`
      : `В работе у ${assignedName}`;
  };

  const getTaskPriorityScore = (
    assignedName?: string | null,
    takenAt?: string | null,
    createdAt?: string | null
  ) => {
    const ageLevel = getTaskAgeLevel(takenAt);

    if (ageLevel === 'critical') return 0;
    if (ageLevel === 'warning') return 1;
    if (assignedName) return 2;
    if (createdAt) return 3;

    return 4;
  };

  const getArchiveStatusStyle = (statusLabel: string) => {
    const normalized = String(statusLabel || '').toLowerCase();

    if (normalized.includes('одобрено') || normalized.includes('принято')) {
      return {
        container: styles.archiveChipApproved,
        text: styles.archiveChipApprovedText,
      };
    }

    if (normalized.includes('отклонено')) {
      return {
        container: styles.archiveChipRejected,
        text: styles.archiveChipRejectedText,
      };
    }

    if (normalized.includes('разблокирован')) {
      return {
        container: styles.archiveChipNeutral,
        text: styles.archiveChipNeutralText,
      };
    }

    return {
      container: styles.archiveChipNeutral,
      text: styles.archiveChipNeutralText,
    };
  };

  const handleTakeUser = async (userId: string) => {
    try {
      await takeUserModeration(userId);
      await refreshOneUser(userId);
    } catch {
      Alert.alert(
        'Нельзя принять заявку',
        'Эту заявку уже взял другой модератор.'
      );

      try {
        await refreshOneUser(userId);
      } catch (refreshError) {
        console.log('Ошибка обновления карточки:', refreshError);
      }
    }
  };

  const handleTakeInviteRequest = async (requestId: string) => {
    try {
      if (isOwner) {
        const { error } = await supabase
          .from('invite_requests')
          .update({
            assigned_to: me.id,
            assigned_name: myDisplayName,
            taken_at: new Date().toISOString(),
          })
          .eq('id', requestId);

        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from('invite_requests')
          .update({
            assigned_to: me.id,
            assigned_name: myDisplayName,
            taken_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .is('assigned_to', null)
          .select('id')
          .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) throw new Error('Заявка уже занята');
      }

      await refreshOneInviteRequest(requestId);
    } catch {
      Alert.alert(
        'Нельзя принять заявку',
        'Эту заявку уже взял другой модератор.'
      );

      try {
        await refreshOneInviteRequest(requestId);
      } catch (refreshError) {
        console.log('Ошибка обновления карточки:', refreshError);
      }
    }
  };

  const handleTakeNameChange = async (requestId: string) => {
    try {
      await takeNameChangeRequest(requestId);
      await refreshOneNameChange(requestId);
    } catch {
      Alert.alert(
        'Нельзя принять заявку',
        'Эту заявку уже взял другой модератор.'
      );

      try {
        await refreshOneNameChange(requestId);
      } catch (refreshError) {
        console.log('Ошибка обновления карточки:', refreshError);
      }
    }
  };

  const handleTakeComplaint = async (complaintId: string) => {
    try {
      await takeComplaint(complaintId);
      await refreshOneComplaint(complaintId);
    } catch {
      Alert.alert(
        'Нельзя принять заявку',
        'Эту заявку уже взял другой модератор.'
      );

      try {
        await refreshOneComplaint(complaintId);
      } catch (refreshError) {
        console.log('Ошибка обновления карточки:', refreshError);
      }
    }
  };

  const handleApproveUser = async (user: any) => {
    try {
      await approveUser(user.id);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка одобрения анкеты';
      Alert.alert('Ошибка', message);
    }
  };

  const handleApproveInviteRequest = async (request: any) => {
    try {
      const { error } = await supabase
        .from('invite_requests')
        .update({
          status: 'approved',
          reviewed_by_user_id: me.id,
          completed_by_name: myDisplayName,
          final_decision_at: new Date().toISOString(),
          assigned_to: null,
          assigned_name: null,
          taken_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (error) throw new Error(error.message);

      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка одобрения заявки';
      Alert.alert('Ошибка', message);
    }
  };

  const handleApproveNameChange = async (request: any) => {
    try {
      await approveNameChangeRequest(request);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка одобрения изменения ФИО';
      Alert.alert('Ошибка', message);
    }
  };

  const handleResolveComplaint = async (complaint: any) => {
    try {
      await resolveComplaint(complaint.id);
      await loadData();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Ошибка обработки жалобы';
      Alert.alert('Ошибка', message);
    }
  };

  const handleRejectUser = (userId: string) => {
    openActionModal({
      type: 'reject_user',
      targetId: userId,
      title: 'Отклонение анкеты',
      placeholder: 'Укажите причину отклонения',
      confirmText: 'Отклонить',
    });
  };

  const handleRevisionUser = (userId: string) => {
    openActionModal({
      type: 'revision_user',
      targetId: userId,
      title: 'Вернуть на доработку',
      placeholder: 'Укажите, что нужно исправить',
      confirmText: 'Отправить',
    });
  };

  const handleRejectInviteRequest = (requestId: string) => {
    openActionModal({
      type: 'reject_invite_request',
      targetId: requestId,
      title: 'Отклонение заявки',
      placeholder: 'Укажите причину отклонения',
      confirmText: 'Отклонить',
    });
  };

  const handleRejectNameChange = (requestId: string) => {
    openActionModal({
      type: 'reject_name_change',
      targetId: requestId,
      title: 'Отклонение смены ФИО',
      placeholder: 'Укажите причину отклонения',
      confirmText: 'Отклонить',
    });
  };

  const handleRejectComplaint = (complaintId: string) => {
    openActionModal({
      type: 'reject_complaint',
      targetId: complaintId,
      title: 'Отклонение жалобы',
      placeholder: 'Укажите причину отклонения',
      confirmText: 'Отклонить',
    });
  };

  const handleOpenDraftProfile = (userId: string) => {
    router.push({
      pathname: '/user-profile',
      params: {
        userId,
        mode: 'moderation',
      },
    });
  };

  const handleUnblockUser = async (user: any) => {
    try {
      await unblockUser(user.id);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка разблокировки';
      Alert.alert('Ошибка', message);
    }
  };

  const submitActionModal = async () => {
    if (!actionModal) return;

    try {
      setSubmittingAction(true);
      const comment = actionComment.trim() || undefined;

      if (actionModal.type === 'reject_user') {
        await rejectUser(actionModal.targetId, comment, 'reject');
      } else if (actionModal.type === 'revision_user') {
        await rejectUser(actionModal.targetId, comment, 'revision');
      } else if (actionModal.type === 'reject_invite_request') {
        const { error } = await supabase
          .from('invite_requests')
          .update({
            status: 'rejected',
            review_note: comment || 'Заявка отклонена',
            reviewed_by_user_id: me.id,
            completed_by_name: myDisplayName,
            final_decision_at: new Date().toISOString(),
            assigned_to: null,
            assigned_name: null,
            taken_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', actionModal.targetId);

        if (error) throw new Error(error.message);
      } else if (actionModal.type === 'reject_name_change') {
        await rejectNameChangeRequest(actionModal.targetId, comment);
      } else if (actionModal.type === 'reject_complaint') {
        await rejectComplaint(actionModal.targetId);
      }

      setActionModal(null);
      setActionComment('');
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Ошибка действия';
      Alert.alert('Ошибка', message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const renderInviteMessages = (userId: string) => {
    const latestMessages = latestInviteMessages[userId] || [];
    if (latestMessages.length === 0) return null;

    return (
      <View style={styles.messageBox}>
        <Text style={styles.messageLabel}>Диалог</Text>

        {latestMessages.map((msg) => (
          <View key={msg.id} style={styles.messageItem}>
            <Text style={styles.messageMeta}>
              {msg.author_role === 'user'
                ? 'Пользователь'
                : msg.author_role === 'moderator'
                ? 'Модератор'
                : 'Система'}
            </Text>
            <Text style={styles.messageText} numberOfLines={4}>
              {msg.message}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    pendingUsers.forEach((user) => {
      items.push({
        id: `registration-${user.id}`,
        kind: 'registration',
        queue:
          user.moderation_status === 'needs_revision'
            ? 'needs_revision'
            : user.moderation_assigned_to
            ? 'in_progress'
            : 'new',
        createdAt: user.created_at,
        assignedTo: user.moderation_assigned_to,
        assignedName: user.moderation_assigned_name,
        takenAt: user.moderation_taken_at,
        badge: 'Регистрация',
        title: `${user.first_name} ${user.last_name}`,
        subtitle: user.email || undefined,
        raw: user,
      });
    });

    inviteRequests.forEach((request) => {
      items.push({
        id: `invite_request-${request.id}`,
        kind: 'invite_request',
        queue: request.assigned_to ? 'in_progress' : 'new',
        createdAt: request.created_at,
        assignedTo: request.assigned_to,
        assignedName: request.assigned_name,
        takenAt: request.taken_at,
        badge: 'Заявка',
        title: request.full_name || 'Без имени',
        subtitle: request.phone || request.telegram || undefined,
        raw: request,
      });
    });

    nameRequests.forEach((request) => {
      items.push({
        id: `name_change-${request.id}`,
        kind: 'name_change',
        queue: request.assigned_to ? 'in_progress' : 'new',
        createdAt: request.created_at,
        assignedTo: request.assigned_to,
        assignedName: request.assigned_name,
        takenAt: request.taken_at,
        badge: 'Смена ФИО',
        title: `${request.current_first_name} ${request.current_last_name}`,
        subtitle: `→ ${request.requested_first_name} ${request.requested_last_name}`,
        raw: request,
      });
    });

    complaints.forEach((complaint) => {
      items.push({
        id: `complaint-${complaint.id}`,
        kind: 'complaint',
        queue: complaint.assigned_to ? 'in_progress' : 'new',
        createdAt: complaint.created_at,
        assignedTo: complaint.assigned_to,
        assignedName: complaint.assigned_name,
        takenAt: complaint.taken_at,
        badge: 'Жалоба',
        title: `На: ${complaint.target?.first_name || ''} ${complaint.target?.last_name || ''}`.trim(),
        subtitle: `От: ${complaint.reporter?.first_name || ''} ${complaint.reporter?.last_name || ''}`.trim(),
        raw: complaint,
      });
    });

    blockedUsers.forEach((user) => {
      items.push({
        id: `blocked-${user.id}`,
        kind: 'blocked',
        queue: 'in_progress',
        createdAt: user.updated_at,
        badge: 'Блокировка',
        title: `${user.first_name} ${user.last_name}`,
        subtitle: user.email || undefined,
        raw: user,
      });
    });

    completedUsers.forEach((user) => {
      items.push({
        id: `done-registration-${user.id}`,
        kind: 'registration',
        queue: 'done',
        createdAt: user.created_at,
        badge: 'Регистрация',
        title:
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          'Без имени',
        subtitle: user.moderation_note || undefined,
        raw: {
          entityId: user.id,
          type: 'registration',
          title:
            `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
            'Без имени',
          subtitle: user.moderation_note || undefined,
          statusLabel:
            user.moderation_status === 'approved' ? 'Одобрено' : 'Отклонено',
          moderatorName: user.moderation_completed_by_name || undefined,
          createdAt: user.created_at,
          startedAt: user.moderation_taken_at,
          completedAt: user.moderation_completed_at,
        },
      });
    });

    completedInviteRequests.forEach((request) => {
      items.push({
        id: `done-invite_request-${request.id}`,
        kind: 'invite_request',
        queue: 'done',
        createdAt: request.created_at,
        badge: 'Заявка',
        title: request.full_name || 'Без имени',
        subtitle: request.review_note || undefined,
        raw: {
          entityId: request.id,
          type: 'invite_request',
          title: request.full_name || 'Без имени',
          subtitle: request.review_note || undefined,
          statusLabel: request.status === 'approved' ? 'Одобрено' : 'Отклонено',
          moderatorName: request.completed_by_name || undefined,
          createdAt: request.created_at,
          startedAt: request.taken_at,
          completedAt: request.final_decision_at,
        },
      });
    });

    completedNameRequests.forEach((request) => {
      items.push({
        id: `done-name_change-${request.id}`,
        kind: 'name_change',
        queue: 'done',
        createdAt: request.created_at,
        badge: 'Смена ФИО',
        title: `${request.current_first_name} ${request.current_last_name}`,
        subtitle:
          request.review_note ||
          `→ ${request.requested_first_name} ${request.requested_last_name}`,
        raw: {
          entityId: request.id,
          type: 'name_change',
          title: `${request.current_first_name} ${request.current_last_name}`,
          subtitle:
            request.review_note ||
            `→ ${request.requested_first_name} ${request.requested_last_name}`,
          statusLabel: request.status === 'approved' ? 'Одобрено' : 'Отклонено',
          moderatorName: request.completed_by_name || undefined,
          createdAt: request.created_at,
          startedAt: request.taken_at,
          completedAt: request.reviewed_at,
        },
      });
    });

    completedComplaints.forEach((complaint) => {
      items.push({
        id: `done-complaint-${complaint.id}`,
        kind: 'complaint',
        queue: 'done',
        createdAt: complaint.created_at,
        badge: 'Жалоба',
        title: `Жалоба на ${complaint.target?.first_name || ''} ${complaint.target?.last_name || ''}`.trim(),
        subtitle: complaint.review_note || complaint.reason || undefined,
        raw: {
          entityId: complaint.id,
          type: 'complaint',
          title: `Жалоба на ${complaint.target?.first_name || ''} ${complaint.target?.last_name || ''}`.trim(),
          subtitle: complaint.review_note || complaint.reason || undefined,
          statusLabel:
            complaint.status === 'resolved' ? 'Принято' : 'Отклонено',
          moderatorName: complaint.completed_by_name || undefined,
          createdAt: complaint.created_at,
          startedAt: complaint.taken_at,
          completedAt: complaint.reviewed_at,
        },
      });
    });

    return items
  .filter((item) => item.queue === activeTab)
  .filter((item) => {
    const shouldApplyOwnershipFilter =
      activeTab === 'in_progress' || activeTab === 'needs_revision';

    if (!shouldApplyOwnershipFilter) return true;
    if (ownershipFilter === 'all') return true;

    return item.assignedTo === me?.id;
  })
  .sort((a, b) => {
    const priorityDiff =
      getTaskPriorityScore(a.assignedName, a.takenAt, a.createdAt) -
      getTaskPriorityScore(b.assignedName, b.takenAt, b.createdAt);

    if (priorityDiff !== 0) return priorityDiff;

    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  });
  }, [
    activeTab,
  ownershipFilter,
  me?.id,
  pendingUsers,
  inviteRequests,
  nameRequests,
  complaints,
  blockedUsers,
  completedUsers,
  completedInviteRequests,
  completedNameRequests,
  completedComplaints,
  ]);

  const centeredCount = useMemo(() => {
    return (
      pendingUsers.length +
      inviteRequests.length +
      nameRequests.length +
      complaints.length +
      blockedUsers.length
    );
  }, [
    pendingUsers.length,
    inviteRequests.length,
    nameRequests.length,
    complaints.length,
    blockedUsers.length,
  ]);
  const myTasksCount = useMemo(() => {
  const myId = me?.id;
  if (!myId) return 0;

  return (
    pendingUsers.filter((item) => item.moderation_assigned_to === myId).length +
    inviteRequests.filter((item) => item.assigned_to === myId).length +
    nameRequests.filter((item) => item.assigned_to === myId).length +
    complaints.filter((item) => item.assigned_to === myId).length
  );
}, [
  me?.id,
  pendingUsers,
  inviteRequests,
  nameRequests,
  complaints,
]);
  const renderUnifiedCard = (item: UnifiedItem) => {
    if (item.queue === 'done') {
      const archiveItem = item.raw;
      const statusStyle = getArchiveStatusStyle(archiveItem.statusLabel);
      const resolutionTime = formatResolutionDuration(
        archiveItem.createdAt,
        archiveItem.completedAt
      );
      const isExpanded = !!expandedCards[item.id];

      return (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => toggleCard(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderMain}>
              <Text style={styles.name}>{archiveItem.title}</Text>
              <Text style={styles.cardCollapsedHint}>
                {formatShortDate(archiveItem.completedAt)}
              </Text>
            </View>

            <View style={[styles.archiveChip, statusStyle.container]}>
              <Text style={[styles.archiveChipText, statusStyle.text]}>
                {archiveItem.statusLabel}
              </Text>
            </View>
          </View>

          {isExpanded && (
            <>
              {!!archiveItem.subtitle && (
                <Text style={styles.mutedText}>{archiveItem.subtitle}</Text>
              )}

              <Text style={styles.text}>Тип: {item.badge}</Text>

              {!!archiveItem.moderatorName && (
                <Text style={styles.text}>
                  Обработал: {archiveItem.moderatorName}
                </Text>
              )}

              {!!resolutionTime && (
                <Text style={styles.text}>
                  От создания до завершения: {resolutionTime}
                </Text>
              )}

              <TouchableOpacity
                style={styles.secondaryActionFull}
                onPress={() =>
                  router.push({
                    pathname: '/moderation-case-details',
                    params: {
                      kind: archiveItem.type,
                      entityId: archiveItem.entityId,
                    },
                  })
                }
              >
                <Text style={styles.secondaryActionFullText}>Изучить</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (item.kind === 'registration') {
            handleRegistrationCardPress(item.raw.id);
          } else {
            toggleCard(item.id);
          }
        }}
      >
        <View
          style={[
            styles.statusLine,
            getTaskAgeLevel(item.takenAt) === 'critical'
              ? styles.statusLineCritical
              : getTaskAgeLevel(item.takenAt) === 'warning'
              ? styles.statusLineWarning
              : styles.statusLineNormal,
          ]}
        >
          <Text style={styles.statusLineText}>
            {item.kind === 'blocked'
              ? 'Заблокирован'
              : getTaskStatusText(item.assignedName, item.takenAt)}
          </Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            {item.kind === 'registration' ? (
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.title}</Text>
                {item.raw?.moderator_has_unread_changes && (
                  <View style={styles.unreadDot} />
                )}
              </View>
            ) : (
              <Text style={styles.name}>{item.title}</Text>
            )}
            <Text style={styles.cardCollapsedHint}>Нажмите, чтобы раскрыть</Text>
          </View>
          <View
            style={[
              styles.statusChip,
              item.kind === 'blocked' && styles.statusChipBlocked,
            ]}
          >
            <Text style={styles.statusChipText}>{item.badge}</Text>
          </View>
        </View>

        {expandedCards[item.id] && (
          <>
            {item.kind === 'registration' &&
              (() => {
                const user = item.raw;
                return (
                  <>
                    <View style={styles.infoBlock}>
                      <Text style={styles.text}>
                        Телефон: {user.phone || 'Без телефона'}
                      </Text>
                      <Text style={styles.text}>
                        Пригласил:{' '}
                        {user.invited_by
                          ? `${user.invited_by.first_name || ''} ${user.invited_by.last_name || ''}`.trim() ||
                            user.invited_by.email ||
                            'Неизвестно'
                          : 'Неизвестно'}
                      </Text>
                      <Text style={styles.text}>
                        Профессия: {user.profession || '—'}
                      </Text>
                    </View>

                    {renderInviteMessages(user.id)}

                    <TouchableOpacity
                      style={styles.secondaryActionFull}
                      onPress={() => handleOpenDraftProfile(user.id)}
                    >
                      <Text style={styles.secondaryActionFullText}>
                        Открыть профиль
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.assignmentBlock}>
                      {!user.moderation_assigned_to &&
                      user.moderation_status !== 'needs_revision' ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeUser(user.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(user.moderation_assigned_to) ? (
                        <View style={styles.actionGrid}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveUser(user)}
                          >
                            <Text style={styles.actionButtonText}>Одобрить</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.warningAction}
                            onPress={() => handleRevisionUser(user.id)}
                          >
                            <Text style={styles.actionButtonText}>
                              На доработку
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectUser(user.id)}
                          >
                            <Text style={styles.actionButtonText}>Отклонить</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Заявка уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === 'invite_request' &&
              (() => {
                const request = item.raw;
                return (
                  <>
                    {!!request.phone && (
                      <Text style={styles.text}>Телефон: {request.phone}</Text>
                    )}
                    {!!request.telegram && (
                      <Text style={styles.text}>
                        Telegram: {request.telegram}
                      </Text>
                    )}
                    {!!request.about && (
                      <>
                        <Text style={styles.reasonLabel}>О себе</Text>
                        <Text style={styles.text}>{request.about}</Text>
                      </>
                    )}

                    <View style={styles.assignmentBlock}>
                      {!request.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeInviteRequest(request.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(request.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveInviteRequest(request)}
                          >
                            <Text style={styles.actionButtonText}>Одобрить</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectInviteRequest(request.id)}
                          >
                            <Text style={styles.actionButtonText}>Отклонить</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Заявка уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === 'name_change' &&
              (() => {
                const request = item.raw;
                return (
                  <>
                    <Text style={styles.mutedText}>
                      → {request.requested_first_name}{' '}
                      {request.requested_last_name}
                    </Text>

                    <Text style={styles.reasonLabel}>Причина</Text>
                    <Text style={styles.text}>{request.reason}</Text>

                    <View style={styles.assignmentBlock}>
                      {!request.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeNameChange(request.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(request.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleApproveNameChange(request)}
                          >
                            <Text style={styles.actionButtonText}>Одобрить</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectNameChange(request.id)}
                          >
                            <Text style={styles.actionButtonText}>Отклонить</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Запрос уже взят в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === 'complaint' &&
              (() => {
                const complaint = item.raw;
                return (
                  <>
                    <Text style={styles.mutedText}>
                      От: {complaint.reporter?.first_name || ''}{' '}
                      {complaint.reporter?.last_name || ''}
                    </Text>

                    <Text style={styles.reasonLabel}>Причина</Text>
                    <Text style={styles.text}>{complaint.reason}</Text>

                    <View style={styles.assignmentBlock}>
                      {!complaint.assigned_to ? (
                        <TouchableOpacity
                          style={styles.takeAction}
                          onPress={() => handleTakeComplaint(complaint.id)}
                        >
                          <Text style={styles.actionButtonText}>Принять</Text>
                        </TouchableOpacity>
                      ) : canManageAssignedTask(complaint.assigned_to) ? (
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={() => handleResolveComplaint(complaint)}
                          >
                            <Text style={styles.actionButtonText}>
                              Принять жалобу
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.dangerAction}
                            onPress={() => handleRejectComplaint(complaint.id)}
                          >
                            <Text style={styles.actionButtonText}>Отклонить</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.lockedText}>
                          Жалоба уже взята в работу другим модератором
                        </Text>
                      )}
                    </View>
                  </>
                );
              })()}

            {item.kind === 'blocked' &&
              (() => {
                const user = item.raw;
                return (
                  <>
                    <Text style={styles.mutedText}>
                      {user.email || 'Без email'}
                    </Text>
                    <Text style={styles.text}>
                      {user.city || '—'}, {user.country || '—'}
                    </Text>

                    <TouchableOpacity
                      style={styles.primaryActionFull}
                      onPress={() => handleUnblockUser(user)}
                    >
                      <Text style={styles.actionButtonText}>
                        Снять блокировку
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
          </>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Модерация</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
            <Text style={styles.refreshButtonText}>Обновить</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centerCounterWrap}>
  <View style={styles.countersInline}>
    <View style={styles.counterItem}>
      <Text style={styles.centerCounterValue}>{centeredCount}</Text>
      <Text style={styles.centerCounterLabel}>всего активных</Text>
    </View>

    <View style={styles.counterDivider} />

    <View style={styles.counterItem}>
      <Text style={styles.centerCounterValue}>{myTasksCount}</Text>
      <Text style={styles.centerCounterLabel}>моих задач</Text>
    </View>
  </View>
</View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'new' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('new')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'new' && styles.tabButtonTextActive,
              ]}
            >
              Новое
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'in_progress' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('in_progress')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'in_progress' && styles.tabButtonTextActive,
              ]}
            >
              В работе
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'needs_revision' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('needs_revision')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'needs_revision' && styles.tabButtonTextActive,
              ]}
            >
              На доработке
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'done' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('done')}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === 'done' && styles.tabButtonTextActive,
              ]}
            >
              Завершено
            </Text>
          </TouchableOpacity>
        </View>

        {(activeTab === 'in_progress' || activeTab === 'needs_revision') && (
  <View style={styles.subTabsRow}>
    <TouchableOpacity
      style={[
        styles.subTabButton,
        ownershipFilter === 'all' && styles.subTabButtonActive,
      ]}
      onPress={() => setOwnershipFilter('all')}
    >
      <Text
        style={[
          styles.subTabButtonText,
          ownershipFilter === 'all' && styles.subTabButtonTextActive,
        ]}
      >
        Все
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.subTabButton,
        ownershipFilter === 'mine' && styles.subTabButtonActive,
      ]}
      onPress={() => setOwnershipFilter('mine')}
    >
      <Text
        style={[
          styles.subTabButtonText,
          ownershipFilter === 'mine' && styles.subTabButtonTextActive,
        ]}
      >
        Мои
      </Text>
    </TouchableOpacity>
  </View>
)}
        <ScrollView contentContainerStyle={styles.container}>
          {unifiedItems.length === 0 ? (
            <Text style={styles.emptyText}>Список пуст</Text>
          ) : (
            unifiedItems.map(renderUnifiedCard)
          )}
        </ScrollView>
      </View>

      <Modal
        visible={!!actionModal}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{actionModal?.title}</Text>

            <TextInput
              style={styles.modalInput}
              value={actionComment}
              onChangeText={setActionComment}
              placeholder={actionModal?.placeholder}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeActionModal}
                disabled={submittingAction}
              >
                <Text style={styles.modalCancelButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={submitActionModal}
                disabled={submittingAction}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {submittingAction
                    ? 'Сохранение...'
                    : actionModal?.confirmText || 'Сохранить'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  countersInline: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},

counterItem: {
  alignItems: 'center',
  minWidth: 110,
},

counterDivider: {
  width: 1,
  height: 42,
  backgroundColor: '#e0e0e0',
  marginHorizontal: 18,
},
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 64,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#d8e3d8',
    backgroundColor: '#f7faf7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  centerCounterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 14,
  },
  centerCounterValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#111',
  },
  centerCounterLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  subTabsRow: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  paddingBottom: 10,
},

subTabButton: {
  backgroundColor: '#f4f6f4',
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  marginRight: 8,
},

subTabButtonActive: {
  backgroundColor: '#111',
},

subTabButtonText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#555',
},

subTabButtonTextActive: {
  color: '#fff',
},
  tabButton: {
    backgroundColor: '#f4f6f4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  tabButtonActive: {
    backgroundColor: '#2E7D32',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#444',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  emptyText: {
    color: '#777',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderMain: {
    flex: 1,
    paddingRight: 10,
  },
  cardCollapsedHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
  },
  statusLine: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusLineNormal: {
    backgroundColor: '#eef6ee',
  },
  statusLineWarning: {
    backgroundColor: '#fff6e5',
  },
  statusLineCritical: {
    backgroundColor: '#fff1f1',
  },
  statusLineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  statusChip: {
    borderRadius: 999,
    backgroundColor: '#eef6ee',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipBlocked: {
    backgroundColor: '#fff2f2',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E7D32',
  },
  archiveChip: {
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  archiveChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4456a6',
  },
  archiveChipApproved: {
    backgroundColor: '#e8f5e9',
  },
  archiveChipApprovedText: {
    color: '#2E7D32',
  },
  archiveChipRejected: {
    backgroundColor: '#fdecec',
  },
  archiveChipRejectedText: {
    color: '#c62828',
  },
  archiveChipNeutral: {
    backgroundColor: '#eef2ff',
  },
  archiveChipNeutralText: {
    color: '#4456a6',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
    marginLeft: 8,
    marginTop: 2,
  },
  mutedText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  infoBlock: {
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 20,
  },
  reasonLabel: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },
  messageBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f2f6f2',
  },
  messageLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2E7D32',
    marginBottom: 4,
  },
  messageItem: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dfe8df',
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
  assignmentBlock: {
    marginTop: 14,
  },
  takeAction: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryActionFull: {
    marginTop: 14,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionFull: {
    marginTop: 14,
    backgroundColor: '#f4f6f4',
    borderWidth: 1,
    borderColor: '#d8e3d8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionFullText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 16,
  },
  primaryAction: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  warningAction: {
    backgroundColor: '#f9a825',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  dangerAction: {
    backgroundColor: '#c62828',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  actionGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 16,
  },
  lockedText: {
    fontSize: 13,
    color: '#c62828',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    color: '#111',
  },
  modalInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#222',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#bbb',
    borderRadius: 12,
    paddingVertical: 14,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  modalCancelButtonText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#555',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    marginLeft: 8,
  },
  modalConfirmButtonText: {
    textAlign: 'center',
    fontWeight: '800',
    color: '#fff',
  },
});