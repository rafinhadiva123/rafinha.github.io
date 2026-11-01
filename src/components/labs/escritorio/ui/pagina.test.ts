import { describe, expect, test, vi } from 'vitest'
import { escolherVersao } from './capacidade.js'
import { fraseChegada, criarNucleo } from './nucleo.js'
import { vizinhaNaDirecao, escolherRotulos, caixaDoRotulo, descreverCadeira, rotuloCurto, LIMITES } from './planta2d.js'
import { criarBancoSupabase, criarBancoLocal, MENSAGENS } from '../dados/banco.js'
import { LUGAR, LUGARES } from '../planta/lugares.js'
import { FIXOS } from '../planta/fixos.js'
import { PADRAO } from '../visual.js'

describe('3D ou planta', () => {
  const ok = { ok: true, lento: false }
  test('aparelho bom abre o 3D', () => {
    expect(escolherVersao({ webgl: ok, memoria: 8, nucleos: 8 })).toEqual({ versao: '3d', motivo: null })
  })
  test('sem WebGL abre a planta, mesmo pedindo ?3d ou tendo escolhido o 3D antes', () => {
    const sem = { ok: false, lento: false }
    expect(escolherVersao({ webgl: sem })).toEqual({ versao: 'planta', motivo: 'sem-webgl' })
    expect(escolherVersao({ webgl: sem, busca: '?3d', preferencia: '3d' }).versao).toBe('planta')
  })
  test('aparelho fraco ou economia de dados abre a planta', () => {
    expect(escolherVersao({ webgl: { ok: true, lento: true } }).motivo).toBe('fraco')
    expect(escolherVersao({ webgl: ok, memoria: 2 }).motivo).toBe('fraco')
    expect(escolherVersao({ webgl: ok, nucleos: 2 }).motivo).toBe('fraco')
    expect(escolherVersao({ webgl: ok, economia: true }).motivo).toBe('economia')
  })
  test('a escolha da pessoa e o endereço vencem a detecção', () => {
    expect(escolherVersao({ webgl: { ok: true, lento: true }, preferencia: '3d' })).toEqual({ versao: '3d', motivo: null })
    expect(escolherVersao({ webgl: ok, preferencia: 'planta' }).versao).toBe('planta')
    expect(escolherVersao({ webgl: ok, busca: '?planta' }).versao).toBe('planta')
    expect(escolherVersao({ webgl: { ok: true, lento: true }, busca: '?local&3d' }).versao).toBe('3d')
  })
})

describe('aviso de quem chegou', () => {
  const v = (apelido: string) => ({ apelido, lugar: 'x' })
  test('uma, duas ou muitas pessoas; a própria pessoa não conta', () => {
    expect(fraseChegada([], [v('Ana')])).toBe('Ana acabou de sentar.')
    expect(fraseChegada([v('Ana')], [v('Ana'), v('Bia'), v('Caio')])).toBe('Bia e Caio acabaram de sentar.')
    expect(fraseChegada([], [v('A'), v('B'), v('C')])).toBe('3 pessoas acabaram de sentar.')
    expect(fraseChegada([], [v('Eu')], 'Eu')).toBe(null)
    expect(fraseChegada([v('Ana')], [])).toBe(null)
  })
})

