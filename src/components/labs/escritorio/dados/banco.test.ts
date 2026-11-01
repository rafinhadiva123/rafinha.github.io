import { describe, expect, test, vi } from 'vitest'
import { criarBancoSupabase, criarBancoLocal, sanearLinhas, MENSAGENS } from './banco.js'
import { PADRAO } from '../visual.js'

/* um Supabase de mentira, com o mesmo formato de resposta do de verdade */
function clienteFalso({ linhas = [] as unknown[], sessao = false, erroRpc = null as null | string, erroLogin = null as null | number, meu = null as unknown } = {}) {
  const chamadas: string[] = []
  const cliente = {
    auth: {
      getSession: async () => ({ data: { session: sessao ? {} : null } }),
      signInAnonymously: async () => {
        chamadas.push('login')
        if (erroLogin) return { error: { status: erroLogin } }
        sessao = true
        return { error: null }
      },
    },
    from: () => ({ select: () => ({ not: async () => ({ data: linhas, error: null }) }) }),
    rpc: async (nome: string, args: { p_apelido: string }) => {
      chamadas.push(nome)
      if (erroRpc) return { data: null, error: { message: erroRpc } }
      return { data: nome === 'escritorio_sentar' ? { apelido: args.p_apelido } : nome === 'escritorio_meu' ? meu : null, error: null }
    },
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: vi.fn(),
  }
  return { cliente, chamadas }
}

describe('lista vinda do banco', () => {
  test('descarta fixos, cadeira inexistente, repetida e apelido vazio; limpa o visual', () => {
    const l = sanearLinhas([
      { lugar: 'sul-1-L-1', apelido: 'Ana', visual: { camisa: 'red' } },
      { lugar: 'sul-1-L-1', apelido: 'Outra', visual: {} },
      { lugar: 'nordeste-2-L-3', apelido: 'Lika', fixo: true },
      { lugar: 'sul-99-L-1', apelido: 'X', visual: {} },
      { lugar: 'sul-1-L-2', apelido: '​', visual: {} },
      null,
    ])
    expect(l).toEqual([{ lugar: 'sul-1-L-1', apelido: 'Ana', visual: PADRAO }])
  })
})

describe('banco online', () => {
  test('quem só olha não cria login; o login acontece na hora de sentar', async () => {
    const { cliente, chamadas } = clienteFalso()
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente })
    await b.listar()
    expect(await b.meu()).toBe(null)
    expect(chamadas).toEqual([])
    await b.sentar('sul-1-L-1', 'Ana', PADRAO)
    expect(chamadas).toEqual(['login', 'escritorio_sentar'])
  })

  test('confere na hora: apelido reservado e cadeira ocupada nem vão para o banco', async () => {
    const { cliente, chamadas } = clienteFalso({ linhas: [{ lugar: 'sul-1-L-1', apelido: 'Ana', visual: {} }] })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente })
    await b.listar()
    await expect(b.sentar('sul-1-L-2', 'LÍKA', PADRAO)).rejects.toMatchObject({ codigo: 'apelido_em_uso' })
    await expect(b.sentar('sul-1-L-1', 'Bia', PADRAO)).rejects.toMatchObject({ codigo: 'lugar_ocupado' })
    await expect(b.sentar('sul-1-L-2', 'ana', PADRAO)).rejects.toMatchObject({ codigo: 'apelido_em_uso' })
    await expect(b.sentar('sul-1-L-2', '   ', PADRAO)).rejects.toMatchObject({ codigo: 'apelido_invalido' })
    expect(chamadas).toEqual([])
  })

  test('o dono edita o próprio personagem sem sair da cadeira, várias vezes seguidas', async () => {
    const ana = { lugar: 'sul-1-L-1', apelido: 'Ana', visual: PADRAO }
    const { cliente, chamadas } = clienteFalso({ sessao: true, linhas: [ana], meu: ana })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente })
    await b.listar()
    await b.meu()
    const novo = { ...PADRAO, oculos: 'redondo' }
    expect(await b.sentar('sul-1-L-1', 'Ana Luiza', novo)).toEqual({ lugar: 'sul-1-L-1', apelido: 'Ana Luiza', visual: novo })
    /* a lista ainda não chegou de novo: não pode esbarrar no apelido antigo */
    expect(await b.sentar('sul-1-L-1', 'ANA', PADRAO)).toMatchObject({ apelido: 'ANA' })
    expect(chamadas).toEqual(['escritorio_meu', 'escritorio_sentar', 'escritorio_sentar'])
  })

  test('erro do banco vira mensagem em português', async () => {
    const { cliente } = clienteFalso({ sessao: true, erroRpc: 'lugar_ocupado' })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).rejects.toMatchObject({ codigo: 'lugar_ocupado', message: MENSAGENS.lugar_ocupado })
  })

  test('excluir: chama escritorio_sair só quando há sessão; erro vira português', async () => {
    const semLogin = clienteFalso()
    expect(await criarBancoSupabase({ url: '', chave: '' }, { cliente: semLogin.cliente }).sair()).toBe(false)
    expect(semLogin.chamadas).toEqual([])
    const comLogin = clienteFalso({ sessao: true })
    await criarBancoSupabase({ url: '', chave: '' }, { cliente: comLogin.cliente }).sair()
    expect(comLogin.chamadas).toEqual(['escritorio_sair'])
    const caiu = clienteFalso({ sessao: true, erroRpc: 'qualquer coisa' })
    await expect(criarBancoSupabase({ url: '', chave: '' }, { cliente: caiu.cliente }).sair()).rejects.toMatchObject({ codigo: 'rede' })
  })

  test('limite de logins vira aviso de muita gente entrando', async () => {
    const { cliente } = clienteFalso({ erroLogin: 429 })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).rejects.toMatchObject({ codigo: 'muitos' })
  })
})

describe('banco local', () => {
  test('um personagem por navegador: sentar de novo muda de cadeira', async () => {
    const mem = new Map<string, string>()
    const armazenamento = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const b = criarBancoLocal(armazenamento)
    let avisos = 0
    b.aoMudar(() => avisos++)
    await b.sentar('sul-1-L-1', 'Ana', PADRAO)
    await b.sentar('sul-1-L-2', 'Ana', PADRAO)
    expect(await b.listar()).toEqual([{ lugar: 'sul-1-L-2', apelido: 'Ana', visual: PADRAO }])
    expect(await b.meu()).toMatchObject({ lugar: 'sul-1-L-2' })
    expect(avisos).toBe(2)
  })

  test('o dono edita apelido e visual na mesma cadeira', async () => {
    const mem = new Map<string, string>()
    const armazenamento = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const b = criarBancoLocal(armazenamento)
    const novo = { ...PADRAO, oculos: 'redondo' }
    await b.sentar('sul-1-L-1', 'Ana', PADRAO)
    await b.sentar('sul-1-L-1', 'Ana Luiza', novo)
    expect(await b.listar()).toEqual([{ lugar: 'sul-1-L-1', apelido: 'Ana Luiza', visual: novo }])
    expect(await b.meu()).toMatchObject({ apelido: 'Ana Luiza', visual: novo })
  })

  test('excluir tira o meu personagem e libera o apelido', async () => {
    const mem = new Map<string, string>()
    const armazenamento = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const b = criarBancoLocal(armazenamento)
    await b.sentar('sul-1-L-1', 'Ana', PADRAO)
    expect(await b.sair()).toBe(true)
    expect(await b.listar()).toEqual([])
    expect(await b.meu()).toBeNull()
    expect(await b.sair()).toBe(false)
  })
})
