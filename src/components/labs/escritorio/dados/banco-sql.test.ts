// Testa o SQL do banco num Postgres de verdade (PGlite), imitando o que o
// Supabase tem: papéis anon/authenticated, auth.uid() e a publicação do
// tempo real. Cada teste age como um visitante diferente.
import { beforeAll, describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { gerarSql } from './sql.js'
import { PADRAO } from '../visual.js'
import { TOTAL_LUGARES } from '../planta/lugares.js'

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
  test('supabase/escritorio.sql está em dia com a planta', () => {
    const arquivo = readFileSync(new URL('../../../../../supabase/escritorio.sql', import.meta.url), 'utf8')
    expect(arquivo).toBe(gerarSql())
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
