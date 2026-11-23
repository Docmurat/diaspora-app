-- Веха 71 «Ресурсы»: список полезных сервисов во вкладке «Знания».
-- Запуск на ВМ (один раз, повторный запуск безопасен):
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < ~/veha71-resources.sql
--
-- Что делает:
--   1) таблица public.resources (название, описание, ссылка, картинка,
--      порядок);
--   2) читать могут все вошедшие участники;
--   3) добавлять, править и удалять — только основатель и модераторы;
--   4) полка картинок «resources» (открытая на чтение, как аватары;
--      потолок 2 МБ, только JPEG) — класть и убирать файлы могут
--      только основатель и модераторы.
-- Предложения ресурсов от участников таблиц НЕ требуют: они идут
-- готовым конвейером «Обращения» (appeals + moderation_messages),
-- уведомления основателю и модераторам шлёт прежний триггер
-- trg_appeal_message.

begin;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 600),
  url text not null check (url ~* '^https?://'),
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Картинка карточки: полный адрес файла на полке «resources»
-- (как avatar_path у анкет). Пусто — карточка без картинки.
alter table public.resources add column if not exists image_url text;

create index if not exists idx_resources_order
  on public.resources (sort_order, created_at);

-- Кто вправе вести список: основатель и модераторы (не удалённые).
-- SECURITY DEFINER — чтобы проверка не зависела от правил чтения users.
create or replace function public.can_manage_resources()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('owner', 'moderator')
      and u.is_deleted = false
  );
$$;

revoke all on function public.can_manage_resources() from public;
grant execute on function public.can_manage_resources() to authenticated;

alter table public.resources enable row level security;

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated
  using (true);

drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources
  for insert to authenticated
  with check (public.can_manage_resources());

drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources
  for update to authenticated
  using (public.can_manage_resources())
  with check (public.can_manage_resources());

drop policy if exists resources_delete on public.resources;
create policy resources_delete on public.resources
  for delete to authenticated
  using (public.can_manage_resources());

grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;

-- Полка картинок. Открытая: картинка показывается по прямому адресу.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists resources_img_select on storage.objects;
create policy resources_img_select on storage.objects
  for select to authenticated
  using (bucket_id = 'resources');

drop policy if exists resources_img_insert on storage.objects;
create policy resources_img_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and public.can_manage_resources());

drop policy if exists resources_img_update on storage.objects;
create policy resources_img_update on storage.objects
  for update to authenticated
  using (bucket_id = 'resources' and public.can_manage_resources())
  with check (bucket_id = 'resources' and public.can_manage_resources());

drop policy if exists resources_img_delete on storage.objects;
create policy resources_img_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and public.can_manage_resources());

commit;

-- Проверка: должно показать 4 и 4 (правила таблицы и правила полки).
select
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'resources') as pravil_tablicy,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'resources_img_%') as pravil_polki;
