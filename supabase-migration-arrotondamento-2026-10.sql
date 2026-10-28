-- artigianidel3d — arrotondamento dei prezzi a 0,50 € per eccesso (ottobre 2026)
--
-- Da eseguire DOPO supabase-migration-prezzi-2026-10.sql (aumento del 10%).
-- Regola: ogni prezzo sale al multiplo di 0,50 € successivo, se non lo è già.
--   Esempi: 4,40 -> 4,50 · 6,60 -> 7,00 · 27,49 -> 27,50 · 11,00 resta 11,00.
--
-- Come usarlo: Supabase > SQL Editor > New query, incolla tutto il file e premi Run
-- senza selezionare parti del testo. La tabella finale mostra l'esito per ogni prodotto.
--
-- Sicurezza contro la doppia applicazione:
--   1. l'arrotondamento è registrato in public.price_adjustments: rieseguire il file
--      non modifica nulla;
--   2. ogni prodotto cambia solo se ha ancora il prezzo atteso dopo l'aumento del 10%.

begin;

create table if not exists public.price_adjustments (
  id text primary key,
  description text not null,
  applied_at timestamptz not null default now()
);

alter table public.price_adjustments enable row level security;
revoke all on table public.price_adjustments from anon, authenticated;

drop table if exists pg_temp.price_changes;

create temporary table price_changes (
  product_id uuid primary key,
  title text not null,
  old_price numeric(10, 2) not null,
  new_price numeric(10, 2) not null
);

insert into price_changes (product_id, title, old_price, new_price) values
  ('c294bda4-9565-45aa-8507-5d57b36b5464', 'Turtle Shell Bowl', 27.49, 27.50),
  ('0ddc3e3f-0b1b-4ca7-9c4a-4ced52d207cd', 'Cilindro Luxury Rigato', 8.30, 8.50),
  ('d655f964-d666-4033-b11b-4ed861dc109c', 'Handbag Vase', 13.20, 13.50),
  ('3f7ede33-3806-4c1a-84fe-befbd095e930', 'Secchiello Monogram', 8.30, 8.50),
  ('c9945805-fb90-4d63-8d39-a9e445205ca6', 'Vaso Prismatico Matelassé', 6.10, 6.50),
  ('0c929ea2-f362-4f02-aa42-57d499989bbe', 'Cestino Plissé Perla', 7.20, 7.50),
  ('f5e3903e-5aba-4471-99f5-b758342742e4', 'Cubo Monogram Black & Gold', 13.20, 13.50),
  ('4f2a8cc4-297f-4da4-b786-a5822a7b4674', 'Profumatore Melograno', 13.20, 13.50),
  ('60500d1b-8d6c-4dc2-ab6c-430900cb7986', 'Vaso Linea', 3.30, 3.50),
  ('049337d8-be27-4dcf-901e-f39de9870612', 'Forma Pura', 3.90, 4.00),
  ('76958d57-2bfa-4dec-b76b-58c418a5e732', 'Lumen Memories', 43.99, 44.00),
  ('1d22f904-9bb7-485b-99d5-e1eafb18c52a', 'Volti Essenziali', 4.40, 4.50),
  ('a079a2f0-78ff-425c-a13d-277c7b465fc1', 'Vaso Lettera', 3.90, 4.00),
  ('06b39862-d804-4fd0-9cb5-57b774171fbc', 'The "US" Collection', 17.49, 17.50),
  ('13e1e2a3-87f2-4963-bd40-7f836f052a7d', 'Luce delle Dune', 20.99, 21.00),
  ('a4f3edc7-b612-4679-9c89-935533d24e20', 'Onda di Luce', 39.49, 39.50),
  ('35590325-d969-463b-aacb-0e50f04dc482', 'Lampada Loto', 39.49, 39.50),
  ('c8c5fedb-4826-4686-af6c-ba77157cf2f2', 'L''arco della Terra', 13.80, 14.00),
  ('dd7268d7-c69e-4a81-aa92-321962f2e4a9', 'Vaso Costa', 6.60, 7.00),
  ('bf2597f0-dfc1-4bea-9244-b23b45e56b2b', 'Vaso Cuore', 3.90, 4.00),
  ('c42a8a18-5a55-496b-bf9c-221a8d4e9567', 'Abbraccio Eterno', 16.49, 16.50);