describe('sentar numa cadeira livre (caminho do teclado)', () => {
  function telaMinima() {
    const editores: any[] = []
    const ui = {
      montarCamadas: () => ({ camada: {}, busca: {}, editor: {}, aviso: { textContent: '', hidden: true }, carga: { hidden: true }, cargaTexto: {} }),
      criarAndar: () => ({ definirOcupantes: vi.fn(), selecionar: vi.fn(), focar: vi.fn(), olharPara: vi.fn(), marcar: vi.fn() }),
      criarMais: () => ({ ligar() {}, atualizar() {}, parar() {} }),
      criarPasseio: () => ({ ativo: false, sair() {} }),
      criarPiadas: () => ({ parar() {} }),
      criarBusca: () => ({}),
      abrirEditor: (_r: unknown, o: any) => { const e = { ...o, fechar: vi.fn() }; editores.push(e); return e },
    }
    return { ui, editores }
  }
  test('abre o editor numa cadeira que não é de ninguém', async () => {
    const { ui, editores } = telaMinima()
    const n = criarNucleo({} as any, null, { ui, aleatorio: () => 0.5 })
    await n.pronto
    const lugar = n.sentarEmLivre()
    expect(lugar).toBeTruthy()
    expect(FIXOS.some(f => f.lugar === lugar)).toBe(false)
    expect(editores.at(-1).lugar).toBe(lugar)
    n.parar()
  })
  test('quem já sentou abre o próprio personagem, na cadeira dele', async () => {
    const { ui, editores } = telaMinima()
    const eu = { lugar: 'sul-1-L-1', apelido: 'Ana', visual: PADRAO }
    const banco = { modo: 'falso', meu: async () => eu, listar: async () => [eu], aoMudar: () => () => {}, sentar: async () => eu }
    const n = criarNucleo({} as any, banco, { ui })
    await n.pronto
    expect(n.sentarEmLivre()).toBe('sul-1-L-1')
    expect(editores.at(-1)).toMatchObject({ lugar: 'sul-1-L-1', meu: eu })
    n.parar()
  })
  test('lotado: avisa e não abre nada', async () => {
    const { ui, editores } = telaMinima()
    const cheio = { modo: 'falso', meu: async () => null, aoMudar: () => () => {}, sentar: async () => ({}),
      listar: async () => LUGARES.filter(l => !FIXOS.some(f => f.lugar === l.id)).map((l, k) => ({ lugar: l.id, apelido: `P${k}`, visual: PADRAO })) }
    const n = criarNucleo({} as any, cheio, { ui })
    await n.pronto
    expect(n.sentarEmLivre()).toBe(null)
    expect(editores.length).toBe(0)
    n.parar()
  })
})

describe('planta sem 3D', () => {
  test('a planta cabe a recepção, o andar e todas as cadeiras', () => {
    for (const l of LUGARES) {
      expect(l.x).toBeGreaterThan(LIMITES.x0); expect(l.x).toBeLessThan(LIMITES.x1)
      expect(l.z).toBeGreaterThan(LIMITES.z0); expect(l.z).toBeLessThan(LIMITES.z1)
    }
  })
  test('setas: vai para a cadeira vizinha naquela direção', () => {
    /* leste-1-N-1 → à direita é a N-2; para baixo, atravessa a bancada até a S-1 */
    expect(vizinhaNaDirecao('leste-1-N-1', 1, 0)).toBe('leste-1-N-2')
    expect(vizinhaNaDirecao('leste-1-N-1', 0, 1)).toBe('leste-1-S-1')
    expect(vizinhaNaDirecao('leste-1-N-2', -1, 0)).toBe('leste-1-N-1')
    /* todas as cadeiras são alcançáveis de algum vizinho */
    const alcancadas = new Set<string>()
    for (const l of LUGARES) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const v = vizinhaNaDirecao(l.id, dx, dz); if (v) alcancadas.add(v)
    }
    expect(alcancadas.size).toBe(LUGARES.length)
  })
  test('nomes escritos não se cobrem nem cobrem outra pessoa, mesmo com o escritório cheio', () => {
    const itens = LUGARES.map((l, k) => ({ id: l.id, texto: rotuloCurto(`Pessoa número ${k}`) }))
    const sim = escolherRotulos(itens)
    expect(sim.size).toBeGreaterThan(100)
    const caixas = itens.filter(i => sim.has(i.id)).map(i => caixaDoRotulo(LUGAR.get(i.id), i.texto))
    for (let a = 0; a < caixas.length; a++) for (let b = a + 1; b < caixas.length; b++) {
      const [p, q] = [caixas[a], caixas[b]]
      expect(p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]).toBe(false)
    }
  })
  test('com o escritório como hoje, os 15 aparecem com o nome escrito', () => {
    const sim = escolherRotulos(FIXOS.map(f => ({ id: f.lugar, texto: rotuloCurto(f.apelido) })))
    expect(sim.size).toBe(15)
  })
  test('leitor de tela: quem está, ou cadeira livre perto de quem', () => {
    const mapa = new Map<string, any>([['leste-1-N-1', { apelido: 'Gabi' }]])
    expect(descreverCadeira('leste-1-N-1', mapa.get('leste-1-N-1'), mapa)).toBe('Gabi')
    expect(descreverCadeira('leste-1-N-2', null, mapa)).toMatch(/^Cadeira livre, perto de Gabi\./)
    expect(descreverCadeira('recepcao-1', null, new Map())).toBe('Cadeira livre na Recepção. Enter para sentar.')
    expect(rotuloCurto('Apelidocomprido')).toBe('Apelidoco…')
  })
})

