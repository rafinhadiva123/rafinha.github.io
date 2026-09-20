import { useEffect, useMemo, useState } from 'react'
import './SimuladorFarofa.css'
import { simular, type Estado, type Resultado } from './modelo'
import { farinhas, ingredientes, type Farinha, type Ingrediente } from './ingredientes'
import { presets, type NomePreset } from './presets'
import { codificarEstado, decodificarEstado } from './url'

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor))
}

function rotuloTostagem(tostagem: number): string {
  if (tostagem <= 1) return 'crua'
  if (tostagem <= 3) return 'leve'
  if (tostagem <= 6) return 'dourada'
  if (tostagem <= 8) return 'tostada'
  return 'quase queimada'
}

function formatarPercentual(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

// -- barra de faixa (gordura / umidade / sal) -------------------------------

type BarraFaixaProps = {
  titulo: string
  valor: number
  minimo: number
  maximo: number
  idealMinimo: number
  idealMaximo: number
  formatar: (valor: number) => string
}

function BarraFaixa({ titulo, valor, minimo, maximo, idealMinimo, idealMaximo, formatar }: BarraFaixaProps) {
  const paraPercentual = (v: number) => clamp(((v - minimo) / (maximo - minimo)) * 100, 0, 100)

  return (
    <div className="barra-faixa">
      <div className="barra-faixa__cabecalho">
        <span>{titulo}</span>
        <span>{formatar(valor)}</span>
      </div>
      <div className="barra-faixa__trilho">
        <div
          className="barra-faixa__ideal"
          style={{
            left: `${paraPercentual(idealMinimo)}%`,
            width: `${paraPercentual(idealMaximo) - paraPercentual(idealMinimo)}%`,
          }}
        />
        <div className="barra-faixa__marcador" style={{ left: `${paraPercentual(valor)}%` }} />
      </div>
    </div>
  )
}

// -- plano umidade × crocância ------------------------------------------------

const U_MAX = 0.6
const C_MAX = 10

function xEmU(u: number): number {
  return (clamp(u, 0, U_MAX) / U_MAX) * 100
}

function yEmC(c: number): number {
  return ((C_MAX - clamp(c, 0, C_MAX)) / C_MAX) * 100
}

function PlanoUmidadeCrocancia({ U, C }: { U: number; C: number }) {
  const xPirao = xEmU(0.45)
  const xMolhada = xEmU(0.25)
  const xAreia = xEmU(0.05)
  const yMurcha = yEmC(3)
  const yAreia = yEmC(6)

  return (
    <div className="plano">
      <svg
        className="plano__svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Ponto no plano umidade por crocância: umidade ${formatarPercentual(U)}, crocância ${C.toFixed(1)} de 10`}
      >
        <rect x="0" y="0" width="100" height="100" className="plano__zona plano__zona--ideal" />
        <rect x="0" y={yMurcha} width={xMolhada} height={100 - yMurcha} className="plano__zona plano__zona--alerta" />
        <rect x="0" y="0" width={xAreia} height={yAreia} className="plano__zona plano__zona--areia" />
        <rect x={xMolhada} y="0" width={xPirao - xMolhada} height="100" className="plano__zona plano__zona--alerta" />
        <rect x={xPirao} y="0" width={100 - xPirao} height="100" className="plano__zona plano__zona--erro" />

        <line x1={xMolhada} y1="0" x2={xMolhada} y2="100" className="plano__linha" />
        <line x1={xPirao} y1="0" x2={xPirao} y2="100" className="plano__linha" />
        <line x1="0" y1={yMurcha} x2="100" y2={yMurcha} className="plano__linha" />

        <circle cx={xEmU(U)} cy={yEmC(C)} r="3.2" className="plano__ponto" />
      </svg>
      <div className="plano__eixos">
        <span>seca</span>
        <span>umidade →</span>
        <span>encharcada</span>
      </div>
      <p className="plano__legenda">
        Umidade {formatarPercentual(U)} · Crocância {C.toFixed(1)}/10
      </p>
    </div>
  )
}

// -- cartão de ingrediente ----------------------------------------------------

type CartaoIngredienteProps = {
  ingrediente: Ingrediente
  gramas: number
  onMudar: (gramas: number) => void
}

function CartaoIngrediente({ ingrediente, gramas, onMudar }: CartaoIngredienteProps) {
  const ativo = gramas > 0

  if (!ativo) {
    return (
      <button
        type="button"
        className="cartao-ingrediente cartao-ingrediente--inativo"
        onClick={() => onMudar(ingrediente.gramasPadrao)}
      >
        + {ingrediente.nome}
      </button>
    )
  }

  return (
    <div className="cartao-ingrediente cartao-ingrediente--ativo">
      <div className="cartao-ingrediente__cabecalho">
        <span>{ingrediente.nome}</span>
        <button type="button" aria-label={`Remover ${ingrediente.nome}`} onClick={() => onMudar(0)}>
          ×
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={300}
        step={5}
        value={gramas}
        aria-label={`Quantidade de ${ingrediente.nome}, em gramas`}
        onChange={(evento) => onMudar(Number(evento.target.value))}
      />
      <span className="cartao-ingrediente__valor">{gramas} g</span>
    </div>
  )
}

// -- componente principal ------------------------------------------------------

function estadoInicial(): Estado {
  return presets.churrasco.estado
}

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

  function atualizarIngrediente(id: string, gramas: number) {
    setEstado((atual) => ({ ...atual, ingredientes: { ...atual.ingredientes, [id]: gramas } }))
  }

  function avisar(texto: string) {
    setMensagem(texto)
    window.setTimeout(() => setMensagem(null), 2500)
  }

  async function copiarLink() {
    const query = codificarEstado(estado)
    const url = `${window.location.origin}${window.location.pathname}?${query}`
    try {
      await navigator.clipboard.writeText(url)
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

  return (
    <div className="simulador">
      <div className="simulador__controles">
        <section aria-labelledby="titulo-presets">
          <h2 id="titulo-presets">Presets</h2>
          <div className="controles__presets">
            {(Object.keys(presets) as NomePreset[]).map((chave) => (
              <button key={chave} type="button" onClick={() => setEstado(presets[chave].estado)}>
                {presets[chave].nome}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="titulo-farinha">
          <h2 id="titulo-farinha">Farinha</h2>
          <div className="controles__farinha" role="radiogroup" aria-labelledby="titulo-farinha">
            {(Object.keys(farinhas) as Farinha[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={estado.farinha === id}
                className={estado.farinha === id ? 'ativo' : ''}
                onClick={() => setEstado((atual) => ({ ...atual, farinha: id }))}
              >
                {farinhas[id].nome}
              </button>
            ))}
          </div>

          <label className="controle-slider">
            <span>Quantidade de farinha: {estado.gramasFarinha} g</span>
            <input
              type="range"
              min={50}
              max={1000}
              step={10}
              value={estado.gramasFarinha}
              onChange={(evento) =>
                setEstado((atual) => ({ ...atual, gramasFarinha: Number(evento.target.value) }))
              }
            />
          </label>
        </section>

        <section aria-labelledby="titulo-ingredientes">
          <h2 id="titulo-ingredientes">Ingredientes</h2>
          <div className="controles__ingredientes">
            {ingredientes.map((ingrediente) => (
              <CartaoIngrediente
                key={ingrediente.id}
                ingrediente={ingrediente}
                gramas={estado.ingredientes[ingrediente.id] ?? 0}
                onMudar={(gramas) => atualizarIngrediente(ingrediente.id, gramas)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="titulo-tempero">
          <h2 id="titulo-tempero">Sal e tostagem</h2>

          <label className="controle-slider">
            <span>Sal: {estado.sal} g</span>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={estado.sal}
              onChange={(evento) => setEstado((atual) => ({ ...atual, sal: Number(evento.target.value) }))}
            />
          </label>

          <label className="controle-slider">
            <span>
              Tostagem: {estado.tostagem} — {rotuloTostagem(estado.tostagem)}
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={estado.tostagem}
              onChange={(evento) => setEstado((atual) => ({ ...atual, tostagem: Number(evento.target.value) }))}
            />
            <div className="controle-slider__rotulos">
              <span>crua</span>
              <span>leve</span>
              <span>dourada</span>
              <span>tostada</span>
              <span>quase queimada</span>
            </div>
          </label>
        </section>

        <section aria-labelledby="titulo-pessoas">
          <h2 id="titulo-pessoas">Pessoas</h2>
          <div className="controle-stepper">
            <button
              type="button"
              aria-label="Diminuir número de pessoas"
              onClick={() => setEstado((atual) => ({ ...atual, pessoas: clamp(atual.pessoas - 1, 1, 20) }))}
            >
              −
            </button>
            <span aria-live="polite">{estado.pessoas}</span>
            <button
              type="button"
              aria-label="Aumentar número de pessoas"
              onClick={() => setEstado((atual) => ({ ...atual, pessoas: clamp(atual.pessoas + 1, 1, 20) }))}
            >
              +
            </button>
          </div>
        </section>
      </div>

      <div className="simulador__resultado">
        <div className={`veredito veredito--${resultado.veredito.tom}`} role="status">
          <h2>{resultado.veredito.titulo}</h2>
          <p>{resultado.veredito.dica}</p>
        </div>

        <PlanoUmidadeCrocancia U={resultado.metricas.U} C={resultado.metricas.C} />

        <div className="barras-faixa">
          <BarraFaixa
            titulo="Gordura"
            valor={resultado.metricas.G}
            minimo={0}
            maximo={0.7}
            idealMinimo={0.25}
            idealMaximo={0.4}
            formatar={formatarPercentual}
          />
          <BarraFaixa
            titulo="Umidade"
            valor={resultado.metricas.U}
            minimo={0}
            maximo={0.6}
            idealMinimo={0.08}
            idealMaximo={0.2}
            formatar={formatarPercentual}
          />
          <BarraFaixa
            titulo="Sal"
            valor={resultado.metricas.S}
            minimo={0}
            maximo={0.02}
            idealMinimo={0.008}
            idealMaximo={0.012}
            formatar={formatarPercentual}
          />
        </div>

        <div className="medidores">
          <p className="medidor-rendimento">≈ {Math.max(1, Math.round(resultado.porcoes))} porções</p>
          <div className="medidor-polemica">
            <span>Polêmica</span>
            <div className="medidor-polemica__trilho">
              <div
                className="medidor-polemica__preenchimento"
                style={{ width: `${clamp((resultado.polemica / 10) * 100, 0, 100)}%` }}
              />
            </div>
            <span>{resultado.polemica.toFixed(1)}/10</span>
          </div>
        </div>

        <section aria-labelledby="titulo-receita">
          <h2 id="titulo-receita">Receita para {estado.pessoas} pessoa{estado.pessoas > 1 ? 's' : ''}</h2>
          <table className="tabela-receita">
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
                  <td>
                    {linha.gramas} g
                    {linha.medidaCaseira ? ` (${linha.medidaCaseira})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Modo de preparo</h3>
          <ol className="lista-preparo">
            {resultado.preparo.map((passo, indice) => (
              <li key={indice}>{passo}</li>
            ))}
          </ol>
        </section>

        <div className="acoes">
          <button type="button" onClick={copiarLink}>
            Copiar link
          </button>
          <button type="button" onClick={copiarReceita}>
            Copiar receita
          </button>
        </div>
        <p aria-live="polite" className="acoes__mensagem">
          {mensagem}
        </p>
      </div>
    </div>
  )
}