do $$
declare
  updated_count integer;
begin
  if not exists (select 1 from public.price_adjustments where id = 'aumento-10-2026-10') then
    raise exception 'Esegui prima supabase-migration-prezzi-2026-10.sql (aumento del 10%%).';
  end if;

  insert into public.price_adjustments (id, description)
  values ('arrotondamento-050-2026-10', 'Arrotondamento dei prezzi al multiplo di 0,50 euro successivo')
  on conflict (id) do nothing;

  if not found then
    raise notice 'Arrotondamento già applicato in precedenza: nessun prezzo modificato.';
    return;
  end if;

  update public.products as product
  set price = change.new_price
  from price_changes as change
  where product.id = change.product_id
    and product.price = change.old_price;

  get diagnostics updated_count = row_count;
  raise notice 'Prezzi arrotondati: % su 21.', updated_count;
end
$$;

commit;

-- Riepilogo: "aggiornato" significa che il prodotto ha ora il prezzo arrotondato.
select
  change.title as prodotto,
  change.old_price as prezzo_precedente,
  change.new_price as prezzo_arrotondato,
  product.price as prezzo_attuale,
  case
    when product.id is null then 'prodotto eliminato'
    when product.price = change.new_price then 'aggiornato'
    else 'NON aggiornato: prezzo cambiato nel frattempo, verificare'
  end as esito
from price_changes as change
left join public.products as product on product.id = change.product_id
order by change.title;

-- -----------------------------------------------------------------------------
-- Per annullare solo l'arrotondamento (tornando ai prezzi con +10%):
-- -----------------------------------------------------------------------------
-- update public.products as product
-- set price = change.old_price
-- from (values
--   ('c294bda4-9565-45aa-8507-5d57b36b5464'::uuid, 27.49, 27.50),
--   ('0ddc3e3f-0b1b-4ca7-9c4a-4ced52d207cd'::uuid, 8.30, 8.50),
--   ('d655f964-d666-4033-b11b-4ed861dc109c'::uuid, 13.20, 13.50),
--   ('3f7ede33-3806-4c1a-84fe-befbd095e930'::uuid, 8.30, 8.50),
--   ('c9945805-fb90-4d63-8d39-a9e445205ca6'::uuid, 6.10, 6.50),
--   ('0c929ea2-f362-4f02-aa42-57d499989bbe'::uuid, 7.20, 7.50),
--   ('f5e3903e-5aba-4471-99f5-b758342742e4'::uuid, 13.20, 13.50),
--   ('4f2a8cc4-297f-4da4-b786-a5822a7b4674'::uuid, 13.20, 13.50),
--   ('60500d1b-8d6c-4dc2-ab6c-430900cb7986'::uuid, 3.30, 3.50),
--   ('049337d8-be27-4dcf-901e-f39de9870612'::uuid, 3.90, 4.00),
--   ('76958d57-2bfa-4dec-b76b-58c418a5e732'::uuid, 43.99, 44.00),
--   ('1d22f904-9bb7-485b-99d5-e1eafb18c52a'::uuid, 4.40, 4.50),
--   ('a079a2f0-78ff-425c-a13d-277c7b465fc1'::uuid, 3.90, 4.00),
--   ('06b39862-d804-4fd0-9cb5-57b774171fbc'::uuid, 17.49, 17.50),
--   ('13e1e2a3-87f2-4963-bd40-7f836f052a7d'::uuid, 20.99, 21.00),
--   ('a4f3edc7-b612-4679-9c89-935533d24e20'::uuid, 39.49, 39.50),
--   ('35590325-d969-463b-aacb-0e50f04dc482'::uuid, 39.49, 39.50),
--   ('c8c5fedb-4826-4686-af6c-ba77157cf2f2'::uuid, 13.80, 14.00),
--   ('dd7268d7-c69e-4a81-aa92-321962f2e4a9'::uuid, 6.60, 7.00),
--   ('bf2597f0-dfc1-4bea-9244-b23b45e56b2b'::uuid, 3.90, 4.00),
--   ('c42a8a18-5a55-496b-bf9c-221a8d4e9567'::uuid, 16.49, 16.50)
-- ) as change (product_id, old_price, new_price)
-- where product.id = change.product_id and product.price = change.new_price;
-- delete from public.price_adjustments where id = 'arrotondamento-050-2026-10';
