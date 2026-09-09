import { supabase } from "../lib/supabase";

export type DirectoryUser = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  country: string | null;
  city: string | null;
  category: string | null;
  profession: string | null;
  bio: string | null;
  telegram: string | null;
  extra_info: string | null;
  avatar_path: string | null;
  moderation_status: "pending" | "approved" | "rejected";
  role: "owner" | "moderator" | "user";
  is_blocked?: boolean;
  is_deleted?: boolean;
  created_at?: string;
};

export async function getApprovedUsers(): Promise<DirectoryUser[]> {
  // Демо-гость (Веха 66): чужие анкеты база ему не отдаёт — список
  // приходит из функции demo_people, очищенный от любых контактов.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    const { data: meRow } = await supabase
      .from("users")
      .select("is_demo")
      .eq("id", authUser.id)
      .maybeSingle();

    if (meRow?.is_demo) {
      const { data: demoRows, error: demoError } =
        await supabase.rpc("demo_people");

      if (demoError) {
        throw new Error(demoError.message);
      }

      return (demoRows || []).map((row: any) => ({
        ...row,
        email: null,
        telegram: null,
        moderation_status: "approved",
        role: "user",
        is_blocked: false,
        is_deleted: false,
      })) as DirectoryUser[];
    }
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("moderation_status", "approved")
    .eq("is_blocked", false)
    .eq("is_deleted", false)
    // Призрак-демо в общий список не попадает ни у кого,
    // включая основателя (управление им — через кабинет/модерацию).
    .eq("is_demo", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as DirectoryUser[];
}
