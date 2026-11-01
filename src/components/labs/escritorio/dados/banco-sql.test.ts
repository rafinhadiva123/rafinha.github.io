// Testa o SQL do banco num Postgres de verdade (PGlite), imitando o que o
// Supabase tem: papéis anon/authenticated, auth.uid() e a publicação do
// tempo real. Cada teste age como um visitante diferente.
import { beforeAll, describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { gerarSql, gerarSqlBackupCopiar, gerarSqlBackupRestaurar, MARCA_COLAR, cadeirasDoSql, sqlPreviaLayout } from './sql.js'
import { PADRAO } from '../visual.js'
import { TOTAL_LUGARES, LUGARES } from '../planta/lugares.js'

const SUPABASE_FALSO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create schema extensions;
  grant usage on schema auth, extensions, public to anon, authenticated;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
`

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const visual = { ...PADRAO }
let db: PGlite

async function como(papel: 'anon' | 'authenticated', uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${papel}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
const sentar = (uid: string | null, lugar: string, apelido: string, v: unknown = visual) =>
  como('authenticated', uid, 'select public.escritorio_sentar($1, $2, $3::jsonb) as r', [lugar, apelido, JSON.stringify(v)])
const erroDe = async (p: Promise<unknown>) => {
  try { await p } catch (e) { return (e as Error).message }
  return 'sem erro'
}

beforeAll(async () => {
  db = new PGlite({ extensions: { unaccent } })
  await db.exec(SUPABASE_FALSO)
  await db.exec(gerarSql())
}, 60000)

describe('arquivo SQL', () => {
  test('os arquivos de supabase/ estão em dia com a planta', () => {
    const ler = (nome: string) => readFileSync(new URL(`../../../../../supabase/${nome}`, import.meta.url), 'utf8')
    expect(ler('escritorio.sql')).toBe(gerarSql())
    expect(ler('escritorio-backup-copiar.sql')).toBe(gerarSqlBackupCopiar())
    expect(ler('escritorio-backup-restaurar.sql')).toBe(gerarSqlBackupRestaurar())
  })

  test('a prévia de layout lê de volta as cadeiras publicadas', () => {
    expect(cadeirasDoSql(gerarSql())).toEqual(LUGARES.map(l => l.id))
  })

  test('a conferência do final diz "tudo certo"', async () => {
    const r = await db.query<{ conferencia: string }>(gerarSql().slice(gerarSql().lastIndexOf('select case')))
    expect(r.rows[0].conferencia).toMatch(/^tudo certo: 511 cadeiras, 15 fixos/)
  })

  test('rodar de novo não apaga ninguém', async () => {
    await sentar(A, 'sul-1-L-1', 'Repetido')
    await db.exec(gerarSql())
    const r = await db.query<{ n: number }>(`select count(*)::int as n from public.escritorio_personagens where apelido = 'Repetido'`)
    expect(r.rows[0].n).toBe(1)
  })
})

describe('leitura pública', () => {
  test('qualquer um vê as cadeiras e os personagens', async () => {
    const l = await como('anon', null, 'select count(*)::int as n from public.escritorio_lugares where ativo')
    expect((l.rows[0] as { n: number }).n).toBe(TOTAL_LUGARES)
    const p = await como('anon', null, 'select apelido, lugar from public.escritorio_personagens where fixo order by apelido')
    expect(p.rows).toHaveLength(15)
  })

  test('ninguém vê quem é dono de quem', async () => {
    expect(await erroDe(como('anon', null, 'select * from public.escritorio_donos'))).toMatch(/permission denied/)
    expect(await erroDe(como('authenticated', A, 'select * from public.escritorio_donos'))).toMatch(/permission denied/)
  })

  test('ninguém grava direto nas tabelas', async () => {
    expect(await erroDe(como('authenticated', A, `insert into public.escritorio_personagens (apelido, apelido_chave, lugar) values ('x','x','sul-3-L-1')`))).toMatch(/permission denied/)
    expect(await erroDe(como('authenticated', A, `update public.escritorio_personagens set apelido = 'hack'`))).toMatch(/permission denied/)
    expect(await erroDe(como('authenticated', A, `delete from public.escritorio_personagens`))).toMatch(/permission denied/)
  })
})

describe('sentar', () => {
  test('sem login não senta', async () => {
    expect(await erroDe(como('anon', null, `select public.escritorio_sentar('sul-2-L-1', 'Oi', '{}'::jsonb)`))).toMatch(/permission denied/)
    expect(await erroDe(sentar(null, 'sul-2-L-1', 'Oi'))).toBe('sem_sessao')
  })

  test('senta, aparece para todos e o meu() devolve o personagem', async () => {
    await sentar(B, 'centro-1-O-1', '  Bia  ')
    const meu = await como('authenticated', B, 'select public.escritorio_meu() as m')
    expect((meu.rows[0] as { m: { lugar: string; apelido: string } }).m).toMatchObject({ lugar: 'centro-1-O-1', apelido: 'Bia' })
    const todos = await como('anon', null, `select apelido from public.escritorio_personagens where lugar = 'centro-1-O-1'`)
    expect(todos.rows).toEqual([{ apelido: 'Bia' }])
  })

  test('sentar de novo muda de cadeira: um personagem por pessoa, e a cadeira antiga fica livre', async () => {
    await sentar(B, 'centro-1-O-2', 'Bia')
    const meus = await db.query<{ n: number }>(`select count(*)::int as n from public.escritorio_personagens where apelido = 'Bia'`)
    expect(meus.rows[0].n).toBe(1)
    await sentar(A, 'centro-1-O-1', 'Repetido')
    const r = await db.query(`select apelido from public.escritorio_personagens where lugar = 'centro-1-O-1'`)
    expect(r.rows).toEqual([{ apelido: 'Repetido' }])
  })

  test('cadeira ocupada ou de personagem fixo não pode', async () => {
    expect(await erroDe(sentar(A, 'centro-1-O-2', 'Repetido'))).toBe('lugar_ocupado')
    expect(await erroDe(sentar(A, 'nordeste-2-L-3', 'Repetido'))).toBe('lugar_ocupado')
  })

  test('apelido repetido não pode, nem com acento, maiúscula ou espaço', async () => {
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'BIA'))).toBe('apelido_em_uso')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'líka'))).toBe('apelido_em_uso')
    expect(await erroDe(sentar(A, 'sul-5-L-1', ' joao '))).toBe('apelido_em_uso')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'sem   SANGUE'))).toBe('apelido_em_uso')
  })

  test('cadeira que não existe, visual fora do catálogo e apelido vazio ou longo não passam', async () => {
    expect(await erroDe(sentar(A, 'sul-99-L-1', 'Repetido'))).toBe('lugar_invalido')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'Repetido', { ...visual, camisa: 'red' }))).toBe('visual_invalido')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'Repetido', { ...visual, extra: 1 }))).toBe('visual_invalido')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'Repetido', [1, 2]))).toBe('visual_invalido')
    expect(await erroDe(sentar(A, 'sul-5-L-1', '​‮'))).toBe('apelido_invalido')
    expect(await erroDe(sentar(A, 'sul-5-L-1', 'x'.repeat(19)))).toBe('apelido_invalido')
  })

  test('caracteres invisíveis somem do apelido', async () => {
    const r = await sentar(A, 'sul-5-L-1', 'Re​pe\ttido 2')
    expect((r.rows[0] as { r: { apelido: string } }).r.apelido).toBe('Repe tido 2')
  })
})

describe('mudança de layout', () => {
  test('cadeira que sai do layout fica inativa e o personagem continua salvo', async () => {
    await db.exec(`insert into public.escritorio_lugares (id, zona) values ('teste-1-N-1', 'sul')`)
    await sentar(B, 'teste-1-N-1', 'Bia')
    await db.exec(gerarSql())
    const l = await db.query(`select ativo from public.escritorio_lugares where id = 'teste-1-N-1'`)
    expect(l.rows).toEqual([{ ativo: false }])
    const p = await db.query(`select lugar from public.escritorio_personagens where apelido = 'Bia'`)
    expect(p.rows).toEqual([{ lugar: 'teste-1-N-1' }])
    expect(await erroDe(sentar(A, 'teste-1-N-1', 'Outro'))).toBe('lugar_invalido')
  })
})

describe('tempo real', () => {
  test('a tabela de personagens está na publicação do Supabase', async () => {
    const r = await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)
    expect(r.rows).toEqual([{ tablename: 'escritorio_personagens' }])
  })
})

const C = '33333333-3333-3333-3333-333333333333'
const D = '44444444-4444-4444-4444-444444444444'
const E = '55555555-5555-5555-5555-555555555555'
const meu = async (uid: string) =>
  (await como('authenticated', uid, 'select public.escritorio_meu() as m')).rows[0] as { m: { lugar: string; apelido: string } | null }
const linha = async (apelido: string) =>
  (await db.query<{ lugar: string | null; dono: string | null }>(
    `select p.lugar, d.dono from public.escritorio_personagens p left join public.escritorio_donos d on d.personagem = p.id where p.apelido = $1`, [apelido])).rows

describe('excluir o próprio personagem', () => {
  test('sem login não exclui', async () => {
    expect(await erroDe(como('anon', null, 'select public.escritorio_sair()'))).toMatch(/permission denied/)
    expect(await erroDe(como('authenticated', null, 'select public.escritorio_sair()'))).toBe('sem_sessao')
  })

  test('exclui só o meu: cadeira e apelido ficam livres, os outros continuam', async () => {
    await sentar(C, 'sul-7-L-1', 'Cacá')
    await sentar(D, 'sul-7-L-2', 'Dedé')
    const r = await como('authenticated', C, 'select public.escritorio_sair() as r')
    expect((r.rows[0] as { r: boolean }).r).toBe(true)
    expect(await linha('Cacá')).toEqual([])
    expect((await meu(C)).m).toBeNull()
    expect(await linha('Dedé')).toEqual([{ lugar: 'sul-7-L-2', dono: D }])
    /* outra pessoa pode usar o apelido e a cadeira; quem saiu pode voltar */
    await sentar(E, 'sul-7-L-1', 'cacá')
    await sentar(C, 'sul-7-L-3', 'Cacá de volta')
    expect((await meu(C)).m).toMatchObject({ lugar: 'sul-7-L-3', apelido: 'Cacá de volta' })
  })

  test('quem não tem personagem não apaga nada; fixo nunca sai', async () => {
    const r = await como('authenticated', '66666666-6666-6666-6666-666666666666', 'select public.escritorio_sair() as r')
    expect((r.rows[0] as { r: boolean }).r).toBe(false)
    const fixos = await db.query<{ n: number }>('select count(*)::int as n from public.escritorio_personagens where fixo')
    expect(fixos.rows[0].n).toBe(15)
  })
})

describe('mudança de layout com cadeira de fixo ocupada', () => {
  test('o SQL para com o nome de quem está lá e não muda nada', async () => {
    /* imita um layout em que a cadeira do Gabi ficou com um visitante */
    await db.exec(`update public.escritorio_personagens set lugar = null where apelido = 'Gabi'`)
    await db.exec(`update public.escritorio_personagens set lugar = 'leste-1-N-1' where apelido = 'Dedé'`)
    await db.exec('drop function public.escritorio_sair()')
    const msg = await erroDe(db.exec(gerarSql()))
    expect(msg).toMatch(/parei sem mudar nada/)
    expect(msg).toMatch(/leste-1-N-1 \(do fixo Gabi\) está com Dedé/)
    /* a função recriada lá no começo do script também foi desfeita */
    const f = await db.query(`select 1 from pg_proc where proname = 'escritorio_sair'`)
    expect(f.rows).toEqual([])
    expect(await linha('Gabi')).toEqual([{ lugar: null, dono: null }])
    /* a prévia de layout aponta o problema antes */
    const previa = await db.query<{ situacao: string; apelido: string }>(sqlPreviaLayout([]))
    expect(previa.rows).toEqual([expect.objectContaining({ apelido: 'Dedé', situacao: expect.stringMatching(/ATENÇÃO/) })])
    /* arrumando, roda de novo e tudo volta */
    await db.exec(`update public.escritorio_personagens set lugar = 'sul-7-L-2' where apelido = 'Dedé'`)
    await db.exec(gerarSql())
    expect(await linha('Gabi')).toEqual([{ lugar: 'leste-1-N-1', dono: null }])
  })
})

describe('backup', () => {
  const copiar = async () => (await db.query<{ copia: string }>(gerarSqlBackupCopiar())).rows[0].copia
  const restaurar = async (copia: string) => {
    const r = await db.exec(gerarSqlBackupRestaurar().replace(MARCA_COLAR, copia))
    return Object.fromEntries(r[r.length - 1].rows.map((x: any) => [x.situacao, x.apelidos]))
  }

  test('copiar só lê e não leva os fixos', async () => {
    const j = JSON.parse(await copiar())
    expect(j.tipo).toBe('escritorio-backup')
    expect(j.personagens.some((p: any) => p.apelido === 'Dedé')).toBe(true)
    expect(j.personagens.some((p: any) => p.apelido === 'Gabi')).toBe(false)
    expect(j.donos.length).toBe(j.personagens.length)
  })

  test('apagou sem querer: restaura com cadeira e dono; rodar de novo não duplica', async () => {
    const copia = await copiar()
    const antes = (await db.query('select count(*)::int as n from public.escritorio_personagens')).rows
    await db.exec(`delete from public.escritorio_personagens where apelido in ('Dedé', 'Cacá de volta')`)
    const r = await restaurar(copia)
    expect(r['voltou para a cadeira dele']).toBe('Cacá de volta, Dedé')
    expect(await linha('Dedé')).toEqual([{ lugar: 'sul-7-L-2', dono: D }])
    expect((await meu(C)).m).toMatchObject({ apelido: 'Cacá de volta' })
    expect((await db.query('select count(*)::int as n from public.escritorio_personagens')).rows).toEqual(antes)
    const r2 = await restaurar(copia)
    expect(Object.keys(r2)).toEqual(['já estava no banco'])
    expect((await db.query('select count(*)::int as n from public.escritorio_personagens')).rows).toEqual(antes)
  })

  test('cadeira tomada volta sem cadeira; apelido tomado é pulado; navegador com outro personagem fica sem dono', async () => {
    const copia = await copiar()
    await db.exec(`delete from public.escritorio_personagens where apelido in ('Dedé', 'Cacá de volta')`)
    await sentar('77777777-7777-7777-7777-777777777777', 'sul-7-L-2', 'Intruso')     /* cadeira do Dedé */
    await sentar('88888888-8888-8888-8888-888888888888', 'sul-8-L-1', 'cacá de volta') /* apelido do C */
    await sentar(D, 'sul-8-L-2', 'Dedé 2')                                            /* o D criou outro */
    const r = await restaurar(copia)
    expect(r['voltou sem cadeira (escolhe outra ao abrir o site)']).toBe('Dedé')
    expect(r['pulado: apelido já é de outro personagem']).toBe('Cacá de volta')
    expect(r['voltou, mas sem dono (o navegador dele já tem outro personagem)']).toBe('Dedé')
    expect(await linha('Dedé')).toEqual([{ lugar: null, dono: null }])
    expect((await meu(D)).m).toMatchObject({ apelido: 'Dedé 2' })
  })

  test('sem colar a cópia (ou colando outra coisa): para sem mudar nada', async () => {
    expect(await erroDe(db.exec(gerarSqlBackupRestaurar()))).toMatch(/parei sem mudar nada/)
    expect(await erroDe(db.exec(gerarSqlBackupRestaurar().replace(MARCA_COLAR, '{"oi": 1}')))).toMatch(/não é uma cópia do escritório/)
  })
})
