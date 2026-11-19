-- artigianidel3d — Diagnosi della notifica Telegram
-- Esegui una query alla volta nel SQL Editor di Supabase (selezionala e premi Run).
-- Nessuna di queste query mostra il token del bot.

-- 1. Le richieste sono arrivate nel database?
select created_at, customer_name, config->>'name' as nome_lettera, status
from public.letter_requests
order by created_at desc
limit 5;

-- 2. I due segreti esistono? (mostra solo i nomi, non i valori)
select name, created_at, updated_at
from vault.secrets
where name in ('telegram_bot_token', 'telegram_chat_id');

-- 3. I trigger sono collegati alla tabella?
select tgname as trigger, tgenabled as attivo
from pg_trigger
where tgrelid = 'public.letter_requests'::regclass and not tgisinternal;

-- 4. Cosa ha risposto Telegram alle ultime chiamate?
--    200 = inviato; 401 = token non valido (revocato); 400 "chat not found" = chat id sbagliato.
select created, status_code, content::text as risposta, error_msg
from net._http_response
order by created desc
limit 5;
