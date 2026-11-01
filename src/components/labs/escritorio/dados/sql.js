// Gera o SQL do banco do simulador a partir dos mesmos arquivos que o site
// usa: lista de cadeiras (planta/lugares.js), personagens fixos
// (planta/fixos.js) e opções de visual (visual.js). Assim o banco e o site
// nunca discordam. O resultado fica em supabase/escritorio.sql
// (npm run sql:escritorio) e um teste confere que o arquivo está em dia.
import { LUGARES } from '../planta/lugares.js';
import { FIXOS } from '../planta/fixos.js';
import { OPCOES, PADRAO, APELIDO_MAX } from '../visual.js';

const lit = s => `'${String(s).replace(/'/g, "''")}'`;
const valores = lista => lista.map(o => (typeof o === 'string' ? o : o.v));

function sqlVisualValido() {
  const chaves = Object.keys(PADRAO);
  const condicoes = chaves.map(k => `    and v->>${lit(k)} in (${valores(OPCOES[k]).map(lit).join(', ')})`);
  return `create or replace function public.escritorio_visual_valido(v jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(v) = 'object'
    and v ?& array[${chaves.map(lit).join(', ')}]
    and (select count(*) from jsonb_object_keys(v)) = ${chaves.length}
${condicoes.join('\n')}
$$;`;
}

function sqlLugares() {
  const linhas = LUGARES.map(l => `  (${lit(l.id)}, ${l.zona ? lit(l.zona) : 'null'}, ${l.area ? lit(l.area) : 'null'})`);
  return `insert into public.escritorio_lugares (id, zona, area) values
${linhas.join(',\n')}
on conflict (id) do update set zona = excluded.zona, area = excluded.area, ativo = true;

-- cadeira que saiu do layout fica inativa (nunca é apagada); quem estava
-- nela continua salvo e aparece como "sem lugar" até escolher outra
update public.escritorio_lugares set ativo = false
where id not in (${LUGARES.map(l => lit(l.id)).join(', ')});`;
}

function sqlFixos() {
  const linhas = FIXOS.map(f => `  (${lit(f.apelido)}, ${lit(f.lugar)})`);
  return `insert into public.escritorio_personagens (fixo, apelido, apelido_chave, lugar)
select true, f.apelido, public.escritorio_chave(f.apelido), f.lugar
from (values
${linhas.join(',\n')}
) as f (apelido, lugar)
on conflict (apelido_chave) do update set lugar = excluded.lugar, fixo = true;`;
}

export function gerarSql() {
  return `-- Simulador de escritório · rafinha.xyz
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
-- * os ${FIXOS.length} personagens fixos já vêm sentados, com o apelido reservado;
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
  constraint escritorio_personagens_apelido_tamanho check (char_length(apelido) between 1 and ${APELIDO_MAX}),
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
    regexp_replace(normalize(coalesce(t, ''), NFC), '\\s+', ' ', 'g'),
    '[\\u0001-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u206F\\uFEFF]', '', 'g'))
$$;

create or replace function public.escritorio_chave(t text)
returns text
language sql stable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, normalize(coalesce(t, ''), NFC))), '\\s+', ' ', 'g'))
$$;

${sqlVisualValido()}

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
  if char_length(ap) < 1 or char_length(ap) > ${APELIDO_MAX} then
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

-- 6. Cadeiras (${LUGARES.length}) ------------------------------------------------

${sqlLugares()}

-- 7. Personagens fixos (${FIXOS.length}) ----------------------------------------------

${sqlFixos()}

-- 8. Conferência: tem que aparecer "tudo certo" -----------------------------

select case
  when (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) > 0
    then 'atenção: tabela sem RLS → ' || (select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity)
  when (select count(*) from public.escritorio_lugares where ativo) <> ${LUGARES.length}
    then 'atenção: número de cadeiras ativas diferente de ${LUGARES.length}'
  when (select count(*) from public.escritorio_personagens where fixo) <> ${FIXOS.length}
    then 'atenção: número de personagens fixos diferente de ${FIXOS.length}'
  else 'tudo certo: ${LUGARES.length} cadeiras, ${FIXOS.length} fixos, RLS ligado em todas as tabelas'
end as conferencia;
`;
}
