-- artigianidel3d — aumento dei prezzi di vendita del 10% (ottobre 2026)
--
-- Come usarlo: Supabase > SQL Editor > New query, incolla tutto il file e premi Run.
-- La tabella finale mostra, per ogni prodotto, prezzo precedente, nuovo prezzo ed esito.
--
-- Sicurezza contro la doppia applicazione:
--   1. l'aumento è registrato in public.price_adjustments con un identificativo univoco:
--      se il file viene eseguito una seconda volta, nessun prezzo viene toccato;
--   2. ogni prodotto viene aggiornato solo se ha ancora il prezzo di partenza previsto:
--      i prezzi modificati a mano nel frattempo non vengono mai aumentati di nuovo.
--
-- Arrotondamento: prezzo x 1,10 arrotondato ai 10 centesimi; i prezzi che finiscono
-- in ,99 restano "psicologici" (x,49 o x,99, il più vicino all'aumento del 10%).
-- I nuovi prodotti inseriti dopo il 26/10/2026 non sono inclusi.

begin;

create table if not exists public.price_adjustments (
  id text primary key,
  description text not null,
  applied_at timestamptz not null default now()
);

comment on table public.price_adjustments is
  'Registro degli adeguamenti di prezzo applicati al catalogo, per evitare doppie applicazioni.';

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
  ('c294bda4-9565-45aa-8507-5d57b36b5464', 'Turtle Shell Bowl', 24.99, 27.49),
  ('0ddc3e3f-0b1b-4ca7-9c4a-4ced52d207cd', 'Cilindro Luxury Rigato', 7.50, 8.30),
  ('d655f964-d666-4033-b11b-4ed861dc109c', 'Handbag Vase', 12.00, 13.20),
  ('e3eae3ce-f0ad-4a2d-bb80-46439eb407a0', 'Bucket "Iconic Monogram"', 10.00, 11.00),
  ('3f7ede33-3806-4c1a-84fe-befbd095e930', 'Secchiello Monogram', 7.50, 8.30),
  ('c9945805-fb90-4d63-8d39-a9e445205ca6', 'Vaso Prismatico Matelassé', 5.50, 6.10),
  ('0c929ea2-f362-4f02-aa42-57d499989bbe', 'Cestino Plissé Perla', 6.50, 7.20),
  ('f5e3903e-5aba-4471-99f5-b758342742e4', 'Cubo Monogram Black & Gold', 12.00, 13.20),
  ('8889a311-9093-4757-8738-5553ba5844d2', 'Vaso Décolleté Elegance', 10.00, 11.00),
  ('4f2a8cc4-297f-4da4-b786-a5822a7b4674', 'Profumatore Melograno', 12.00, 13.20),
  ('60500d1b-8d6c-4dc2-ab6c-430900cb7986', 'Vaso Linea', 3.00, 3.30),
  ('049337d8-be27-4dcf-901e-f39de9870612', 'Forma Pura', 3.50, 3.90),
  ('76958d57-2bfa-4dec-b76b-58c418a5e732', 'Lumen Memories', 39.99, 43.99),
  ('1d22f904-9bb7-485b-99d5-e1eafb18c52a', 'Volti Essenziali', 4.00, 4.40),
  ('a079a2f0-78ff-425c-a13d-277c7b465fc1', 'Vaso Lettera', 3.50, 3.90),
  ('06b39862-d804-4fd0-9cb5-57b774171fbc', 'The "US" Collection', 15.99, 17.49),
  ('13e1e2a3-87f2-4963-bd40-7f836f052a7d', 'Luce delle Dune', 18.99, 20.99),
  ('a4f3edc7-b612-4679-9c89-935533d24e20', 'Onda di Luce', 35.99, 39.49),
  ('35590325-d969-463b-aacb-0e50f04dc482', 'Lampada Loto', 35.99, 39.49),
  ('c8c5fedb-4826-4686-af6c-ba77157cf2f2', 'L''arco della Terra', 12.50, 13.80),
  ('8d562893-4440-41ab-8616-eb6aed1f0104', 'Vaso Abisso', 5.00, 5.50),
  ('dd7268d7-c69e-4a81-aa92-321962f2e4a9', 'Vaso Costa', 6.00, 6.60),
  ('bf2597f0-dfc1-4bea-9244-b23b45e56b2b', 'Vaso Cuore', 3.50, 3.90),
  ('c42a8a18-5a55-496b-bf9c-221a8d4e9567', 'Abbraccio Eterno', 14.99, 16.49);

do $$
declare
  updated_count integer;
begin
  insert into public.price_adjustments (id, description)
  values ('aumento-10-2026-10', 'Aumento del 10% dei prezzi di vendita per costi di materie prime e produzione')
  on conflict (id) do nothing;

  if not found then
    raise notice 'Aumento già applicato in precedenza: nessun prezzo modificato.';
    return;
  end if;

  update public.products as product
  set price = change.new_price
  from price_changes as change
  where product.id = change.product_id
    and product.price = change.old_price;

  get diagnostics updated_count = row_count;
  raise notice 'Prezzi aggiornati: % su 24.', updated_count;
end
$$;

commit;

-- Riepilogo: "aggiornato" significa che il prodotto ha ora il nuovo prezzo.
select
  change.title as prodotto,
  change.old_price as prezzo_precedente,
  change.new_price as prezzo_nuovo,
  product.price as prezzo_attuale,
  round((change.new_price / change.old_price - 1) * 100, 1) as aumento_percentuale,
  case
    when product.id is null then 'prodotto eliminato'
    when product.price = change.new_price then 'aggiornato'
    else 'NON aggiornato: prezzo cambiato nel frattempo, verificare'
  end as esito
from price_changes as change
left join public.products as product on product.id = change.product_id
order by change.title;

-- -----------------------------------------------------------------------------
-- Per annullare l'aumento (solo se necessario), esegui in una nuova query:
-- -----------------------------------------------------------------------------
-- update public.products as product
-- set price = change.old_price
-- from (values
--   ('c294bda4-9565-45aa-8507-5d57b36b5464'::uuid, 24.99, 27.49),
--   ('0ddc3e3f-0b1b-4ca7-9c4a-4ced52d207cd'::uuid, 7.50, 8.30),
--   ('d655f964-d666-4033-b11b-4ed861dc109c'::uuid, 12.00, 13.20),
--   ('e3eae3ce-f0ad-4a2d-bb80-46439eb407a0'::uuid, 10.00, 11.00),
--   ('3f7ede33-3806-4c1a-84fe-befbd095e930'::uuid, 7.50, 8.30),
--   ('c9945805-fb90-4d63-8d39-a9e445205ca6'::uuid, 5.50, 6.10),
--   ('0c929ea2-f362-4f02-aa42-57d499989bbe'::uuid, 6.50, 7.20),
--   ('f5e3903e-5aba-4471-99f5-b758342742e4'::uuid, 12.00, 13.20),
--   ('8889a311-9093-4757-8738-5553ba5844d2'::uuid, 10.00, 11.00),
--   ('4f2a8cc4-297f-4da4-b786-a5822a7b4674'::uuid, 12.00, 13.20),
--   ('60500d1b-8d6c-4dc2-ab6c-430900cb7986'::uuid, 3.00, 3.30),
--   ('049337d8-be27-4dcf-901e-f39de9870612'::uuid, 3.50, 3.90),
--   ('76958d57-2bfa-4dec-b76b-58c418a5e732'::uuid, 39.99, 43.99),
--   ('1d22f904-9bb7-485b-99d5-e1eafb18c52a'::uuid, 4.00, 4.40),
--   ('a079a2f0-78ff-425c-a13d-277c7b465fc1'::uuid, 3.50, 3.90),
--   ('06b39862-d804-4fd0-9cb5-57b774171fbc'::uuid, 15.99, 17.49),
--   ('13e1e2a3-87f2-4963-bd40-7f836f052a7d'::uuid, 18.99, 20.99),
--   ('a4f3edc7-b612-4679-9c89-935533d24e20'::uuid, 35.99, 39.49),
--   ('35590325-d969-463b-aacb-0e50f04dc482'::uuid, 35.99, 39.49),
--   ('c8c5fedb-4826-4686-af6c-ba77157cf2f2'::uuid, 12.50, 13.80),
--   ('8d562893-4440-41ab-8616-eb6aed1f0104'::uuid, 5.00, 5.50),
--   ('dd7268d7-c69e-4a81-aa92-321962f2e4a9'::uuid, 6.00, 6.60),
--   ('bf2597f0-dfc1-4bea-9244-b23b45e56b2b'::uuid, 3.50, 3.90),
--   ('c42a8a18-5a55-496b-bf9c-221a8d4e9567'::uuid, 14.99, 16.49)
-- ) as change (product_id, old_price, new_price)
-- where product.id = change.product_id and product.price = change.new_price;
-- delete from public.price_adjustments where id = 'aumento-10-2026-10';
