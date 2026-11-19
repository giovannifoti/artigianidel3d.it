-- artigianidel3d — Richieste della lettera con nome (novembre 2026)
-- Eseguire nel SQL Editor di Supabase dopo supabase-schema.sql. Si può rieseguire.
--
-- I visitatori possono solo INVIARE una richiesta: non possono leggerle, modificarle
-- o cancellarle. Lettura, cambio di stato e cancellazione sono riservati agli admin.
-- Ogni nuova richiesta invia una notifica Telegram, se i due segreti sono in Vault
-- (vedi CONFIGURAZIONE.md, sezione "Notifiche Telegram").

begin;

create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- 1. Controllo della configurazione scelta nel configuratore
--    Le opzioni devono coincidere con js/lettera-core.js.
-- -----------------------------------------------------------------------------

create or replace function public.is_valid_letter_config(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
    and c->>'version' in ('essenziale', 'decorata')
    and char_length(coalesce(c->>'name', '')) between 1 and 14
    and c->>'letterFont' in ('classica', 'morbida', 'decisa')
    and c->>'nameFont' in ('tondo', 'elegante', 'delicato')
    and coalesce(c->>'letterColor', '') ~ '^[a-z]{2,20}$'
    and coalesce(c->>'accentColor', '') ~ '^[a-z]{2,20}$'
    and c->>'theme' in ('cielo', 'notte', 'fiori')
    and c->>'character' in ('orsetto', 'elefantino', 'coniglietto', 'nessuno');
$$;

-- -----------------------------------------------------------------------------
-- 2. Tabella
-- -----------------------------------------------------------------------------

create table if not exists public.letter_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'nuova'
    check (status in ('nuova', 'contattata', 'in_lavorazione', 'completata', 'annullata')),
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  phone text not null check (phone ~ '^\+?[0-9 ()./-]{6,24}$'),
  email text not null check (char_length(email) <= 120 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes text not null default '' check (char_length(notes) <= 500),
  config jsonb not null check (public.is_valid_letter_config(config)),
  model_params jsonb not null
    check (jsonb_typeof(model_params) = 'object' and octet_length(model_params::text) <= 6000),
  price numeric(10, 2) not null default 0,
  privacy_consent boolean not null check (privacy_consent),
  admin_notes text not null default '' check (char_length(admin_notes) <= 1000)
);

comment on table public.letter_requests is
  'Richieste inviate dal configuratore /lettera-personalizzata. Contengono dati personali: solo gli admin le leggono.';

create index if not exists letter_requests_created_at_idx
  on public.letter_requests (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Prima dell'inserimento: prezzo deciso dal server e limite anti-spam
--    I prezzi devono coincidere con VERSIONS in js/lettera-core.js.
-- -----------------------------------------------------------------------------

create or replace function public.prepare_letter_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.letter_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Troppe richieste in poco tempo, riprova più tardi.' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.letter_requests
    where phone = new.phone and created_at > now() - interval '15 minutes'
  ) >= 2 then
    raise exception 'Hai già inviato una richiesta, ti contatteremo a breve.' using errcode = 'P0001';
  end if;

  new.status := 'nuova';
  new.admin_notes := '';
  new.created_at := now();
  new.updated_at := now();
  new.price := case new.config->>'version' when 'essenziale' then 25 when 'decorata' then 35 end;
  return new;
end;
$$;

drop trigger if exists letter_requests_prepare on public.letter_requests;
create trigger letter_requests_prepare
before insert on public.letter_requests
for each row execute function public.prepare_letter_request();

drop trigger if exists letter_requests_set_updated_at on public.letter_requests;
create trigger letter_requests_set_updated_at
before update on public.letter_requests
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Notifica Telegram
--    Nel messaggio non ci sono telefono ed email: si leggono nel pannello admin.
--    Ogni minuto un controllo (pg_cron) rimanda le notifiche non arrivate
--    (timeout, errori di rete), fino a 5 tentativi per richiesta.
--    Un errore della notifica non blocca mai il salvataggio della richiesta.
-- -----------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

alter table public.letter_requests
  add column if not exists notify_request_id bigint,
  add column if not exists notify_attempts integer not null default 0,
  add column if not exists notify_last_attempt timestamptz,
  add column if not exists notified_at timestamptz;

-- Invia il messaggio e restituisce l'id della chiamata pg_net (null se mancano i segreti).
create or replace function public.send_letter_notification(request public.letter_requests)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot_token text;
  chat_id text;
  message text;
begin
  select decrypted_secret into bot_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into chat_id from vault.decrypted_secrets where name = 'telegram_chat_id';

  if bot_token is null or chat_id is null then
    return null;
  end if;

  message := format(
    E'🧸 Nuova richiesta: lettera con nome\n%s · versione %s · %s €\nDa: %s\n\nContatti e file 3D nel pannello:\nhttps://artigianidel3d.it/admin.html',
    request.config->>'name',
    request.config->>'version',
    to_char(request.price, 'FM999990'),
    split_part(request.customer_name, ' ', 1)
  );

  return net.http_post(
    url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    body := jsonb_build_object('chat_id', chat_id, 'text', message, 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function public.notify_letter_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  call_id bigint;
begin
  call_id := public.send_letter_notification(new);
  update public.letter_requests
  set notify_request_id = call_id,
      notify_attempts = case when call_id is null then 0 else 1 end,
      notify_last_attempt = now()
  where id = new.id;
  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists letter_requests_notify on public.letter_requests;
create trigger letter_requests_notify
after insert on public.letter_requests
for each row execute function public.notify_letter_request();

-- Controlla l'esito delle ultime notifiche e rimanda quelle fallite.
create or replace function public.retry_letter_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.letter_requests;
  response_status integer;
  response_error text;
  call_id bigint;
begin
  for request in
    select * from public.letter_requests
    where notified_at is null
      and notify_attempts < 5
      and created_at > now() - interval '2 days'
  loop
    response_status := null;
    response_error := null;
    if request.notify_request_id is not null then
      select status_code, error_msg into response_status, response_error
      from net._http_response where id = request.notify_request_id;
    end if;

    if response_status = 200 then
      update public.letter_requests set notified_at = now() where id = request.id;
    elsif request.notify_request_id is null
      or response_status is not null
      or response_error is not null
      or request.notify_last_attempt < now() - interval '3 minutes' then
      call_id := public.send_letter_notification(request);
      if call_id is not null then
        update public.letter_requests
        set notify_request_id = call_id,
            notify_attempts = notify_attempts + 1,
            notify_last_attempt = now()
        where id = request.id;
      end if;
    end if;
  end loop;
end;
$$;

select cron.schedule('notifiche-richieste-lettere', '* * * * *', 'select public.retry_letter_notifications()');

revoke all on function public.prepare_letter_request() from public, anon, authenticated;
revoke all on function public.notify_letter_request() from public, anon, authenticated;
revoke all on function public.send_letter_notification(public.letter_requests) from public, anon, authenticated;
revoke all on function public.retry_letter_notifications() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Permessi e Row Level Security
-- -----------------------------------------------------------------------------

alter table public.letter_requests enable row level security;

revoke all on table public.letter_requests from anon, authenticated;
grant insert (customer_name, phone, email, notes, config, model_params, privacy_consent)
  on table public.letter_requests to anon, authenticated;
grant select, delete on table public.letter_requests to authenticated;
grant update (status, admin_notes) on table public.letter_requests to authenticated;

drop policy if exists "letter_requests_public_insert" on public.letter_requests;
create policy "letter_requests_public_insert"
on public.letter_requests
for insert
to anon, authenticated
with check (privacy_consent);

drop policy if exists "letter_requests_admin_select" on public.letter_requests;
create policy "letter_requests_admin_select"
on public.letter_requests
for select
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

drop policy if exists "letter_requests_admin_update" on public.letter_requests;
create policy "letter_requests_admin_update"
on public.letter_requests
for update
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

drop policy if exists "letter_requests_admin_delete" on public.letter_requests;
create policy "letter_requests_admin_delete"
on public.letter_requests
for delete
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

commit;

-- -----------------------------------------------------------------------------
-- 6. Segreti Telegram (una sola volta, sostituendo i valori tra apici):
-- -----------------------------------------------------------------------------
-- select vault.create_secret('IL-TOKEN-DEL-BOT', 'telegram_bot_token');
-- select vault.create_secret('IL-TUO-CHAT-ID', 'telegram_chat_id');
--
-- Prova della notifica senza creare richieste finte:
-- select net.http_post(
--   url := 'https://api.telegram.org/bot' || (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token') || '/sendMessage',
--   body := jsonb_build_object('chat_id', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_chat_id'), 'text', 'Prova notifiche artigianidel3d ✅'),
--   headers := '{"Content-Type": "application/json"}'::jsonb
-- );
