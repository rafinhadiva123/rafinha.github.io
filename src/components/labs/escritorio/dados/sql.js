// Gera o SQL do banco do simulador a partir dos mesmos arquivos que o site
// usa: lista de cadeiras (planta/lugares.js), personagens fixos
// (planta/fixos.js) e opções de visual (visual.js). Assim o banco e o site
// nunca discordam. O resultado fica em supabase/escritorio.sql
// (npm run sql:escritorio) e um teste confere que o arquivo está em dia.
// Também gera os dois arquivos de backup (copiar e restaurar) e a prévia
// de mudança de layout (scripts/conferir-layout-escritorio.mjs).
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

const valoresFixos = () => FIXOS.map(f => `  (${lit(f.apelido)}, ${lit(f.lugar)})`).join(',\n');

/* Antes de mexer em qualquer coisa: a cadeira de cada fixo tem que estar
   livre (ou já ser dele). Se um visitante estiver nela, o script para e,
   como roda numa transação só, nada muda. */
function sqlConferirFixos() {
  return `do $$
declare
  conflito text;
begin
  select string_agg(format('%s (do fixo %s) está com %s', f.lugar, f.apelido, p.apelido), '; ')
  into conflito
  from (values
${valoresFixos()}
  ) as f (apelido, lugar)
  join public.escritorio_personagens p
    on p.lugar = f.lugar and p.apelido_chave <> public.escritorio_chave(f.apelido);
  if conflito is not null then
    raise exception 'parei sem mudar nada: cadeira de personagem fixo ocupada → %. Mude o visitante de cadeira (Table Editor → escritorio_personagens → coluna lugar) ou escolha outra cadeira para o fixo, e rode de novo.', conflito;
  end if;
end $$;`;
}

