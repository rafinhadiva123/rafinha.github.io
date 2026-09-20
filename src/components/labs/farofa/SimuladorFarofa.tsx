import { useEffect, useMemo, useState } from 'react'
import './SimuladorFarofa.css'
import { pct, simular, type Estado, type Resultado } from './modelo'
import { farinhas, ingredientes, type Categoria, type Farinha, type Ingrediente } from './ingredientes'
import { presets, type NomePreset } from './presets'
import { codificarEstado, decodificarEstado } from './url'
import {
  desenharBarras,
  desenharKnob,
  desenharMedidores,
  desenharPanela,
  desenharPlano,
  glifo,
  glifoSaco,
} from './desenhos'

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor))
}

const ROTULOS_TOSTAGEM = [
  'crua',
  'crua',
  'leve',
  'leve',
  'dourada',
  'dourada',
  'dourada',
  'tostada',
  'tostada',
  'quase queimada',
  'quase queimada',
]

// Os 15 compartimentos vêm em 8 categorias no modelo (pra deixar o preparo
// preciso), mas a bandeja do jogo mostra só 6 — a mesma divisão do protótipo.
const GRUPO_POR_CATEGORIA: Record<Categoria, string> = {
  gordura: 'Gorduras',
  salgado: 'Salgados',
  aromático: 'Aromáticos e verdes',
  verde: 'Aromáticos e verdes',
  crocante: 'Crocantes',
  liga: 'Doces e liga',
  doce: 'Doces e liga',
  tempero: 'Tempero',
}

const GRUPOS_ORDENADOS = ['Gorduras', 'Salgados', 'Aromáticos e verdes', 'Crocantes', 'Doces e liga', 'Tempero']

function agruparIngredientes(lista: Ingrediente[]): [string, Ingrediente[]][] {
  const porGrupo = new Map<string, Ingrediente[]>()
  for (const ingrediente of lista) {
    const grupo = GRUPO_POR_CATEGORIA[ingrediente.categoria]
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, [])
    porGrupo.get(grupo)!.push(ingrediente)
  }
  return GRUPOS_ORDENADOS.filter((grupo) => porGrupo.has(grupo)).map((grupo) => [grupo, porGrupo.get(grupo)!])
}

const GRUPOS_DE_INGREDIENTES = agruparIngredientes(ingredientes)

function estadoInicial(): Estado {
  return presets.churrasco.estado
}

function rotuloPolemica(valor: number): string {
  if (valor < 1) return 'Tranquila'
  if (valor < 3.5) return 'Discutível'
  if (valor < 6.5) return 'Polêmica'
  return 'Briga de família'
}

// -- compartimento de ingrediente ---------------------------------------------

type CompartimentoProps = {
  ingrediente: Ingrediente
  gramas: number
  onAlternar: () => void
  onAjustar: (delta: number) => void
}

function Compartimento({ ingrediente, gramas, onAlternar, onAjustar }: CompartimentoProps) {
  const ativo = gramas > 0

  return (
    <div className={`comp${ativo ? ' comp--ativo' : ''}`}>
      {ativo && <span className="comp__qtd">{gramas} g</span>}
      <button type="button" className="comp__botao" onClick={onAlternar} aria-pressed={ativo}>
        <span className="comp__icone" aria-hidden="true" dangerouslySetInnerHTML={{ __html: glifo(ingrediente.id) }} />
        <span className="comp__nome">{ingrediente.nome}</span>
      </button>
      {ativo && (
        <div className="comp__passo">
          <button type="button" aria-label={`Menos ${ingrediente.nome}`} onClick={() => onAjustar(-10)}>
            −
          </button>
          <button type="button" aria-label={`Mais ${ingrediente.nome}`} onClick={() => onAjustar(10)}>
            +
          </button>
        </div>
      )}
    </div>
  )
}

// -- componente principal ------------------------------------------------------

