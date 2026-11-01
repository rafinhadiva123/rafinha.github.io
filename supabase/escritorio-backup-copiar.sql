-- Simulador de escritório · BACKUP, parte 1: copiar
-- Gerado por scripts/gerar-sql-escritorio.mjs. Não edite à mão.
--
-- Só lê, não muda nada. Supabase → SQL Editor → New query → cole → Run.
-- Aparece uma linha com a coluna "copia": copie o texto inteiro dela e
-- guarde num arquivo PRIVADO (ex.: escritorio-backup-2026-11-01.json no
-- iCloud). Nunca no repositório, que é público: a cópia tem os
-- identificadores dos navegadores (quem é dono de cada personagem).
--
-- Os 15 fixos não entram: eles vêm do código e voltam sozinhos
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