describe('banco online: erros sempre em português', () => {
  function cliente(rpc: (n: string) => Promise<any>, extra: any = {}) {
    let sessao = true
    return {
      auth: {
        getSession: async () => ({ data: { session: sessao ? {} : null } }),
        signInAnonymously: async () => { sessao = true; return { error: null } },
        refreshSession: vi.fn(async () => ({ error: null })),
        ...extra,
      },
      from: () => ({ select: () => ({ not: async () => ({ data: [], error: null }) }) }),
      rpc,
      channel: () => ({ on() { return this }, subscribe() { return this } }),
      removeChannel: vi.fn(),
    }
  }
  test('rede caiu no meio (exceção em inglês) vira mensagem de rede', async () => {
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente: cliente(async () => { throw new TypeError('Failed to fetch') }) as any })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).rejects.toMatchObject({ codigo: 'rede', message: MENSAGENS.rede })
  })
  test('banco pendurado: desiste e avisa', async () => {
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente: cliente(() => new Promise(() => {})) as any, tempoLimite: 20 })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).rejects.toMatchObject({ codigo: 'rede' })
  })
  test('sessão vencida: renova e tenta de novo, sem criar outro login', async () => {
    let n = 0
    const c = cliente(async () => (n++ === 0 ? { data: null, error: { message: 'JWT expired', code: 'PGRST301' } } : { data: { apelido: 'Ana' }, error: null }))
    const login = vi.spyOn(c.auth, 'signInAnonymously')
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente: c as any })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).resolves.toMatchObject({ apelido: 'Ana' })
    expect(c.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(login).not.toHaveBeenCalled()
  })
  test('sessão que não renova vira "não deu para entrar"', async () => {
    const c = cliente(async () => ({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } }), { refreshSession: async () => ({ error: { message: 'x' } }) })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente: c as any })
    await expect(b.sentar('sul-1-L-1', 'Ana', PADRAO)).rejects.toMatchObject({ codigo: 'sem_sessao' })
  })
  test('canal ao vivo (re)conectado: lê a lista de novo', async () => {
    vi.useFakeTimers()
    let aoEstado: (s: string) => void = () => {}
    const c: any = cliente(async () => ({}))
    c.channel = () => ({ on() { return this }, subscribe(fn: any) { aoEstado = fn; return this } })
    const b = criarBancoSupabase({ url: '', chave: '' }, { cliente: c })
    const fn = vi.fn()
    b.aoMudar(fn)
    aoEstado('SUBSCRIBED'); vi.advanceTimersByTime(300)
    aoEstado('CHANNEL_ERROR'); vi.advanceTimersByTime(300)
    aoEstado('SUBSCRIBED'); vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})

describe('banco local', () => {
  test('outra aba sentou (evento storage): avisa', () => {
    const ouvintes: Record<string, (e: any) => void> = {}
    vi.stubGlobal('window', { addEventListener: (t: string, f: any) => { ouvintes[t] = f }, removeEventListener: (t: string) => { delete ouvintes[t] } })
    const mem = new Map<string, string>()
    const b = criarBancoLocal({ getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as any)
    const fn = vi.fn()
    const parar = b.aoMudar(fn)
    ouvintes.storage({ key: 'outra-coisa' })
    ouvintes.storage({ key: 'escritorio:local' })
    expect(fn).toHaveBeenCalledTimes(1)
    parar()
    expect(ouvintes.storage).toBeUndefined()
    vi.unstubAllGlobals()
  })
})

