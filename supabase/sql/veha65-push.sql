-- Веха 65 «Пуш-уведомления»: подписки, служебная конфигурация, триггер.
-- Запуск на ВМ (один раз, повторный запуск безопасен):
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < ~/veha65-push.sql

begin;

-- Расширение pg_net: база умеет сама стучаться по HTTP (к почтальону пушей).
create extension if not exists pg_net;

-- Подписки на пуши. У одного участника их может быть несколько
-- (телефон + компьютер). lang — язык устройства: на нём переводится пуш.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lang text not null default 'ru',
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Свои подписки правит только хозяин.
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subs_update_own on public.push_subscriptions;
create policy push_subs_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Служебная конфигурация для триггера (адрес почтальона, ключи).
-- RLS включён, правил нет: участникам таблица недоступна вовсе.
create table if not exists public.push_config (
  key text primary key,
  value text not null
);

alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- Триггер: родилось НЕтихое уведомление — зовём почтальона пушей.
-- Любая ошибка здесь глотается: пуш никогда не роняет само уведомление.
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_anon text;
  v_secret text;
begin
  -- Тихие уведомления («Выходной» модератора) в пуш не идут.
  if new.is_read then
    return new;
  end if;

  select value into v_url from public.push_config where key = 'url';
  select value into v_anon from public.push_config where key = 'anon_key';
  select value into v_secret from public.push_config where key = 'secret';

  if v_url is null or v_anon is null or v_secret is null then
    return new; -- почтальон ещё не настроен — просто живём дальше
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon,
      'x-push-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push
  after insert on public.notifications
  for each row
  execute function public.notify_push();

commit;
