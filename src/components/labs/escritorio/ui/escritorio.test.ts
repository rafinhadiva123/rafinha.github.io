import { describe, expect, test, vi } from 'vitest'
import { criarEscritorio, montarOcupantes, MSG_CARGA, MSG_CONFLITO } from './escritorio.js'
import { ErroBanco, MENSAGENS } from '../dados/banco.js'
import { FIXOS, chaveApelido, APELIDOS_RESERVADOS } from '../planta/fixos.js'
import { LUGARES } from '../planta/lugares.js'
import { sanearVisual } from '../visual.js'

const visual = sanearVisual({})
const flush = () => new Promise(r => setTimeout(r, 0))
/* uma cadeira que não é de fixo; n = 0, 1, 2… */
const lugarLivre = (n = 0) => LUGARES.filter(l => !FIXOS.some(f => f.lugar === l.id))[n].id

/** Banco falso com as mesmas regras do banco real (dados/banco.js). */
function bancoFalso(iniciais: { lugar: string; apelido: string }[] = []) {
  let lista: any[] = iniciais.map(p => ({ visual, ...p }))
  let eu: any = null
  let caiu: Error | null = null
  const ouvintes = new Set<() => void>()
  const avisar = () => ouvintes.forEach(f => f())
  return {
    modo: 'falso',
    quebrar(on: boolean) { caiu = on ? new Error('rede') : null },
    ver: () => lista.map(p => ({ ...p })),
    /* alguém sentou sem a gente ver: dispara o aoMudar */
    alguemSenta(lugar: string, apelido: string) { lista = lista.concat({ lugar, apelido, visual }); avisar() },
    async listar() { if (caiu) throw caiu; return lista.map(p => ({ ...p })) },
    async meu() { return eu ? { ...eu } : null },
    async sentar(lugar: string, apelido: string, vis: unknown) {
      if (caiu) throw caiu
      const ch = chaveApelido(apelido)
      if (APELIDOS_RESERVADOS.has(ch)) throw new ErroBanco('apelido_em_uso', MENSAGENS.apelido_em_uso)
      if (FIXOS.some(f => f.lugar === lugar)) throw new ErroBanco('lugar_invalido', MENSAGENS.lugar_invalido)
      if (lista.some(p => p.lugar === lugar && p.apelido !== eu?.apelido)) throw new ErroBanco('lugar_ocupado', MENSAGENS.lugar_ocupado)
      if (lista.some(p => chaveApelido(p.apelido) === ch && p.apelido !== eu?.apelido)) throw new ErroBanco('apelido_em_uso', MENSAGENS.apelido_em_uso)
      const novo = { lugar, apelido, visual: vis }
      lista = lista.filter(p => p.apelido !== eu?.apelido).concat(novo)
      eu = novo
      avisar()
      return { ...novo }
    },
    aoMudar(fn: () => void) { ouvintes.add(fn); return () => ouvintes.delete(fn) },
  }
}

/** Tela falsa: registra o que o controlador pede, sem desenhar nada. */
function telaFalsa() {
  const tela: any = {
    mapas: [] as Map<string, any>[],
    editores: [] as any[],
    aviso: { textContent: '', hidden: true },
    carga: { hidden: true },
    cargaTexto: { textContent: '' },
    passeio: { ativo: false, sair: vi.fn(() => { tela.passeio.ativo = false }) },
    andar: {
      definirOcupantes: vi.fn((m: Map<string, any>) => { tela.mapas.push(m) }),
      selecionar: vi.fn(), focar: vi.fn(), olharPara: vi.fn(), marcar: vi.fn(),
    },
    mais: null as any,
    ui: {} as any,
  }
  tela.ui = {
    criarAndar: () => tela.andar,
    montarCamadas: (_p: unknown, { tentarDeNovo }: { tentarDeNovo: () => unknown }) => {
      tela.tentar = tentarDeNovo
      return { camada: {}, busca: {}, editor: {}, aviso: tela.aviso, carga: tela.carga, cargaTexto: tela.cargaTexto }
    },
    criarMais: (_c: unknown, _a: unknown, { ocupados, escolher }: { ocupados: () => Set<string>; escolher: (id: string) => void }) => {
      tela.ocupados = ocupados
      tela.escolher = escolher
      tela.mais = { ligar: vi.fn(), atualizar: vi.fn(), parar: vi.fn() }
      return tela.mais
    },
    criarBusca: (_r: unknown, { pessoas, ir }: { pessoas: () => unknown[]; ir: (p: any) => void }) => {
      tela.pessoas = pessoas
      tela.ir = ir
      return {}
    },
    criarPasseio: () => tela.passeio,
    criarPiadas: () => ({ parar: vi.fn() }),
    abrirEditor: (_raiz: unknown, opc: any) => {
      let aberto = true
      const ed = {
        opc,
        get aberto() { return aberto },
        fechar: vi.fn(() => { if (aberto) { aberto = false; opc.fechar() } }),
        mudou: (apelido: string, v: unknown) => opc.mudou(apelido, v),
        /* como o editor real: some quando salva; continua aberto e lança quando o banco recusa */
        salvar: async (apelido: string, v: unknown) => { await opc.salvar(apelido, v); aberto = false },
      }
      tela.editores.push(ed)
      return ed
    },
  }
  return tela
}

