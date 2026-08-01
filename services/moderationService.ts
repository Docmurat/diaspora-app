import { supabase } from "../lib/supabase";
import { createNotification } from "./notificationService";
import { getMyProfile } from "./profileService";

async function checkAccess() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error("Профиль не найден");
  }

  if (me.role !== "owner" && me.role !== "moderator") {
    throw new Error("Нет доступа");
  }

  return me;
}

async function checkOwnerAccess() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error("Профиль не найден");
  }

  if (me.role !== "owner") {
    throw new Error("Только владелец может выполнять это действие");
  }

  return me;
}

export async function getPendingUsers() {
  await checkAccess();

  const { data, error } = await supabase
    .from("users")
    .select(
      `
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
    `,
    )
    .in("moderation_status", ["pending", "needs_revision"])
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function approveUser(userId: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";
  const completedAt = new Date().toISOString();

  const { data: updatedRow, error } = await supabase
    .from("users")
    .update({
      moderation_status: "approved",
      moderation_completed_by_name: moderatorName,
      moderation_completed_by: me.id,
      moderation_completed_at: completedAt,
      moderation_note: "Заявка одобрена.",
      moderation_assigned_to: null,
      moderation_assigned_name: null,
      moderation_taken_at: null,
      updated_at: completedAt,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updatedRow) {
    throw new Error(
      "Не удалось одобрить анкету: база не приняла изменение (нет прав или запись не найдена)",
    );
  }

  const { error: messageError } = await supabase
    .from("moderation_messages")
    .insert({
      request_type: "invite_request",
      request_id: userId,
      author_user_id: me.id,
      author_role: "moderator",
      message: "Ваша заявка одобрена. Добро пожаловать!",
      read_by_user: false,
      read_by_moderator: true,
    });

  if (messageError) throw new Error(messageError.message);

  await createNotification({
    userId,
    type: "moderation",
    title: "Заявка одобрена",
    body: "Добро пожаловать в «Минги-Тау». Теперь вам доступно всё сообщество.",
    link: "/(tabs)",
  });
}

export async function rejectUser(
  userId: string,
  comment?: string,
  mode: "reject" | "revision" = "reject",
) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const status = mode === "revision" ? "needs_revision" : "rejected";
  const message =
    comment ||
    (mode === "revision"
      ? "Пожалуйста, исправьте данные и отправьте анкету повторно."
      : "Заявка отклонена.");

  const now = new Date().toISOString();

  const { data: rejectedRow, error } = await supabase
    .from("users")
    .update({
      moderation_status: status,
      moderation_completed_by_name: mode === "reject" ? moderatorName : null,
      moderation_completed_by: mode === "reject" ? me.id : null,
      moderation_completed_at: mode === "reject" ? now : null,
      moderation_note: message,
      moderation_assigned_to: mode === "revision" ? me.id : null,
      moderation_assigned_name: mode === "revision" ? moderatorName : null,
      moderation_taken_at: mode === "revision" ? now : null,
      updated_at: now,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!rejectedRow) {
    throw new Error(
      "Не удалось сохранить решение: база не приняла изменение (нет прав или запись не найдена)",
    );
  }

  const { error: messageError } = await supabase
    .from("moderation_messages")
    .insert({
      request_type: "invite_request",
      request_id: userId, // ВАЖНОЕ 1
      author_user_id: me.id,
      author_role: "moderator",
      message,
      read_by_user: false,
      read_by_moderator: true,
    });

  if (messageError) throw new Error(messageError.message);

  await createNotification({
    userId,
    type: "moderation",
    title:
      mode === "revision" ? "Анкету нужно исправить" : "Заявка отклонена",
    body: message,
    link: "/pending-approval",
  });
}

export async function getPendingNameChangeRequests() {
  await checkAccess();

  const { data, error } = await supabase
    .from("name_change_requests")
    .select(
      `
      *,
      assigned_moderator:assigned_to (
        id,
        first_name,
        last_name,
        email
      )
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function approveNameChangeRequest(request: {
  id: string;
  user_id: string;
  requested_first_name: string;
  requested_last_name: string;
}) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const { error: updateUserError } = await supabase
    .from("users")
    .update({
      first_name: request.requested_first_name,
      last_name: request.requested_last_name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.user_id);

  if (updateUserError) throw new Error(updateUserError.message);

  const { error: updateRequestError } = await supabase
    .from("name_change_requests")
    .update({
      status: "approved",
      review_note: "Запрос на изменение ФИО одобрен.",
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      completed_by_name: moderatorName,
      assigned_to: null,
      assigned_name: null,
      taken_at: null,
    })
    .eq("id", request.id);

  if (updateRequestError) throw new Error(updateRequestError.message);

  await supabase.from("moderation_messages").insert({
    request_type: "name_change_request",
    request_id: request.id,
    author_user_id: me.id,
    author_role: "moderator",
    message: "Ваш запрос на изменение ФИО одобрен.",
    read_by_user: false,
    read_by_moderator: true,
  });
}

export async function rejectNameChangeRequest(
  requestId: string,
  comment?: string,
) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const reviewNote =
    comment ||
    "Запрос на изменение ФИО отклонён. Уточните данные и попробуйте снова.";

  const { error } = await supabase
    .from("name_change_requests")
    .update({
      status: "rejected",
      review_note: reviewNote,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      completed_by_name: moderatorName,
      assigned_to: null,
      assigned_name: null,
      taken_at: null,
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  await supabase.from("moderation_messages").insert({
    request_type: "name_change_request",
    request_id: requestId,
    author_user_id: me.id,
    author_role: "moderator",
    message: reviewNote,
    read_by_user: false,
    read_by_moderator: true,
  });
}

export async function assignModerator(userId: string) {
  await checkOwnerAccess();

  const { error } = await supabase
    .from("users")
    .update({
      role: "moderator",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function removeModerator(userId: string) {
  await checkOwnerAccess();

  const { error } = await supabase
    .from("users")
    .update({
      role: "user",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function blockUser(userId: string) {
  await checkAccess();

  const { error } = await supabase
    .from("users")
    .update({
      is_blocked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function getBlockedUsers() {
  await checkAccess();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_blocked", true)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function unblockUser(userId: string) {
  await checkAccess();

  const { error } = await supabase
    .from("users")
    .update({
      is_blocked: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function getPendingComplaints() {
  await checkAccess();

  const { data, error } = await supabase
    .from("complaints")
    .select(
      `
      *,
      reporter:reporter_user_id (
        id,
        first_name,
        last_name,
        email,
        avatar_path
      ),
      target:target_user_id (
        id,
        first_name,
        last_name,
        email,
        avatar_path
      ),
      assigned_moderator:assigned_to (
        id,
        first_name,
        last_name,
        email
      )
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function resolveComplaint(complaintId: string, comment?: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const { error } = await supabase
    .from("complaints")
    .update({
      status: "resolved",
      review_note: comment?.trim() || null,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      completed_by_name: moderatorName,
      assigned_to: null,
      assigned_name: null,
      taken_at: null,
    })
    .eq("id", complaintId);

  if (error) throw new Error(error.message);
}

export async function rejectComplaint(complaintId: string, comment?: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const { error } = await supabase
    .from("complaints")
    .update({
      status: "rejected",
      // Пояснение модератора: раньше текст из окна терялся,
      // теперь он сохраняется и попадает в уведомление заявителю.
      review_note: comment?.trim() || null,
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      completed_by_name: moderatorName,
      assigned_to: null,
      assigned_name: null,
      taken_at: null,
    })
    .eq("id", complaintId);

  if (error) throw new Error(error.message);
}

export async function softDeleteUser(userId: string) {
  const me = await checkOwnerAccess();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("users")
    .update({
      is_deleted: true,
      is_blocked: false,
      // Кто и когда удалил — иначе разобраться потом невозможно
      deleted_by: me.id,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error(
      "Не удалось удалить профиль: база не приняла изменение (нет прав или запись не найдена)",
    );
  }
}

export async function takeUserModeration(userId: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  const now = new Date().toISOString();

  if (me.role === "owner") {
    const { error } = await supabase
      .from("users")
      .update({
        moderation_assigned_to: me.id,
        moderation_assigned_name: moderatorName,
        moderation_taken_at: now,
        moderation_completed_at: null,
        moderation_completed_by_name: null,
      moderation_completed_by: null,
        moderation_completed_by: null,
        updated_at: now,
      })
      .eq("id", userId);

    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      moderation_assigned_to: me.id,
      moderation_assigned_name: moderatorName,
      moderation_taken_at: now,
      moderation_completed_at: null,
      moderation_completed_by_name: null,
      moderation_completed_by: null,
      updated_at: now,
    })
    .eq("id", userId)
    .is("moderation_assigned_to", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error("Заявка уже взята другим модератором");
  }
}

export async function takeNameChangeRequest(requestId: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  if (me.role === "owner") {
    const { error } = await supabase
      .from("name_change_requests")
      .update({
        assigned_to: me.id,
        assigned_name: moderatorName,
        taken_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await supabase
    .from("name_change_requests")
    .update({
      assigned_to: me.id,
      assigned_name: moderatorName,
      taken_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error("Заявка уже взята другим модератором");
  }
}

export async function takeComplaint(complaintId: string) {
  const me = await checkAccess();
  const moderatorName =
    `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
    "Неизвестный модератор";

  if (me.role === "owner") {
    const { error } = await supabase
      .from("complaints")
      .update({
        assigned_to: me.id,
        assigned_name: moderatorName,
        taken_at: new Date().toISOString(),
      })
      .eq("id", complaintId);

    if (error) throw new Error(error.message);
    return;
  }

  const { data, error } = await supabase
    .from("complaints")
    .update({
      assigned_to: me.id,
      assigned_name: moderatorName,
      taken_at: new Date().toISOString(),
    })
    .eq("id", complaintId)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    throw new Error("Жалоба уже взята другим модератором");
  }
}

/**
 * Сколько задач ждёт этого модератора: все свободные заявки из очереди
 * «Новое» плюс его собственные — в работе и на доработке.
 * Завершённые не считаются. Используется для счётчика в профиле.
 */
export async function getModerationTaskCount(): Promise<number> {
  const me = await getMyProfile();

  if (!me || (me.role !== "owner" && me.role !== "moderator")) return 0;

  const countOf = async (
    table: string,
    build: (query: any) => any,
  ): Promise<number> => {
    try {
      const { count, error } = await build(
        supabase.from(table).select("id", { count: "exact", head: true }),
      );

      if (error) return 0;
      return count || 0;
    } catch (e) {
      return 0;
    }
  };

  const results = await Promise.all([
    // Новое: никем не взятые
    countOf("users", (q: any) =>
      q
        .eq("moderation_status", "pending")
        .eq("is_deleted", false)
        .is("moderation_assigned_to", null),
    ),
    countOf("invite_requests", (q: any) =>
      q.eq("status", "new").is("assigned_to", null),
    ),
    countOf("name_change_requests", (q: any) =>
      q.eq("status", "pending").is("assigned_to", null),
    ),
    countOf("complaints", (q: any) =>
      q.eq("status", "pending").is("assigned_to", null),
    ),

    // Мои: в работе
    countOf("users", (q: any) =>
      q
        .eq("moderation_status", "pending")
        .eq("is_deleted", false)
        .eq("moderation_assigned_to", me.id),
    ),
    countOf("invite_requests", (q: any) =>
      q.eq("status", "new").eq("assigned_to", me.id),
    ),
    countOf("name_change_requests", (q: any) =>
      q.eq("status", "pending").eq("assigned_to", me.id),
    ),
    countOf("complaints", (q: any) =>
      q.eq("status", "pending").eq("assigned_to", me.id),
    ),

    // Мои: на доработке
    countOf("users", (q: any) =>
      q
        .eq("moderation_status", "needs_revision")
        .eq("is_deleted", false)
        .eq("moderation_assigned_to", me.id),
    ),
  ]);

  return results.reduce((sum, value) => sum + value, 0);
}
