-- Simulador de escritório · rafinha.xyz
-- Gerado por scripts/gerar-sql-escritorio.mjs a partir da planta do site.
-- Não edite à mão: mude a planta e gere de novo.
--
-- Como rodar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo quantas vezes quiser (depois de mudar o layout, por
-- exemplo): nada que já está salvo é apagado.
--
-- Regras:
-- * qualquer pessoa lê as cadeiras e os personagens;
-- * ninguém grava direto nas tabelas: só pelas funções escritorio_sentar e
--   escritorio_meu, que conferem tudo;
-- * cada navegador (login anônimo) tem um personagem só, e só ele mexe nele;
-- * apelidos não se repetem (sem diferença de acento, maiúscula ou espaço);
-- * os 15 personagens fixos já vêm sentados, com o apelido reservado;
-- * para tirar alguém: Table Editor → escritorio_personagens → apagar a linha.

create extension if not exists unaccent with schema extensions;

-- 1. Tabelas -------------------------------------------------------------

create table if not exists public.escritorio_lugares (
  id    text primary key,
  zona  text,
  area  text,
  ativo boolean not null default true,
  constraint escritorio_lugares_zona_ou_area check ((zona is null) <> (area is null))
);

create table if not exists public.escritorio_personagens (
  id            uuid primary key default gen_random_uuid(),
  fixo          boolean not null default false,
  apelido       text not null,
  apelido_chave text not null,
  lugar         text references public.escritorio_lugares (id) on update cascade,
  visual        jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint escritorio_personagens_apelido_unico unique (apelido_chave),
  constraint escritorio_personagens_lugar_unico unique (lugar),
  constraint escritorio_personagens_apelido_tamanho check (char_length(apelido) between 1 and 18),
  constraint escritorio_personagens_visual_tamanho check (jsonb_typeof(visual) = 'object' and octet_length(visual::text) <= 600)
);

-- quem é dono de cada personagem: separado e sem acesso público, para o
-- id do navegador nunca aparecer para outras pessoas
create table if not exists public.escritorio_donos (
  dono       uuid primary key,
  personagem uuid not null unique references public.escritorio_personagens (id) on delete cascade
);

-- 2. Funções de apoio -----------------------------------------------------

create or replace function public.escritorio_limpar_apelido(t text)
returns text
language sql immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(normalize(coalesce(t, ''), NFC), '\s+', ' ', 'g'),
    '[\u0001-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]', '', 'g'))
$$;

create or replace function public.escritorio_chave(t text)
returns text
language sql stable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, normalize(coalesce(t, ''), NFC))), '\s+', ' ', 'g'))
$$;