async function montar(banco: any) {
  const tela = telaFalsa()
  const ctrl = criarEscritorio({} as HTMLElement, banco, { ui: tela.ui })
  await ctrl.pronto
  return { ctrl, tela }
}

describe('quem ocupa cada cadeira', () => {
  test('sem visitantes, aparecem só os 15 fixos', () => {
    expect(FIXOS.length).toBe(15)
    expect(montarOcupantes().size).toBe(15)
  })

  test('a prévia do editor só ocupa cadeira livre', () => {
    const livre = lugarLivre(0)
    const m = montarOcupantes({ previa: { lugar: livre, apelido: 'Ana', visual } })
    expect(m.get(livre).apelido).toBe('Ana')
    const m2 = montarOcupantes({ previa: { lugar: 'leste-1-N-1', apelido: 'Ana', visual } })
    expect(m2.get('leste-1-N-1').apelido).toBe('Gabi')
  })
})

describe('controlador com banco falso', () => {
  test('começa com a planta e os visitantes do banco', async () => {
    const { tela } = await montar(bancoFalso([{ lugar: lugarLivre(0), apelido: 'Bia' }]))
    const ultimo = tela.mapas.at(-1)
    expect(ultimo.size).toBe(16)
    expect(ultimo.get(lugarLivre(0)).apelido).toBe('Bia')
    expect(tela.carga.hidden).toBe(true)
  })

  test('sentar pelo "+": salva, some o editor, mostra aviso e a cadeira fica ocupada', async () => {
    const banco = bancoFalso()
    const { ctrl, tela } = await montar(banco)
    const lugar = lugarLivre(0)
    tela.escolher(lugar)
    expect(tela.andar.olharPara).toHaveBeenCalledWith(lugar, 'direita')
    const ed = tela.editores.at(-1)
    expect(ctrl.aberto).toBe(true)

    await ed.salvar('Ana', visual)

    expect((await banco.listar()).find(p => p.apelido === 'Ana')?.lugar).toBe(lugar)
    expect(ed.aberto).toBe(false)
    expect(ctrl.aberto).toBe(false)
    expect(tela.aviso.textContent).toContain('Ana')
    expect(tela.mapas.at(-1).get(lugar).apelido).toBe('Ana')
    expect(tela.mais.ligar).toHaveBeenLastCalledWith(true)
  })

  test('mudar de cadeira com o mesmo personagem libera a antiga', async () => {
    const banco = bancoFalso()
    const { tela } = await montar(banco)
    const a = lugarLivre(0), b = lugarLivre(1)
    tela.escolher(a)
    await tela.editores.at(-1).salvar('Ana', visual)

    tela.escolher(b)
    const ed = tela.editores.at(-1)
    expect(ed.opc.meu.lugar).toBe(a)
    await ed.salvar('Ana', visual)

    const minhas = (await banco.listar()).filter(p => p.apelido === 'Ana')
    expect(minhas.map(p => p.lugar)).toEqual([b])
    expect(tela.mapas.at(-1).has(a)).toBe(false)
    expect(tela.mapas.at(-1).has(b)).toBe(true)
  })

  test('apelido em uso (com outro jeito de escrever) e apelido reservado: recusa e o editor continua aberto', async () => {
    const { ctrl, tela } = await montar(bancoFalso([{ lugar: lugarLivre(5), apelido: 'Maria Silva' }]))
    tela.escolher(lugarLivre(0))
    const ed = tela.editores.at(-1)

    await expect(ed.salvar('maria SILVA', visual)).rejects.toMatchObject({ codigo: 'apelido_em_uso' })
    await expect(ed.salvar('joao', visual)).rejects.toMatchObject({ codigo: 'apelido_em_uso', message: MENSAGENS.apelido_em_uso })
    await expect(ed.salvar('Gabi', visual)).rejects.toMatchObject({ codigo: 'apelido_em_uso' })
    expect(ed.aberto).toBe(true)
    expect(ctrl.aberto).toBe(true)
    expect(tela.aviso.hidden).toBe(true)
  })

  test('cadeira ocupada por outra pessoa: recusa ao salvar', async () => {
    const banco = bancoFalso()
    const { tela } = await montar(banco)
    const a = lugarLivre(0)
    tela.escolher(a)
    const ed = tela.editores.at(-1)
    banco.alguemSenta(a, 'Bia')
    await flush()
    await expect(ed.salvar('Ana', visual)).rejects.toMatchObject({ codigo: 'lugar_ocupado' })
    expect(ed.aberto).toBe(true)
  })

  test('aoMudar com o editor aberto: a lista atualiza e a prévia continua na cadeira', async () => {
    const banco = bancoFalso()
    const { ctrl, tela } = await montar(banco)
    const a = lugarLivre(0), outra = lugarLivre(9)
    tela.escolher(a)
    const ed = tela.editores.at(-1)
    ed.mudou('Ana', visual)

    banco.alguemSenta(outra, 'Bia')
    await flush()

    const ultimo = tela.mapas.at(-1)
    expect(ultimo.get(outra).apelido).toBe('Bia')
    expect(ultimo.get(a).apelido).toBe('Ana')
    expect(ed.fechar).not.toHaveBeenCalled()
    expect(ed.aberto).toBe(true)
    expect(ctrl.aberto).toBe(true)
    expect(tela.aviso.hidden).toBe(true)
  })

  test('aoMudar que tira a cadeira da prévia: avisa e não fecha o editor', async () => {
    const banco = bancoFalso()
    const { ctrl, tela } = await montar(banco)
    const a = lugarLivre(0)
    tela.escolher(a)
    const ed = tela.editores.at(-1)
    ed.mudou('Ana', visual)

    banco.alguemSenta(a, 'Bia')
    await flush()

    expect(tela.aviso.textContent).toBe(MSG_CONFLITO)
    expect(tela.mapas.at(-1).get(a).apelido).toBe('Bia')
    expect(ctrl.aberto).toBe(true)
  })

  test('"+" durante o modo boneco sai do modo boneco antes', async () => {
    const { tela } = await montar(bancoFalso())
    tela.passeio.ativo = true
    tela.escolher(lugarLivre(0))
    expect(tela.passeio.sair).toHaveBeenCalledWith({ voar: false })
    expect(tela.editores.length).toBe(1)
  })

  test('a busca leva a câmera até quem está sentado, fixo ou visitante', async () => {
    const banco = bancoFalso([{ lugar: lugarLivre(3), apelido: 'Bia' }])
    const { tela } = await montar(banco)
    expect(tela.pessoas().map((p: any) => p.apelido)).toEqual(expect.arrayContaining(['Gabi', 'Bia']))
    tela.ir({ apelido: 'Gabi', lugar: 'leste-1-N-1' })
    expect(tela.andar.olharPara).toHaveBeenCalledWith('leste-1-N-1', 'direita')
    tela.ir({ apelido: 'Bia', lugar: lugarLivre(3) })
    expect(tela.andar.olharPara).toHaveBeenLastCalledWith(lugarLivre(3), 'direita')
  })

  test('banco que cai ao carregar: planta com os 15 fixos, aviso em português e "tentar de novo"', async () => {
    const banco = bancoFalso([{ lugar: lugarLivre(0), apelido: 'Bia' }])
    banco.quebrar(true)
    const { tela } = await montar(banco)
    expect(tela.mapas.at(-1).size).toBe(FIXOS.length)
    expect(tela.carga.hidden).toBe(false)
    expect(tela.cargaTexto.textContent).toBe(MSG_CARGA)

    banco.quebrar(false)
    await tela.tentar()
    expect(tela.carga.hidden).toBe(true)
    expect(tela.mapas.at(-1).get(lugarLivre(0)).apelido).toBe('Bia')
  })

  test('leitura que pendura conta como falha: a tela não fica esperando para sempre', async () => {
    const banco = bancoFalso()
    banco.listar = () => new Promise(() => {})   /* nunca responde */
    const tela = telaFalsa()
    const ctrl = criarEscritorio({} as HTMLElement, banco, { ui: tela.ui, tempoLimite: 5 })
    await ctrl.pronto
    expect(tela.carga.hidden).toBe(false)
    expect(tela.mapas.at(-1).size).toBe(FIXOS.length)
  })

  test('sem banco nenhum (nem montou): mesma planta de fixos, com aviso', async () => {
    const { tela } = await montar(null)
    expect(tela.mapas.at(-1).size).toBe(FIXOS.length)
    expect(tela.carga.hidden).toBe(false)
  })
})
