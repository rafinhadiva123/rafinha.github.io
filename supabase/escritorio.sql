-- Simulador de escritório: uma linha por cadeira ocupada.
-- Rode uma vez no Supabase → SQL Editor → New query → Run.
--
-- Regras: qualquer visitante pode ler e sentar numa cadeira livre.
-- Ninguém pela API consegue editar nem apagar; para tirar alguém,
-- apague a linha em Table Editor → escritorio_personagens.

create table if not exists public.escritorio_personagens (
  lugar     smallint primary key
            check (lugar between 0 and 39),            -- 40 cadeiras (layout.js → TOTAL)
  apelido   text not null
            check (char_length(btrim(apelido)) between 1 and 18
                   and apelido !~ '[[:cntrl:]]'),
  visual    jsonb not null
            check (jsonb_typeof(visual) = 'object'
                   and octet_length(visual::text) <= 600),
  criado_em timestamptz not null default now()
);

alter table public.escritorio_personagens enable row level security;

drop policy if exists "todos leem" on public.escritorio_personagens;
create policy "todos leem"
  on public.escritorio_personagens for select
  to anon, authenticated
  using (true);

drop policy if exists "todos sentam" on public.escritorio_personagens;
create policy "todos sentam"
  on public.escritorio_personagens for insert
  to anon, authenticated
  with check (true);

-- só leitura e inserção pela API pública
revoke all on public.escritorio_personagens from anon, authenticated;
grant select, insert on public.escritorio_personagens to anon, authenticated;