function sqlFixos() {
  return `insert into public.escritorio_personagens (fixo, apelido, apelido_chave, lugar)
select true, f.apelido, public.escritorio_chave(f.apelido), f.lugar
from (values
${valoresFixos()}
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
-- exemplo): nada que já está salvo é apagado. O SQL Editor roda o texto
-- colado inteiro numa transação só: se der erro em qualquer ponto, nada muda.
-- Antes de rodar um layout novo: npm run layout:escritorio e um backup
-- (escritorio-backup-copiar.sql).
--
-- Regras:
-- * qualquer pessoa lê as cadeiras e os personagens;
-- * ninguém grava direto nas tabelas: só pelas funções escritorio_sentar e
--   escritorio_meu, que conferem tudo;
-- * cada navegador (login anônimo) tem um personagem só, e só ele mexe nele;
-- * apelidos não se repetem (sem diferença de acento, maiúscula ou espaço);
-- * os ${FIXOS.length} personagens fixos já vêm sentados, com o apelido reservado;
-- * cada visitante pode excluir o próprio personagem (escritorio_sair);
-- * para tirar alguém: Table Editor → escritorio_personagens → apagar a
--   linha (nunca uma com fixo = true).

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

-- excluir o próprio personagem: apaga a linha (o dono vai junto) e libera
-- a cadeira e o apelido; fixo nunca sai por aqui
create or replace function public.escritorio_sair()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null then
    raise exception using message = 'sem_sessao', errcode = 'P0001';
  end if;
  delete from public.escritorio_personagens p
  using public.escritorio_donos d
  where d.dono = eu and p.id = d.personagem and not p.fixo;
  return found;
end;
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
revoke all on function public.escritorio_sentar(text, text, jsonb), public.escritorio_meu(), public.escritorio_sair() from public, anon;
grant execute on function public.escritorio_sentar(text, text, jsonb), public.escritorio_meu(), public.escritorio_sair() to authenticated;

-- 5. Atualização ao vivo --------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'escritorio_personagens') then
    alter publication supabase_realtime add table public.escritorio_personagens;
  end if;
end $$;

-- 6. Cadeiras dos fixos livres? -------------------------------------------

${sqlConferirFixos()}

-- 7. Cadeiras (${LUGARES.length}) ------------------------------------------------

${sqlLugares()}

-- 8. Personagens fixos (${FIXOS.length}) ----------------------------------------------

${sqlFixos()}

-- 9. Conferência: tem que aparecer "tudo certo" -----------------------------

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

/* ---------------------------------------------------------------- backup */

/** supabase/escritorio-backup-copiar.sql: só lê, não muda nada. */
export function gerarSqlBackupCopiar() {
  return `-- Simulador de escritório · BACKUP, parte 1: copiar
-- Gerado por scripts/gerar-sql-escritorio.mjs. Não edite à mão.
--
-- Só lê, não muda nada. Supabase → SQL Editor → New query → cole → Run.
-- Aparece uma linha com a coluna "copia": copie o texto inteiro dela e
-- guarde num arquivo PRIVADO (ex.: escritorio-backup-2026-11-01.json no
-- iCloud). Nunca no repositório, que é público: a cópia tem os
-- identificadores dos navegadores (quem é dono de cada personagem).
--
-- Os ${FIXOS.length} fixos não entram: eles vêm do código e voltam sozinhos
-- quando supabase/escritorio.sql roda.
-- Para restaurar: supabase/escritorio-backup-restaurar.sql.

select json_build_object(
  'tipo', 'escritorio-backup',
  'versao', 1,
  'feito_em', now(),
  'personagens', (
    select coalesce(json_agg(json_build_object(
      'id', p.id, 'apelido', p.apelido, 'apelido_chave', p.apelido_chave, 'lugar', p.lugar,
      'visual', p.visual, 'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em
    ) order by p.criado_em), '[]'::json)
    from public.escritorio_personagens p
    where not p.fixo
  ),
  'donos', (
    select coalesce(json_agg(json_build_object('dono', d.dono, 'personagem', d.personagem)), '[]'::json)
    from public.escritorio_donos d
  )
)::text as copia,
(select count(*) from public.escritorio_personagens where not fixo) as personagens;
`;
}

export const MARCA_COLAR = 'COLE_A_COPIA_AQUI';

/** supabase/escritorio-backup-restaurar.sql: recoloca quem falta, sem apagar nem duplicar. */
export function gerarSqlBackupRestaurar() {
  return `-- Simulador de escritório · BACKUP, parte 2: restaurar
-- Gerado por scripts/gerar-sql-escritorio.mjs. Não edite este arquivo; edite
-- só a cópia que você colar no SQL Editor.
--
-- 1. Supabase → SQL Editor → New query → cole este arquivo inteiro.
-- 2. Mais abaixo, entre as duas marcas $copia$, apague a linha com o aviso
--    em maiúsculas e cole no lugar o texto que você guardou com
--    escritorio-backup-copiar.sql.
-- 3. Run. Aparece uma tabela dizendo o que aconteceu com cada personagem.
--
-- O que ele faz:
-- * só ACRESCENTA: não apaga ninguém e não mexe em quem já está no banco;
--   rodar duas vezes não duplica nada;
-- * personagem que voltou recupera o dono (o visitante continua podendo
--   mudar de cadeira ou excluir);
-- * se a cadeira dele estiver com outra pessoa (ou não existir mais), volta
--   "sem cadeira": continua salvo e escolhe outra quando abrir o site;
-- * se o apelido já estiver com outro personagem, ele é pulado (aparece na
--   tabela) para nunca existir apelido repetido;
-- * roda numa transação só: se der erro, nada muda.

drop table if exists pg_temp.escritorio_copia, pg_temp.escritorio_resultado, pg_temp.escritorio_p;
create temp table escritorio_copia (t text);
create temp table escritorio_resultado (situacao text, apelido text);

insert into escritorio_copia values ($copia$
${MARCA_COLAR}
$copia$);

do $$
declare
  j jsonb;
begin
  begin
    select btrim(t)::jsonb into j from escritorio_copia;
  exception when others then
    raise exception 'parei sem mudar nada: o texto colado não é uma cópia válida (entre as marcas $copia$ vai o texto inteiro da coluna "copia").';
  end;
  if j->>'tipo' is distinct from 'escritorio-backup' or jsonb_typeof(j->'personagens') <> 'array' then
    raise exception 'parei sem mudar nada: o texto colado não é uma cópia do escritório.';
  end if;
end $$;

create temp table escritorio_p as
select r.*
from escritorio_copia c,
  jsonb_to_recordset(btrim(c.t)::jsonb->'personagens')
    as r (id uuid, apelido text, apelido_chave text, lugar text, visual jsonb, criado_em timestamptz, atualizado_em timestamptz);

insert into escritorio_resultado
select 'já estava no banco', p.apelido
from escritorio_p p
where exists (select 1 from public.escritorio_personagens x where x.id = p.id);

insert into escritorio_resultado
select 'pulado: apelido já é de outro personagem', p.apelido
from escritorio_p p
where not exists (select 1 from public.escritorio_personagens x where x.id = p.id)
  and exists (select 1 from public.escritorio_personagens x where x.apelido_chave = p.apelido_chave);

with novos as (
  select p.*,
    p.lugar is not null
    and exists (select 1 from public.escritorio_lugares l where l.id = p.lugar)
    and not exists (select 1 from public.escritorio_personagens x where x.lugar = p.lugar) as cabe
  from escritorio_p p
  where not exists (select 1 from public.escritorio_personagens x where x.id = p.id or x.apelido_chave = p.apelido_chave)
),
voltaram as (
  insert into public.escritorio_personagens (id, fixo, apelido, apelido_chave, lugar, visual, criado_em, atualizado_em)
  select id, false, apelido, apelido_chave, case when cabe then lugar end, visual, criado_em, atualizado_em
  from novos
  returning apelido, lugar
)
insert into escritorio_resultado
select case when lugar is null then 'voltou sem cadeira (escolhe outra ao abrir o site)' else 'voltou para a cadeira dele' end, apelido
from voltaram;

-- dono de volta só se esse navegador não tiver criado outro personagem depois
insert into public.escritorio_donos (dono, personagem)
select r.dono, r.personagem
from escritorio_copia c,
  jsonb_to_recordset(btrim(c.t)::jsonb->'donos') as r (dono uuid, personagem uuid)
where exists (select 1 from public.escritorio_personagens p where p.id = r.personagem and not p.fixo)
on conflict do nothing;

insert into escritorio_resultado
select 'voltou, mas sem dono (o navegador dele já tem outro personagem)', p.apelido
from public.escritorio_personagens p
join escritorio_p b on b.id = p.id
where not exists (select 1 from public.escritorio_donos d where d.personagem = p.id)
  and p.apelido in (select apelido from escritorio_resultado where situacao like 'voltou%')
  and exists (select 1 from escritorio_copia c, jsonb_to_recordset(btrim(c.t)::jsonb->'donos') as r (dono uuid, personagem uuid) where r.personagem = p.id);

select situacao, count(*) as quantos, string_agg(apelido, ', ' order by apelido) as apelidos
from escritorio_resultado
group by situacao
order by situacao;
`;
}

/* ---------------------------------------------------- mudança de layout */

/** Ids das cadeiras que um supabase/escritorio.sql publica. */
export function cadeirasDoSql(texto) {
  const ini = texto.indexOf('insert into public.escritorio_lugares');
  const fim = texto.indexOf('on conflict (id)', ini);
  if (ini < 0 || fim < 0) return [];
  return [...texto.slice(ini, fim).matchAll(/^\s*\('([^']+)'/gm)].map(m => m[1]);
}

/** SQL só de leitura para colar antes de aplicar um layout novo: quem fica sem cadeira. */
export function sqlPreviaLayout(removidas) {
  const fixosLugares = FIXOS.map(f => lit(f.lugar)).join(', ');
  const lista = removidas.length ? removidas.map(lit).join(', ') : "''";
  return `-- Prévia do layout novo (só lê, não muda nada).
select 'vai ficar sem cadeira (continua salvo)' as situacao, apelido, lugar
from public.escritorio_personagens
where not fixo and lugar in (${lista})
union all
select 'ATENÇÃO: está na cadeira de um fixo (o SQL novo vai parar)', apelido, lugar
from public.escritorio_personagens
where not fixo and lugar in (${fixosLugares})
order by 1, 3;`;
}