export default function SimuladorFarofa() {
  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [mensagem, setMensagem] = useState<string | null>(null)

  const resultado: Resultado = useMemo(() => simular(estado), [estado])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.search) return
    const decodificado = decodificarEstado(window.location.search)
    if (decodificado) setEstado(decodificado)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = codificarEstado(estado)
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`)
  }, [estado])

  function ajustarIngrediente(id: string, gramas: number) {
    setEstado((atual) => {
      const proximo = { ...atual.ingredientes }
      if (gramas <= 0) delete proximo[id]
      else proximo[id] = Math.min(300, gramas)
      return { ...atual, ingredientes: proximo }
    })
  }

  function avisar(texto: string) {
    setMensagem(texto)
    window.setTimeout(() => setMensagem(null), 2500)
  }

  function linkCompartilhavel(): string {
    const query = codificarEstado(estado)
    if (typeof window === 'undefined') return `/experimentos/simulador-de-farofa?${query}`
    return `${window.location.origin}${window.location.pathname}?${query}`
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkCompartilhavel())
      avisar('Link copiado!')
    } catch {
      avisar('Não deu pra copiar automaticamente — copia direto da barra de endereço.')
    }
  }

  async function copiarReceita() {
    const linhas = resultado.receita.map(
      (linha) => `- ${linha.nome}: ${linha.gramas} g${linha.medidaCaseira ? ` (${linha.medidaCaseira})` : ''}`,
    )
    const passos = resultado.preparo.map((passo, indice) => `${indice + 1}. ${passo}`)
    const texto = [
      `Farofa para ${estado.pessoas} pessoa${estado.pessoas > 1 ? 's' : ''}`,
      '',
      'Ingredientes:',
      ...linhas,
      '',
      'Modo de preparo:',
      ...passos,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(texto)
      avisar('Receita copiada!')
    } catch {
      avisar('Não deu pra copiar a receita automaticamente.')
    }
  }

  const presetAtivo = (Object.keys(presets) as NomePreset[]).find(
    (chave) => JSON.stringify(presets[chave].estado) === JSON.stringify(estado),
  )

  return (
    <div className="simulador">
      <div className="placa">
        <div>
          <h1 className="contorno-texto">Simulador de Farofa</h1>
          <div className="placa__sub">experimento · rafinha.xyz</div>
        </div>
        <div className="receitas">
          <span className="receitas__rotulo">Receitas</span>
          {(Object.keys(presets) as NomePreset[]).map((chave) => (
            <button
              key={chave}
              type="button"
              className={`botao-jogo${presetAtivo === chave ? ' botao-jogo--ativo' : ''}`}
              onClick={() => setEstado(presets[chave].estado)}
            >
              {presets[chave].nome}
            </button>
          ))}
        </div>
      </div>

      <div
        className="medidores"
        dangerouslySetInnerHTML={{ __html: desenharMedidores(resultado) }}
      />

      <div className="estacoes">
        <section className="bandeja" aria-labelledby="titulo-ingredientes">
          <h2 id="titulo-ingredientes">Ingredientes</h2>
          {GRUPOS_DE_INGREDIENTES.map(([grupo, itens]) => (
            <div key={grupo}>
              <div className="grupo-rot">{grupo}</div>
              <div className="compartimentos">
                {itens.map((ingrediente) => (
                  <Compartimento
                    key={ingrediente.id}
                    ingrediente={ingrediente}
                    gramas={estado.ingredientes[ingrediente.id] ?? 0}
                    onAlternar={() =>
                      ajustarIngrediente(
                        ingrediente.id,
                        estado.ingredientes[ingrediente.id] ? 0 : ingrediente.gramasPadrao,
                      )
                    }
                    onAjustar={(delta) => ajustarIngrediente(ingrediente.id, (estado.ingredientes[ingrediente.id] ?? 0) + delta)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="estacao-fogao" aria-labelledby="titulo-fogao">
          <h2 id="titulo-fogao" className="sr-so">
            Frigideira
          </h2>
          <div className="panela-area">
            <svg
              className="panela"
              viewBox="0 0 360 320"
              role="img"
              aria-labelledby="panelaTitulo"
              dangerouslySetInnerHTML={{ __html: desenharPanela(estado, resultado, farinhas[estado.farinha].cor) }}
            />
          </div>
          <div className="fogo-caixa">
            <svg
              className="knob"
              viewBox="0 0 60 60"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: desenharKnob(estado.tostagem) }}
            />
            <div className="campo">
              <div className="campo-topo">
                <label htmlFor="tostagem">Fogo</label>
                <span className="v">
                  {estado.tostagem} · {ROTULOS_TOSTAGEM[estado.tostagem]}
                </span>
              </div>
              <input
                id="tostagem"
                type="range"
                min={0}
                max={10}
                step={1}
                value={estado.tostagem}
                onChange={(evento) => setEstado((atual) => ({ ...atual, tostagem: Number(evento.target.value) }))}
              />
            </div>
          </div>
        </section>

        <div>
          <section className="modulo" aria-labelledby="titulo-farinha">
            <h2 id="titulo-farinha">Farinha</h2>
            <div className="farinhas" role="radiogroup" aria-labelledby="titulo-farinha">
              {(Object.keys(farinhas) as Farinha[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="saco"
                  role="radio"
                  aria-checked={estado.farinha === id}
                  onClick={() => setEstado((atual) => ({ ...atual, farinha: id }))}
                >
                  <span
                    className="saco__icone"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: glifoSaco(farinhas[id].cor) }}
                  />
                  <span>
                    {farinhas[id].nome}
                    <small>{farinhas[id].desc}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="linha-ctrl" style={{ marginTop: 12 }}>
              <div className="campo-topo">
                <label htmlFor="gramasFarinha">Quantidade</label>
                <span>{estado.gramasFarinha} g</span>
              </div>
              <input
                id="gramasFarinha"
                type="range"
                min={50}
                max={1000}
                step={10}
                value={estado.gramasFarinha}
                onChange={(evento) =>
                  setEstado((atual) => ({ ...atual, gramasFarinha: Number(evento.target.value) }))
                }
              />
            </div>
          </section>

          <section className="modulo" aria-labelledby="titulo-tempero">
            <h2 id="titulo-tempero">Tempero e mesa</h2>
            <div className="linha-ctrl">
              <div className="campo-topo">
                <label htmlFor="sal">Sal</label>
                <span>{estado.sal} g</span>
              </div>
              <input
                id="sal"
                type="range"
                min={0}
                max={30}
                step={1}
                value={estado.sal}
                onChange={(evento) => setEstado((atual) => ({ ...atual, sal: Number(evento.target.value) }))}
              />
            </div>
            <div className="linha-ctrl">
              <div className="campo-topo">
                <label htmlFor="pessoas">Serve</label>
                <span>
                  {estado.pessoas} {estado.pessoas === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </div>
              <input
                id="pessoas"
                type="range"
                min={1}
                max={20}
                step={1}
                value={estado.pessoas}
                onChange={(evento) => setEstado((atual) => ({ ...atual, pessoas: Number(evento.target.value) }))}
              />
            </div>
          </section>
        </div>
      </div>

      <div className={`veredito veredito--${resultado.veredito.tom}`} role="status">
        <div className="veredito__texto">
          <h2>{resultado.veredito.titulo}</h2>
          <p>{resultado.veredito.dica}</p>
        </div>
        <div className="selos">
          <div className="selo">
            <div className="selo__n">{Math.max(1, Math.round(resultado.porcoes))}</div>
            <div className="selo__r">Porções</div>
          </div>
          <div className="selo">
            <div className="selo__n">{Math.round(resultado.pesoFinal)}</div>
            <div className="selo__r">Gramas</div>
          </div>
          <div className="selo">
            <div className="selo__n">{resultado.polemica.toFixed(1).replace('.', ',')}</div>
            <div className="selo__r">{rotuloPolemica(resultado.polemica)}</div>
            <div className="selo__barrinha">
              <i style={{ width: `${clamp(resultado.polemica * 10, 0, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="fichas">
        <div className="papel">
          <h3>
            Ficha técnica <span>umidade × crocância</span>
          </h3>
          <svg
            viewBox="0 0 320 232"
            role="img"
            aria-labelledby="planoTitulo"
            dangerouslySetInnerHTML={{ __html: desenharPlano(resultado) }}
          />
          <div style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: desenharBarras(resultado) }} />
          <div className="link-box">
            <input type="text" readOnly value={linkCompartilhavel()} aria-label="Link compartilhável desta farofa" />
            <button type="button" className="botao-jogo" onClick={copiarLink}>
              Copiar
            </button>
          </div>
        </div>

        <div className="papel">
          <h3>
            Receita{' '}
            <span>
              para {estado.pessoas} {estado.pessoas === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Ingrediente</th>
                <th scope="col">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {resultado.receita.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.nome}</td>
                  <td className="td-g">
                    {linha.gramas} g
                    <span className="td-med">{linha.medidaCaseira ? ` (${linha.medidaCaseira})` : ''}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="preparo-titulo">Modo de preparo</h3>
          <ol className="preparo">
            {resultado.preparo.map((passo, indice) => (
              <li key={indice}>{passo}</li>
            ))}
          </ol>

          <div className="link-box">
            <button type="button" className="botao-jogo" onClick={copiarReceita}>
              Copiar receita
            </button>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mensagem">
        {mensagem}
      </p>

      <p className="rodape">
        Estimativas de gordura, umidade e sal em <b>{pct(resultado.metricas.G)}</b>,{' '}
        <b>{pct(resultado.metricas.U)}</b> e <b>{pct(resultado.metricas.S)}</b> — modelo determinístico, sem IA.
      </p>
    </div>
  )
}