create or replace function public.escritorio_visual_valido(v jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(v) = 'object'
    and v ?& array['pele', 'cabelo', 'corCabelo', 'camisa', 'barba', 'oculos', 'tracos', 'acessorio', 'corLaco', 'altura']
    and (select count(*) from jsonb_object_keys(v)) = 10
    and v->>'pele' in ('#F6DDC7', '#F1D2B8', '#E9C4A2', '#D9AC86', '#C28D64', '#A06E48', '#7D5134', '#5A3825')
    and v->>'cabelo' in ('curto', 'topete', 'baguncado', 'medio', 'longo', 'chanel', 'coque', 'calvoFrente', 'careca')
    and v->>'corCabelo' in ('#15110F', '#3A2517', '#6B4A2E', '#A0522D', '#D2B06E', '#B9B4AC', '#E98AB0', '#4A7FC1')
    and v->>'camisa' in ('#2F6F5E', '#3E5A7A', '#C4633F', '#8E5B7A', '#B08A3E', '#33373C', '#F4F3EF', '#4E7A5E', '#D2334A', '#6D7B8C')
    and v->>'barba' in ('nenhuma', 'barbinha', 'cheia')
    and v->>'oculos' in ('nenhum', 'normal', 'redondo')
    and v->>'tracos' in ('marcados', 'suaves')
    and v->>'acessorio' in ('nenhum', 'laco', 'fone')
    and v->>'corLaco' in ('#E98AB0', '#D2334A', '#F2C14E', '#5B8DEF')
    and v->>'altura' in ('baixa', 'media', 'alta')
$$;

-- 3. Funções que o site chama ---------------------------------------------

create or replace function public.escritorio_sentar(p_lugar text, p_apelido text, p_visual jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu        uuid := auth.uid();
  ap        text := public.escritorio_limpar_apelido(p_apelido);
  ch        text;
  ativo     boolean;
  meu_id    uuid;
  restricao text;
begin
  if eu is null then
    raise exception using message = 'sem_sessao', errcode = 'P0001';
  end if;
  if char_length(ap) < 1 or char_length(ap) > 18 then
    raise exception using message = 'apelido_invalido', errcode = 'P0001';
  end if;
  if not coalesce(public.escritorio_visual_valido(p_visual), false) then
    raise exception using message = 'visual_invalido', errcode = 'P0001';
  end if;
  select l.ativo into ativo from public.escritorio_lugares l where l.id = p_lugar;
  if ativo is not true then
    raise exception using message = 'lugar_invalido', errcode = 'P0001';
  end if;
  ch := public.escritorio_chave(ap);

  select d.personagem into meu_id from public.escritorio_donos d where d.dono = eu for update;
  begin
    if meu_id is null then
      insert into public.escritorio_personagens (apelido, apelido_chave, lugar, visual)
      values (ap, ch, p_lugar, p_visual)
      returning id into meu_id;
      insert into public.escritorio_donos (dono, personagem) values (eu, meu_id);
    else
      update public.escritorio_personagens
      set apelido = ap, apelido_chave = ch, lugar = p_lugar, visual = p_visual, atualizado_em = now()
      where id = meu_id;
    end if;
  exception when unique_violation then
    get stacked diagnostics restricao = constraint_name;
    if restricao = 'escritorio_personagens_lugar_unico' then
      raise exception using message = 'lugar_ocupado', errcode = 'P0001';
    elsif restricao = 'escritorio_personagens_apelido_unico' then
      raise exception using message = 'apelido_em_uso', errcode = 'P0001';
    else
      raise;
    end if;
  end;

  return json_build_object('lugar', p_lugar, 'apelido', ap, 'visual', p_visual);
end;
$$;

create or replace function public.escritorio_meu()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('lugar', p.lugar, 'apelido', p.apelido, 'visual', p.visual)
  from public.escritorio_donos d
  join public.escritorio_personagens p on p.id = d.personagem
  where d.dono = auth.uid()
$$;

-- 4. Acesso ---------------------------------------------------------------

alter table public.escritorio_lugares enable row level security;
alter table public.escritorio_personagens enable row level security;
alter table public.escritorio_donos enable row level security;

revoke all on public.escritorio_lugares, public.escritorio_personagens, public.escritorio_donos from anon, authenticated;
grant select on public.escritorio_lugares to anon, authenticated;
grant select on public.escritorio_personagens to anon, authenticated;

drop policy if exists "todos leem" on public.escritorio_lugares;
create policy "todos leem" on public.escritorio_lugares for select to anon, authenticated using (true);
drop policy if exists "todos leem" on public.escritorio_personagens;
create policy "todos leem" on public.escritorio_personagens for select to anon, authenticated using (true);
-- escritorio_donos: sem nenhuma política, ninguém lê nem grava pela API

revoke all on function public.escritorio_limpar_apelido(text), public.escritorio_chave(text),
  public.escritorio_visual_valido(jsonb) from public, anon, authenticated;
revoke all on function public.escritorio_sentar(text, text, jsonb), public.escritorio_meu() from public, anon;
grant execute on function public.escritorio_sentar(text, text, jsonb), public.escritorio_meu() to authenticated;

-- 5. Atualização ao vivo --------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'escritorio_personagens') then
    alter publication supabase_realtime add table public.escritorio_personagens;
  end if;
end $$;

-- 6. Cadeiras (511) ------------------------------------------------

insert into public.escritorio_lugares (id, zona, area) values
  ('norte-1-O-1', 'norte', null),
  ('norte-1-O-2', 'norte', null),
  ('norte-1-O-3', 'norte', null),
  ('norte-1-O-4', 'norte', null),
  ('norte-1-L-1', 'norte', null),
  ('norte-1-L-2', 'norte', null),
  ('norte-1-L-3', 'norte', null),
  ('norte-1-L-4', 'norte', null),
  ('norte-2-O-1', 'norte', null),
  ('norte-2-O-2', 'norte', null),
  ('norte-2-O-3', 'norte', null),
  ('norte-2-O-4', 'norte', null),
  ('norte-2-L-1', 'norte', null),
  ('norte-2-L-2', 'norte', null),
  ('norte-2-L-3', 'norte', null),
  ('norte-2-L-4', 'norte', null),
  ('norte-3-O-1', 'norte', null),
  ('norte-3-O-2', 'norte', null),
  ('norte-3-O-3', 'norte', null),
  ('norte-3-O-4', 'norte', null),
  ('norte-3-L-1', 'norte', null),
  ('norte-3-L-2', 'norte', null),
  ('norte-3-L-3', 'norte', null),
  ('norte-3-L-4', 'norte', null),
  ('norte-4-O-1', 'norte', null),
  ('norte-4-O-2', 'norte', null),
  ('norte-4-O-3', 'norte', null),
  ('norte-4-O-4', 'norte', null),
  ('norte-4-L-1', 'norte', null),
  ('norte-4-L-2', 'norte', null),
  ('norte-4-L-3', 'norte', null),
  ('norte-4-L-4', 'norte', null),
  ('norte-5-O-1', 'norte', null),
  ('norte-5-O-2', 'norte', null),
  ('norte-5-O-3', 'norte', null),
  ('norte-5-O-4', 'norte', null),
  ('norte-5-L-1', 'norte', null),
  ('norte-5-L-2', 'norte', null),
  ('norte-5-L-3', 'norte', null),
  ('norte-5-L-4', 'norte', null),
  ('norte-6-O-1', 'norte', null),
  ('norte-6-O-2', 'norte', null),
  ('norte-6-O-3', 'norte', null),
  ('norte-6-O-4', 'norte', null),
  ('norte-6-L-1', 'norte', null),
  ('norte-6-L-2', 'norte', null),
  ('norte-6-L-3', 'norte', null),
  ('norte-6-L-4', 'norte', null),
  ('norte-7-O-1', 'norte', null),
  ('norte-7-O-2', 'norte', null),
  ('norte-7-O-3', 'norte', null),
  ('norte-7-O-4', 'norte', null),
  ('norte-7-L-1', 'norte', null),
  ('norte-7-L-2', 'norte', null),
  ('norte-7-L-3', 'norte', null),
  ('norte-7-L-4', 'norte', null),
  ('norte-8-O-1', 'norte', null),
  ('norte-8-O-2', 'norte', null),
  ('norte-8-O-3', 'norte', null),
  ('norte-8-O-4', 'norte', null),
  ('norte-8-L-1', 'norte', null),
  ('norte-8-L-2', 'norte', null),
  ('norte-8-L-3', 'norte', null),
  ('norte-8-L-4', 'norte', null),
  ('norte-9-O-1', 'norte', null),
  ('norte-9-O-2', 'norte', null),
  ('norte-9-O-3', 'norte', null),
  ('norte-9-O-4', 'norte', null),
  ('norte-9-L-1', 'norte', null),
  ('norte-9-L-2', 'norte', null),
  ('norte-9-L-3', 'norte', null),
  ('norte-9-L-4', 'norte', null),
  ('norte-10-O-1', 'norte', null),
  ('norte-10-O-2', 'norte', null),
  ('norte-10-O-3', 'norte', null),
  ('norte-10-O-4', 'norte', null),
  ('norte-10-L-1', 'norte', null),
  ('norte-10-L-2', 'norte', null),
  ('norte-10-L-3', 'norte', null),
  ('norte-10-L-4', 'norte', null),
  ('norte-11-O-1', 'norte', null),
  ('norte-11-O-2', 'norte', null),
  ('norte-11-O-3', 'norte', null),
  ('norte-11-O-4', 'norte', null),
  ('norte-11-L-1', 'norte', null),
  ('norte-11-L-2', 'norte', null),
  ('norte-11-L-3', 'norte', null),
  ('norte-11-L-4', 'norte', null),
  ('norte-12-O-1', 'norte', null),
  ('norte-12-O-2', 'norte', null),
  ('norte-12-O-3', 'norte', null),
  ('norte-12-O-4', 'norte', null),
  ('norte-12-L-1', 'norte', null),
  ('norte-12-L-2', 'norte', null),
  ('norte-12-L-3', 'norte', null),
  ('norte-12-L-4', 'norte', null),
  ('norte-13-O-1', 'norte', null),
  ('norte-13-O-2', 'norte', null),
  ('norte-13-O-3', 'norte', null),
  ('norte-13-O-4', 'norte', null),
  ('norte-13-L-1', 'norte', null),
  ('norte-13-L-2', 'norte', null),
  ('norte-13-L-3', 'norte', null),
  ('norte-13-L-4', 'norte', null),
  ('norte-14-O-1', 'norte', null),
  ('norte-14-O-2', 'norte', null),
  ('norte-14-O-3', 'norte', null),
  ('norte-14-O-4', 'norte', null),
  ('norte-14-L-1', 'norte', null),
  ('norte-14-L-2', 'norte', null),
  ('norte-14-L-3', 'norte', null),
  ('norte-14-L-4', 'norte', null),
  ('nordeste-1-O-1', 'nordeste', null),
  ('nordeste-1-O-2', 'nordeste', null),
  ('nordeste-1-O-3', 'nordeste', null),
  ('nordeste-1-O-4', 'nordeste', null),
  ('nordeste-1-L-1', 'nordeste', null),
  ('nordeste-1-L-2', 'nordeste', null),
  ('nordeste-1-L-3', 'nordeste', null),
  ('nordeste-1-L-4', 'nordeste', null),
  ('nordeste-2-O-1', 'nordeste', null),
  ('nordeste-2-O-2', 'nordeste', null),
  ('nordeste-2-O-3', 'nordeste', null),
  ('nordeste-2-O-4', 'nordeste', null),
  ('nordeste-2-L-1', 'nordeste', null),
  ('nordeste-2-L-2', 'nordeste', null),
  ('nordeste-2-L-3', 'nordeste', null),
  ('nordeste-2-L-4', 'nordeste', null),
  ('nordeste-3-O-1', 'nordeste', null),
  ('nordeste-3-O-2', 'nordeste', null),
  ('nordeste-3-O-3', 'nordeste', null),
  ('nordeste-3-O-4', 'nordeste', null),
  ('nordeste-3-L-1', 'nordeste', null),
  ('nordeste-3-L-2', 'nordeste', null),
  ('nordeste-3-L-3', 'nordeste', null),
  ('nordeste-3-L-4', 'nordeste', null),
  ('nordeste-4-O-1', 'nordeste', null),
  ('nordeste-4-O-2', 'nordeste', null),
  ('nordeste-4-O-3', 'nordeste', null),
  ('nordeste-4-O-4', 'nordeste', null),
  ('nordeste-4-L-1', 'nordeste', null),
  ('nordeste-4-L-2', 'nordeste', null),
  ('nordeste-4-L-3', 'nordeste', null),
  ('nordeste-4-L-4', 'nordeste', null),
  ('leste-1-N-1', 'leste', null),
  ('leste-1-N-2', 'leste', null),
  ('leste-1-N-3', 'leste', null),
  ('leste-1-N-4', 'leste', null),
  ('leste-1-N-5', 'leste', null),
  ('leste-1-S-1', 'leste', null),
  ('leste-1-S-2', 'leste', null),
  ('leste-1-S-3', 'leste', null),
  ('leste-1-S-4', 'leste', null),
  ('leste-1-S-5', 'leste', null),
  ('leste-2-N-1', 'leste', null),
  ('leste-2-N-2', 'leste', null),
  ('leste-2-N-3', 'leste', null),
  ('leste-2-N-4', 'leste', null),
  ('leste-2-N-5', 'leste', null),
  ('leste-2-S-1', 'leste', null),
  ('leste-2-S-2', 'leste', null),
  ('leste-2-S-3', 'leste', null),
  ('leste-2-S-4', 'leste', null),
  ('leste-2-S-5', 'leste', null),
  ('leste-3-N-1', 'leste', null),
  ('leste-3-N-2', 'leste', null),
  ('leste-3-N-3', 'leste', null),
  ('leste-3-N-4', 'leste', null),
  ('leste-3-N-5', 'leste', null),
  ('leste-3-S-1', 'leste', null),
  ('leste-3-S-2', 'leste', null),
  ('leste-3-S-3', 'leste', null),
  ('leste-3-S-4', 'leste', null),
  ('leste-3-S-5', 'leste', null),
  ('leste-4-N-1', 'leste', null),
  ('leste-4-N-2', 'leste', null),
  ('leste-4-N-3', 'leste', null),
  ('leste-4-N-4', 'leste', null),
  ('leste-4-N-5', 'leste', null),
  ('leste-4-S-1', 'leste', null),
  ('leste-4-S-2', 'leste', null),
  ('leste-4-S-3', 'leste', null),
  ('leste-4-S-4', 'leste', null),
  ('leste-4-S-5', 'leste', null),
  ('leste-5-N-1', 'leste', null),
  ('leste-5-N-2', 'leste', null),
  ('leste-5-N-3', 'leste', null),
  ('leste-5-N-4', 'leste', null),
  ('leste-5-N-5', 'leste', null),
  ('leste-5-S-1', 'leste', null),
  ('leste-5-S-2', 'leste', null),
  ('leste-5-S-3', 'leste', null),
  ('leste-5-S-4', 'leste', null),
  ('leste-5-S-5', 'leste', null),
  ('leste-6-N-1', 'leste', null),
  ('leste-6-N-2', 'leste', null),
  ('leste-6-N-3', 'leste', null),
  ('leste-6-N-4', 'leste', null),
  ('leste-6-N-5', 'leste', null),
  ('leste-6-S-1', 'leste', null),
  ('leste-6-S-2', 'leste', null),
  ('leste-6-S-3', 'leste', null),
  ('leste-6-S-4', 'leste', null),
  ('leste-6-S-5', 'leste', null),
  ('leste-7-N-1', 'leste', null),
  ('leste-7-N-2', 'leste', null),
  ('leste-7-N-3', 'leste', null),
  ('leste-7-N-4', 'leste', null),
  ('leste-7-N-5', 'leste', null),
  ('leste-7-S-1', 'leste', null),
  ('leste-7-S-2', 'leste', null),
  ('leste-7-S-3', 'leste', null),
  ('leste-7-S-4', 'leste', null),
  ('leste-7-S-5', 'leste', null),
  ('centro-oeste-1-O-1', 'centro-oeste', null),
  ('centro-oeste-1-O-2', 'centro-oeste', null),
  ('centro-oeste-1-O-3', 'centro-oeste', null),
  ('centro-oeste-1-O-4', 'centro-oeste', null),
  ('centro-oeste-1-O-5', 'centro-oeste', null),
  ('centro-oeste-1-L-1', 'centro-oeste', null),
  ('centro-oeste-1-L-2', 'centro-oeste', null),
  ('centro-oeste-1-L-3', 'centro-oeste', null),
  ('centro-oeste-1-L-4', 'centro-oeste', null),
  ('centro-oeste-1-L-5', 'centro-oeste', null),
  ('centro-oeste-2-O-1', 'centro-oeste', null),
  ('centro-oeste-2-O-2', 'centro-oeste', null),
  ('centro-oeste-2-O-3', 'centro-oeste', null),
  ('centro-oeste-2-O-4', 'centro-oeste', null),
  ('centro-oeste-2-O-5', 'centro-oeste', null),
  ('centro-oeste-2-L-1', 'centro-oeste', null),
  ('centro-oeste-2-L-2', 'centro-oeste', null),
  ('centro-oeste-2-L-3', 'centro-oeste', null),
  ('centro-oeste-2-L-4', 'centro-oeste', null),
  ('centro-oeste-2-L-5', 'centro-oeste', null),
  ('centro-oeste-3-O-1', 'centro-oeste', null),
  ('centro-oeste-3-O-2', 'centro-oeste', null),
  ('centro-oeste-3-O-3', 'centro-oeste', null),
  ('centro-oeste-3-O-4', 'centro-oeste', null),
  ('centro-oeste-3-O-5', 'centro-oeste', null),
  ('centro-oeste-3-L-1', 'centro-oeste', null),
  ('centro-oeste-3-L-2', 'centro-oeste', null),
  ('centro-oeste-3-L-3', 'centro-oeste', null),
  ('centro-oeste-3-L-4', 'centro-oeste', null),
  ('centro-oeste-3-L-5', 'centro-oeste', null),
  ('centro-oeste-4-O-1', 'centro-oeste', null),
  ('centro-oeste-4-O-2', 'centro-oeste', null),
  ('centro-oeste-4-O-3', 'centro-oeste', null),
  ('centro-oeste-4-O-4', 'centro-oeste', null),
  ('centro-oeste-4-O-5', 'centro-oeste', null),
  ('centro-oeste-4-L-1', 'centro-oeste', null),
  ('centro-oeste-4-L-2', 'centro-oeste', null),
  ('centro-oeste-4-L-3', 'centro-oeste', null),
  ('centro-oeste-4-L-4', 'centro-oeste', null),
  ('centro-oeste-4-L-5', 'centro-oeste', null),
  ('centro-oeste-5-O-1', 'centro-oeste', null),
  ('centro-oeste-5-O-2', 'centro-oeste', null),
  ('centro-oeste-5-O-3', 'centro-oeste', null),
  ('centro-oeste-5-O-4', 'centro-oeste', null),
  ('centro-oeste-5-O-5', 'centro-oeste', null),
  ('centro-oeste-5-L-1', 'centro-oeste', null),
  ('centro-oeste-5-L-2', 'centro-oeste', null),
  ('centro-oeste-5-L-3', 'centro-oeste', null),
  ('centro-oeste-5-L-4', 'centro-oeste', null),
  ('centro-oeste-5-L-5', 'centro-oeste', null),
  ('centro-1-O-1', 'centro', null),
  ('centro-1-O-2', 'centro', null),
  ('centro-1-O-3', 'centro', null),
  ('centro-1-O-4', 'centro', null),
  ('centro-1-O-5', 'centro', null),
  ('centro-1-O-6', 'centro', null),
  ('centro-1-L-1', 'centro', null),
  ('centro-1-L-2', 'centro', null),
  ('centro-1-L-3', 'centro', null),
  ('centro-1-L-4', 'centro', null),
  ('centro-1-L-5', 'centro', null),
  ('centro-1-L-6', 'centro', null),
  ('centro-2-O-1', 'centro', null),
  ('centro-2-O-2', 'centro', null),
  ('centro-2-O-3', 'centro', null),
  ('centro-2-O-4', 'centro', null),
  ('centro-2-O-5', 'centro', null),
  ('centro-2-O-6', 'centro', null),
  ('centro-2-L-1', 'centro', null),
  ('centro-2-L-2', 'centro', null),
  ('centro-2-L-3', 'centro', null),
  ('centro-2-L-4', 'centro', null),
  ('centro-2-L-5', 'centro', null),
  ('centro-2-L-6', 'centro', null),
  ('centro-leste-1-O-1', 'centro-leste', null),
  ('centro-leste-1-O-2', 'centro-leste', null),
  ('centro-leste-1-O-3', 'centro-leste', null),
  ('centro-leste-1-O-4', 'centro-leste', null),
  ('centro-leste-1-O-5', 'centro-leste', null),
  ('centro-leste-1-L-1', 'centro-leste', null),
  ('centro-leste-1-L-2', 'centro-leste', null),
  ('centro-leste-1-L-3', 'centro-leste', null),
  ('centro-leste-1-L-4', 'centro-leste', null),
  ('centro-leste-1-L-5', 'centro-leste', null),
  ('centro-leste-2-O-1', 'centro-leste', null),
  ('centro-leste-2-O-2', 'centro-leste', null),
  ('centro-leste-2-O-3', 'centro-leste', null),
  ('centro-leste-2-O-4', 'centro-leste', null),
  ('centro-leste-2-O-5', 'centro-leste', null),
  ('centro-leste-2-L-1', 'centro-leste', null),
  ('centro-leste-2-L-2', 'centro-leste', null),
  ('centro-leste-2-L-3', 'centro-leste', null),
  ('centro-leste-2-L-4', 'centro-leste', null),
  ('centro-leste-2-L-5', 'centro-leste', null),
  ('sul-1-O-1', 'sul', null),
  ('sul-1-O-2', 'sul', null),
  ('sul-1-O-3', 'sul', null),
  ('sul-1-O-4', 'sul', null),
  ('sul-1-O-5', 'sul', null),
  ('sul-1-L-1', 'sul', null),
  ('sul-1-L-2', 'sul', null),
  ('sul-1-L-3', 'sul', null),
  ('sul-1-L-4', 'sul', null),
  ('sul-1-L-5', 'sul', null),
  ('sul-2-O-1', 'sul', null),
  ('sul-2-O-2', 'sul', null),
  ('sul-2-O-3', 'sul', null),
  ('sul-2-O-4', 'sul', null),
  ('sul-2-O-5', 'sul', null),
  ('sul-2-L-1', 'sul', null),
  ('sul-2-L-2', 'sul', null),
  ('sul-2-L-3', 'sul', null),
  ('sul-2-L-4', 'sul', null),
  ('sul-2-L-5', 'sul', null),
  ('sul-3-O-1', 'sul', null),
  ('sul-3-O-2', 'sul', null),
  ('sul-3-O-3', 'sul', null),
  ('sul-3-O-4', 'sul', null),
  ('sul-3-O-5', 'sul', null),
  ('sul-3-L-1', 'sul', null),
  ('sul-3-L-2', 'sul', null),
  ('sul-3-L-3', 'sul', null),
  ('sul-3-L-4', 'sul', null),
  ('sul-3-L-5', 'sul', null),
  ('sul-4-O-1', 'sul', null),
  ('sul-4-O-2', 'sul', null),
  ('sul-4-O-3', 'sul', null),
  ('sul-4-O-4', 'sul', null),
  ('sul-4-O-5', 'sul', null),
  ('sul-4-L-1', 'sul', null),
  ('sul-4-L-2', 'sul', null),
  ('sul-4-L-3', 'sul', null),
  ('sul-4-L-4', 'sul', null),
  ('sul-4-L-5', 'sul', null),
  ('sul-5-O-1', 'sul', null),
  ('sul-5-O-2', 'sul', null),
  ('sul-5-O-3', 'sul', null),
  ('sul-5-O-4', 'sul', null),
  ('sul-5-O-5', 'sul', null),
  ('sul-5-L-1', 'sul', null),
  ('sul-5-L-2', 'sul', null),
  ('sul-5-L-3', 'sul', null),
  ('sul-5-L-4', 'sul', null),
  ('sul-5-L-5', 'sul', null),
  ('sul-6-O-1', 'sul', null),
  ('sul-6-O-2', 'sul', null),
  ('sul-6-O-3', 'sul', null),
  ('sul-6-O-4', 'sul', null),
  ('sul-6-O-5', 'sul', null),
  ('sul-6-L-1', 'sul', null),
  ('sul-6-L-2', 'sul', null),
  ('sul-6-L-3', 'sul', null),
  ('sul-6-L-4', 'sul', null),
  ('sul-6-L-5', 'sul', null),
  ('sul-7-O-1', 'sul', null),
  ('sul-7-O-2', 'sul', null),
  ('sul-7-O-3', 'sul', null),
  ('sul-7-O-4', 'sul', null),
  ('sul-7-O-5', 'sul', null),
  ('sul-7-L-1', 'sul', null),
  ('sul-7-L-2', 'sul', null),
  ('sul-7-L-3', 'sul', null),
  ('sul-7-L-4', 'sul', null),
  ('sul-7-L-5', 'sul', null),
  ('sul-8-O-1', 'sul', null),
  ('sul-8-O-2', 'sul', null),
  ('sul-8-O-3', 'sul', null),
  ('sul-8-O-4', 'sul', null),
  ('sul-8-O-5', 'sul', null),
  ('sul-8-L-1', 'sul', null),
  ('sul-8-L-2', 'sul', null),
  ('sul-8-L-3', 'sul', null),
  ('sul-8-L-4', 'sul', null),
  ('sul-8-L-5', 'sul', null),
  ('sul-9-O-1', 'sul', null),
  ('sul-9-O-2', 'sul', null),
  ('sul-9-O-3', 'sul', null),
  ('sul-9-O-4', 'sul', null),
  ('sul-9-O-5', 'sul', null),
  ('sul-9-L-1', 'sul', null),
  ('sul-9-L-2', 'sul', null),
  ('sul-9-L-3', 'sul', null),
  ('sul-9-L-4', 'sul', null),
  ('sul-9-L-5', 'sul', null),
  ('sul-10-O-1', 'sul', null),
  ('sul-10-O-2', 'sul', null),
  ('sul-10-O-3', 'sul', null),
  ('sul-10-O-4', 'sul', null),
  ('sul-10-O-5', 'sul', null),
  ('sul-10-L-1', 'sul', null),
  ('sul-10-L-2', 'sul', null),
  ('sul-10-L-3', 'sul', null),
  ('sul-10-L-4', 'sul', null),
  ('sul-10-L-5', 'sul', null),
  ('sul-11-O-1', 'sul', null),
  ('sul-11-O-2', 'sul', null),
  ('sul-11-O-3', 'sul', null),
  ('sul-11-O-4', 'sul', null),
  ('sul-11-O-5', 'sul', null),
  ('sul-11-L-1', 'sul', null),
  ('sul-11-L-2', 'sul', null),
  ('sul-11-L-3', 'sul', null),
  ('sul-11-L-4', 'sul', null),
  ('sul-11-L-5', 'sul', null),
  ('sul-12-O-1', 'sul', null),
  ('sul-12-O-2', 'sul', null),
  ('sul-12-O-3', 'sul', null),
  ('sul-12-O-4', 'sul', null),
  ('sul-12-O-5', 'sul', null),
  ('sul-12-L-1', 'sul', null),
  ('sul-12-L-2', 'sul', null),
  ('sul-12-L-3', 'sul', null),
  ('sul-12-L-4', 'sul', null),
  ('sul-12-L-5', 'sul', null),
  ('sul-13-O-1', 'sul', null),
  ('sul-13-O-2', 'sul', null),
  ('sul-13-O-3', 'sul', null),
  ('sul-13-O-4', 'sul', null),
  ('sul-13-O-5', 'sul', null),
  ('sul-13-L-1', 'sul', null),
  ('sul-13-L-2', 'sul', null),
  ('sul-13-L-3', 'sul', null),
  ('sul-13-L-4', 'sul', null),
  ('sul-13-L-5', 'sul', null),
  ('sul-14-O-1', 'sul', null),
  ('sul-14-O-2', 'sul', null),
  ('sul-14-O-3', 'sul', null),
  ('sul-14-O-4', 'sul', null),
  ('sul-14-O-5', 'sul', null),
  ('sul-14-L-1', 'sul', null),
  ('sul-14-L-2', 'sul', null),
  ('sul-14-L-3', 'sul', null),
  ('sul-14-L-4', 'sul', null),
  ('sul-14-L-5', 'sul', null),
  ('sul-15-O-1', 'sul', null),
  ('sul-15-O-2', 'sul', null),
  ('sul-15-O-3', 'sul', null),
  ('sul-15-O-4', 'sul', null),
  ('sul-15-O-5', 'sul', null),
  ('sul-15-L-1', 'sul', null),
  ('sul-15-L-2', 'sul', null),
  ('sul-15-L-3', 'sul', null),
  ('sul-15-L-4', 'sul', null),
  ('sul-15-L-5', 'sul', null),
  ('sul-16-O-1', 'sul', null),
  ('sul-16-O-2', 'sul', null),
  ('sul-16-O-3', 'sul', null),
  ('sul-16-O-4', 'sul', null),
  ('sul-16-O-5', 'sul', null),
  ('sul-16-L-1', 'sul', null),
  ('sul-16-L-2', 'sul', null),
  ('sul-16-L-3', 'sul', null),
  ('sul-16-L-4', 'sul', null),
  ('sul-16-L-5', 'sul', null),
  ('sul-17-O-1', 'sul', null),
  ('sul-17-O-2', 'sul', null),
  ('sul-17-O-3', 'sul', null),
  ('sul-17-O-4', 'sul', null),
  ('sul-17-O-5', 'sul', null),
  ('sul-17-L-1', 'sul', null),
  ('sul-17-L-2', 'sul', null),
  ('sul-17-L-3', 'sul', null),
  ('sul-17-L-4', 'sul', null),
  ('sul-17-L-5', 'sul', null),
  ('sul-18-O-1', 'sul', null),
  ('sul-18-O-2', 'sul', null),
  ('sul-18-O-3', 'sul', null),
  ('sul-18-O-4', 'sul', null),
  ('sul-18-O-5', 'sul', null),
  ('sul-18-L-1', 'sul', null),
  ('sul-18-L-2', 'sul', null),
  ('sul-18-L-3', 'sul', null),
  ('sul-18-L-4', 'sul', null),
  ('sul-18-L-5', 'sul', null),
  ('sul-19-O-1', 'sul', null),
  ('sul-19-O-2', 'sul', null),
  ('sul-19-O-3', 'sul', null),
  ('sul-19-O-4', 'sul', null),
  ('sul-19-O-5', 'sul', null),
  ('sul-19-L-1', 'sul', null),
  ('sul-19-L-2', 'sul', null),
  ('sul-19-L-3', 'sul', null),
  ('sul-19-L-4', 'sul', null),
  ('sul-19-L-5', 'sul', null),
  ('sul-20-O-1', 'sul', null),
  ('sul-20-O-2', 'sul', null),
  ('sul-20-O-3', 'sul', null),
  ('sul-20-O-4', 'sul', null),
  ('sul-20-O-5', 'sul', null),
  ('sul-20-L-1', 'sul', null),
  ('sul-20-L-2', 'sul', null),
  ('sul-20-L-3', 'sul', null),
  ('sul-20-L-4', 'sul', null),
  ('sul-20-L-5', 'sul', null),
  ('recepcao-1', null, 'recepcao'),
  ('recepcao-2', null, 'recepcao'),
  ('sala-executiva-1', null, 'sala-executiva')
on conflict (id) do update set zona = excluded.zona, area = excluded.area, ativo = true;

-- cadeira que saiu do layout fica inativa (nunca é apagada); quem estava
-- nela continua salvo e aparece como "sem lugar" até escolher outra
update public.escritorio_lugares set ativo = false
where id not in ('norte-1-O-1', 'norte-1-O-2', 'norte-1-O-3', 'norte-1-O-4', 'norte-1-L-1', 'norte-1-L-2', 'norte-1-L-3', 'norte-1-L-4', 'norte-2-O-1', 'norte-2-O-2', 'norte-2-O-3', 'norte-2-O-4', 'norte-2-L-1', 'norte-2-L-2', 'norte-2-L-3', 'norte-2-L-4', 'norte-3-O-1', 'norte-3-O-2', 'norte-3-O-3', 'norte-3-O-4', 'norte-3-L-1', 'norte-3-L-2', 'norte-3-L-3', 'norte-3-L-4', 'norte-4-O-1', 'norte-4-O-2', 'norte-4-O-3', 'norte-4-O-4', 'norte-4-L-1', 'norte-4-L-2', 'norte-4-L-3', 'norte-4-L-4', 'norte-5-O-1', 'norte-5-O-2', 'norte-5-O-3', 'norte-5-O-4', 'norte-5-L-1', 'norte-5-L-2', 'norte-5-L-3', 'norte-5-L-4', 'norte-6-O-1', 'norte-6-O-2', 'norte-6-O-3', 'norte-6-O-4', 'norte-6-L-1', 'norte-6-L-2', 'norte-6-L-3', 'norte-6-L-4', 'norte-7-O-1', 'norte-7-O-2', 'norte-7-O-3', 'norte-7-O-4', 'norte-7-L-1', 'norte-7-L-2', 'norte-7-L-3', 'norte-7-L-4', 'norte-8-O-1', 'norte-8-O-2', 'norte-8-O-3', 'norte-8-O-4', 'norte-8-L-1', 'norte-8-L-2', 'norte-8-L-3', 'norte-8-L-4', 'norte-9-O-1', 'norte-9-O-2', 'norte-9-O-3', 'norte-9-O-4', 'norte-9-L-1', 'norte-9-L-2', 'norte-9-L-3', 'norte-9-L-4', 'norte-10-O-1', 'norte-10-O-2', 'norte-10-O-3', 'norte-10-O-4', 'norte-10-L-1', 'norte-10-L-2', 'norte-10-L-3', 'norte-10-L-4', 'norte-11-O-1', 'norte-11-O-2', 'norte-11-O-3', 'norte-11-O-4', 'norte-11-L-1', 'norte-11-L-2', 'norte-11-L-3', 'norte-11-L-4', 'norte-12-O-1', 'norte-12-O-2', 'norte-12-O-3', 'norte-12-O-4', 'norte-12-L-1', 'norte-12-L-2', 'norte-12-L-3', 'norte-12-L-4', 'norte-13-O-1', 'norte-13-O-2', 'norte-13-O-3', 'norte-13-O-4', 'norte-13-L-1', 'norte-13-L-2', 'norte-13-L-3', 'norte-13-L-4', 'norte-14-O-1', 'norte-14-O-2', 'norte-14-O-3', 'norte-14-O-4', 'norte-14-L-1', 'norte-14-L-2', 'norte-14-L-3', 'norte-14-L-4', 'nordeste-1-O-1', 'nordeste-1-O-2', 'nordeste-1-O-3', 'nordeste-1-O-4', 'nordeste-1-L-1', 'nordeste-1-L-2', 'nordeste-1-L-3', 'nordeste-1-L-4', 'nordeste-2-O-1', 'nordeste-2-O-2', 'nordeste-2-O-3', 'nordeste-2-O-4', 'nordeste-2-L-1', 'nordeste-2-L-2', 'nordeste-2-L-3', 'nordeste-2-L-4', 'nordeste-3-O-1', 'nordeste-3-O-2', 'nordeste-3-O-3', 'nordeste-3-O-4', 'nordeste-3-L-1', 'nordeste-3-L-2', 'nordeste-3-L-3', 'nordeste-3-L-4', 'nordeste-4-O-1', 'nordeste-4-O-2', 'nordeste-4-O-3', 'nordeste-4-O-4', 'nordeste-4-L-1', 'nordeste-4-L-2', 'nordeste-4-L-3', 'nordeste-4-L-4', 'leste-1-N-1', 'leste-1-N-2', 'leste-1-N-3', 'leste-1-N-4', 'leste-1-N-5', 'leste-1-S-1', 'leste-1-S-2', 'leste-1-S-3', 'leste-1-S-4', 'leste-1-S-5', 'leste-2-N-1', 'leste-2-N-2', 'leste-2-N-3', 'leste-2-N-4', 'leste-2-N-5', 'leste-2-S-1', 'leste-2-S-2', 'leste-2-S-3', 'leste-2-S-4', 'leste-2-S-5', 'leste-3-N-1', 'leste-3-N-2', 'leste-3-N-3', 'leste-3-N-4', 'leste-3-N-5', 'leste-3-S-1', 'leste-3-S-2', 'leste-3-S-3', 'leste-3-S-4', 'leste-3-S-5', 'leste-4-N-1', 'leste-4-N-2', 'leste-4-N-3', 'leste-4-N-4', 'leste-4-N-5', 'leste-4-S-1', 'leste-4-S-2', 'leste-4-S-3', 'leste-4-S-4', 'leste-4-S-5', 'leste-5-N-1', 'leste-5-N-2', 'leste-5-N-3', 'leste-5-N-4', 'leste-5-N-5', 'leste-5-S-1', 'leste-5-S-2', 'leste-5-S-3', 'leste-5-S-4', 'leste-5-S-5', 'leste-6-N-1', 'leste-6-N-2', 'leste-6-N-3', 'leste-6-N-4', 'leste-6-N-5', 'leste-6-S-1', 'leste-6-S-2', 'leste-6-S-3', 'leste-6-S-4', 'leste-6-S-5', 'leste-7-N-1', 'leste-7-N-2', 'leste-7-N-3', 'leste-7-N-4', 'leste-7-N-5', 'leste-7-S-1', 'leste-7-S-2', 'leste-7-S-3', 'leste-7-S-4', 'leste-7-S-5', 'centro-oeste-1-O-1', 'centro-oeste-1-O-2', 'centro-oeste-1-O-3', 'centro-oeste-1-O-4', 'centro-oeste-1-O-5', 'centro-oeste-1-L-1', 'centro-oeste-1-L-2', 'centro-oeste-1-L-3', 'centro-oeste-1-L-4', 'centro-oeste-1-L-5', 'centro-oeste-2-O-1', 'centro-oeste-2-O-2', 'centro-oeste-2-O-3', 'centro-oeste-2-O-4', 'centro-oeste-2-O-5', 'centro-oeste-2-L-1', 'centro-oeste-2-L-2', 'centro-oeste-2-L-3', 'centro-oeste-2-L-4', 'centro-oeste-2-L-5', 'centro-oeste-3-O-1', 'centro-oeste-3-O-2', 'centro-oeste-3-O-3', 'centro-oeste-3-O-4', 'centro-oeste-3-O-5', 'centro-oeste-3-L-1', 'centro-oeste-3-L-2', 'centro-oeste-3-L-3', 'centro-oeste-3-L-4', 'centro-oeste-3-L-5', 'centro-oeste-4-O-1', 'centro-oeste-4-O-2', 'centro-oeste-4-O-3', 'centro-oeste-4-O-4', 'centro-oeste-4-O-5', 'centro-oeste-4-L-1', 'centro-oeste-4-L-2', 'centro-oeste-4-L-3', 'centro-oeste-4-L-4', 'centro-oeste-4-L-5', 'centro-oeste-5-O-1', 'centro-oeste-5-O-2', 'centro-oeste-5-O-3', 'centro-oeste-5-O-4', 'centro-oeste-5-O-5', 'centro-oeste-5-L-1', 'centro-oeste-5-L-2', 'centro-oeste-5-L-3', 'centro-oeste-5-L-4', 'centro-oeste-5-L-5', 'centro-1-O-1', 'centro-1-O-2', 'centro-1-O-3', 'centro-1-O-4', 'centro-1-O-5', 'centro-1-O-6', 'centro-1-L-1', 'centro-1-L-2', 'centro-1-L-3', 'centro-1-L-4', 'centro-1-L-5', 'centro-1-L-6', 'centro-2-O-1', 'centro-2-O-2', 'centro-2-O-3', 'centro-2-O-4', 'centro-2-O-5', 'centro-2-O-6', 'centro-2-L-1', 'centro-2-L-2', 'centro-2-L-3', 'centro-2-L-4', 'centro-2-L-5', 'centro-2-L-6', 'centro-leste-1-O-1', 'centro-leste-1-O-2', 'centro-leste-1-O-3', 'centro-leste-1-O-4', 'centro-leste-1-O-5', 'centro-leste-1-L-1', 'centro-leste-1-L-2', 'centro-leste-1-L-3', 'centro-leste-1-L-4', 'centro-leste-1-L-5', 'centro-leste-2-O-1', 'centro-leste-2-O-2', 'centro-leste-2-O-3', 'centro-leste-2-O-4', 'centro-leste-2-O-5', 'centro-leste-2-L-1', 'centro-leste-2-L-2', 'centro-leste-2-L-3', 'centro-leste-2-L-4', 'centro-leste-2-L-5', 'sul-1-O-1', 'sul-1-O-2', 'sul-1-O-3', 'sul-1-O-4', 'sul-1-O-5', 'sul-1-L-1', 'sul-1-L-2', 'sul-1-L-3', 'sul-1-L-4', 'sul-1-L-5', 'sul-2-O-1', 'sul-2-O-2', 'sul-2-O-3', 'sul-2-O-4', 'sul-2-O-5', 'sul-2-L-1', 'sul-2-L-2', 'sul-2-L-3', 'sul-2-L-4', 'sul-2-L-5', 'sul-3-O-1', 'sul-3-O-2', 'sul-3-O-3', 'sul-3-O-4', 'sul-3-O-5', 'sul-3-L-1', 'sul-3-L-2', 'sul-3-L-3', 'sul-3-L-4', 'sul-3-L-5', 'sul-4-O-1', 'sul-4-O-2', 'sul-4-O-3', 'sul-4-O-4', 'sul-4-O-5', 'sul-4-L-1', 'sul-4-L-2', 'sul-4-L-3', 'sul-4-L-4', 'sul-4-L-5', 'sul-5-O-1', 'sul-5-O-2', 'sul-5-O-3', 'sul-5-O-4', 'sul-5-O-5', 'sul-5-L-1', 'sul-5-L-2', 'sul-5-L-3', 'sul-5-L-4', 'sul-5-L-5', 'sul-6-O-1', 'sul-6-O-2', 'sul-6-O-3', 'sul-6-O-4', 'sul-6-O-5', 'sul-6-L-1', 'sul-6-L-2', 'sul-6-L-3', 'sul-6-L-4', 'sul-6-L-5', 'sul-7-O-1', 'sul-7-O-2', 'sul-7-O-3', 'sul-7-O-4', 'sul-7-O-5', 'sul-7-L-1', 'sul-7-L-2', 'sul-7-L-3', 'sul-7-L-4', 'sul-7-L-5', 'sul-8-O-1', 'sul-8-O-2', 'sul-8-O-3', 'sul-8-O-4', 'sul-8-O-5', 'sul-8-L-1', 'sul-8-L-2', 'sul-8-L-3', 'sul-8-L-4', 'sul-8-L-5', 'sul-9-O-1', 'sul-9-O-2', 'sul-9-O-3', 'sul-9-O-4', 'sul-9-O-5', 'sul-9-L-1', 'sul-9-L-2', 'sul-9-L-3', 'sul-9-L-4', 'sul-9-L-5', 'sul-10-O-1', 'sul-10-O-2', 'sul-10-O-3', 'sul-10-O-4', 'sul-10-O-5', 'sul-10-L-1', 'sul-10-L-2', 'sul-10-L-3', 'sul-10-L-4', 'sul-10-L-5', 'sul-11-O-1', 'sul-11-O-2', 'sul-11-O-3', 'sul-11-O-4', 'sul-11-O-5', 'sul-11-L-1', 'sul-11-L-2', 'sul-11-L-3', 'sul-11-L-4', 'sul-11-L-5', 'sul-12-O-1', 'sul-12-O-2', 'sul-12-O-3', 'sul-12-O-4', 'sul-12-O-5', 'sul-12-L-1', 'sul-12-L-2', 'sul-12-L-3', 'sul-12-L-4', 'sul-12-L-5', 'sul-13-O-1', 'sul-13-O-2', 'sul-13-O-3', 'sul-13-O-4', 'sul-13-O-5', 'sul-13-L-1', 'sul-13-L-2', 'sul-13-L-3', 'sul-13-L-4', 'sul-13-L-5', 'sul-14-O-1', 'sul-14-O-2', 'sul-14-O-3', 'sul-14-O-4', 'sul-14-O-5', 'sul-14-L-1', 'sul-14-L-2', 'sul-14-L-3', 'sul-14-L-4', 'sul-14-L-5', 'sul-15-O-1', 'sul-15-O-2', 'sul-15-O-3', 'sul-15-O-4', 'sul-15-O-5', 'sul-15-L-1', 'sul-15-L-2', 'sul-15-L-3', 'sul-15-L-4', 'sul-15-L-5', 'sul-16-O-1', 'sul-16-O-2', 'sul-16-O-3', 'sul-16-O-4', 'sul-16-O-5', 'sul-16-L-1', 'sul-16-L-2', 'sul-16-L-3', 'sul-16-L-4', 'sul-16-L-5', 'sul-17-O-1', 'sul-17-O-2', 'sul-17-O-3', 'sul-17-O-4', 'sul-17-O-5', 'sul-17-L-1', 'sul-17-L-2', 'sul-17-L-3', 'sul-17-L-4', 'sul-17-L-5', 'sul-18-O-1', 'sul-18-O-2', 'sul-18-O-3', 'sul-18-O-4', 'sul-18-O-5', 'sul-18-L-1', 'sul-18-L-2', 'sul-18-L-3', 'sul-18-L-4', 'sul-18-L-5', 'sul-19-O-1', 'sul-19-O-2', 'sul-19-O-3', 'sul-19-O-4', 'sul-19-O-5', 'sul-19-L-1', 'sul-19-L-2', 'sul-19-L-3', 'sul-19-L-4', 'sul-19-L-5', 'sul-20-O-1', 'sul-20-O-2', 'sul-20-O-3', 'sul-20-O-4', 'sul-20-O-5', 'sul-20-L-1', 'sul-20-L-2', 'sul-20-L-3', 'sul-20-L-4', 'sul-20-L-5', 'recepcao-1', 'recepcao-2', 'sala-executiva-1');

-- 7. Personagens fixos (15) ----------------------------------------------

insert into public.escritorio_personagens (fixo, apelido, apelido_chave, lugar)
select true, f.apelido, public.escritorio_chave(f.apelido), f.lugar
from (values
  ('Gabi', 'leste-1-N-1'),
  ('Shimono', 'leste-1-N-2'),
  ('Formiga', 'leste-1-N-3'),
  ('Marlin', 'leste-1-N-4'),
  ('Matias', 'leste-1-N-5'),
  ('João', 'leste-1-S-1'),
  ('Higuinho', 'leste-1-S-2'),
  ('Erik', 'leste-1-S-3'),
  ('Wendel', 'leste-1-S-4'),
  ('Elton', 'leste-1-S-5'),
  ('Jana', 'nordeste-2-L-1'),
  ('Heitor', 'nordeste-2-L-2'),
  ('Lika', 'nordeste-2-L-3'),
  ('Rafa', 'nordeste-2-L-4'),
  ('Sem sangue', 'nordeste-4-L-1')
) as f (apelido, lugar)
on conflict (apelido_chave) do update set lugar = excluded.lugar, fixo = true;

-- 8. Conferência: tem que aparecer "tudo certo" -----------------------------

select case
  when (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) > 0
    then 'atenção: tabela sem RLS → ' || (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity)
  when (select count(*) from public.escritorio_lugares where ativo) <> 511
    then 'atenção: número de cadeiras ativas diferente de 511'
  when (select count(*) from public.escritorio_personagens where fixo) <> 15
    then 'atenção: número de personagens fixos diferente de 15'
  else 'tudo certo: 511 cadeiras, 15 fixos, RLS ligado em todas as tabelas'
end as conferencia;
