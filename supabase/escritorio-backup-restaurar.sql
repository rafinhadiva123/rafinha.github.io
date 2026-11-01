-- Simulador de escritório · BACKUP, parte 2: restaurar
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
COLE_A_COPIA_AQUI
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
