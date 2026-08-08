import { supabase } from "../lib/supabase";
import { getMyProfile } from "./profileService";

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 8; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

export async function createInvite() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error("Профиль не найден");
  }

  const code = generateInviteCode();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      code,
      created_by_user_id: me.id,
      is_used: false,
      is_disabled: false,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getMyInvites() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error("Профиль не найден");
  }

  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("created_by_user_id", me.id)
    .eq("is_disabled", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getInviteByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase();

  const { data, error } = await supabase.rpc("validate_invite_code", {
    input_code: normalizedCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const invite = Array.isArray(data) ? data[0] : null;

  if (!invite) {
    throw new Error("Инвайт не найден");
  }

  return invite;
}

export async function validateInviteCode(code: string) {
  const invite = await getInviteByCode(code);

  if (!invite) {
    throw new Error("Инвайт не найден");
  }

  if (invite.is_disabled) {
    throw new Error("Инвайт недействителен");
  }

  if (invite.is_used) {
    throw new Error("Инвайт уже использован");
  }

  return invite;
}

export async function markInviteAsSent(inviteId: string) {
  const { error } = await supabase
    .from("invites")
    .update({
      sent_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("is_disabled", false)
    .eq("is_used", false);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markInviteAsUsedById(input: {
  inviteId: string;
  usedByUserId: string;
}) {
  const { data, error } = await supabase.rpc("mark_invite_as_used_by_id", {
    input_invite_id: input.inviteId,
    input_used_by_user_id: input.usedByUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const invite = Array.isArray(data) ? data[0] : null;

  if (!invite) {
    throw new Error("Инвайт не найден");
  }

  return invite;
}

export async function disableInvite(inviteId: string) {
  const { error } = await supabase
    .from("invites")
    .update({
      is_disabled: true,
    })
    .eq("id", inviteId)
    .eq("is_used", false);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getMyInvitedUsers() {
  const me = await getMyProfile();

  if (!me) {
    throw new Error("Профиль не найден");
  }

  const { data: invites, error: invitesError } = await supabase
    .from("invites")
    .select("id, used_by_user_id, used_at, is_used")
    .eq("created_by_user_id", me.id)
    .eq("is_used", true)
    .not("used_by_user_id", "is", null)
    .order("used_at", { ascending: false });

  if (invitesError) {
    throw new Error(invitesError.message);
  }

  const usedUserIds = (invites || [])
    .map((invite) => invite.used_by_user_id)
    .filter(Boolean);

  if (usedUserIds.length === 0) {
    return [];
  }

  // В списке «Пришли» показываем только тех, чью анкету модератор
  // уже одобрил: пока человек в очереди, он ещё не участник.
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .in("id", usedUserIds)
    .eq("moderation_status", "approved");

  if (usersError) {
    throw new Error(usersError.message);
  }

  const usersMap = new Map((users || []).map((user) => [user.id, user]));

  return (invites || [])
    .filter((invite) => usersMap.has(invite.used_by_user_id))
    .map((invite) => {
      const user = usersMap.get(invite.used_by_user_id);

      const firstName = user?.first_name?.trim() || "";
      const lastName = user?.last_name?.trim() || "";
      const name = [firstName, lastName].filter(Boolean).join(" ").trim();

      return {
        invite_id: invite.id,
        user_id: invite.used_by_user_id,
        name: name || "Без имени",
        used_at: invite.used_at || null,
      };
    });
}
