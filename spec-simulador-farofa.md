# Simulador de Farofa — especificação

Primeiro experimento do lab em **rafinha.xyz**. Roda 100% no navegador, sem backend,
sem chamada de rede. Site em Astro, deploy no GitHub Pages.

---

## 1. Objetivo

Um simulador onde a pessoa monta uma farofa escolhendo farinha, ingredientes e nível de
tostagem, e recebe:

1. Um **diagnóstico** da farofa (umidade × crocância) com veredito.
2. Uma **receita real**, em gramas e medidas caseiras, escalada pelo número de pessoas.
3. Um **link compartilhável** com a configuração inteira codificada na URL.

Não é um gerador aleatório: o resultado vem de um modelo determinístico de proporções.

---

## 2. Arquitetura

```
src/
  content/experimentos/simulador-de-farofa.mdx   texto + <SimuladorFarofa />
  components/labs/farofa/
    SimuladorFarofa.tsx      componente de UI (ilha Astro, client:load)
    modelo.ts                função pura simular(): toda a lógica
    ingredientes.ts          tabela de dados
    presets.ts               configurações iniciais
    url.ts                   encode/decode do estado na querystring
    modelo.test.ts           testes com vitest
```

**Regra de ouro:** `modelo.ts` não importa nada de React nem toca no DOM. É uma função
pura `simular(estado: Estado): Resultado`. Toda a inteligência vive ali; o componente só
desenha. Isso mantém o modelo testável e permite reaproveitar o padrão nos próximos
experimentos.

---

## 3. Dados

### 3.1 Tipos de farinha (escolha única)

| Farinha | `absorcao` | `crocanciaBase` |
|---|---|---|
| Mandioca fina | 1.00 | 0 |
| Mandioca grossa (biju) | 0.60 | +2 |
| Mandioca torrada/flocada | 0.80 | +1 |
| Fubá (milho) | 1.20 | −1 |

`absorcao` = quanto de água a farinha segura antes de empapar. Biju absorve pouco e fica
leve; fubá absorve muito e vira massa com facilidade.

### 3.2 Ingredientes (lista curada, 15 itens)

Valores por 100 g do ingrediente **já preparado** (bacon frito, ovo mexido, banana
frita). `crocancia` e `polemica` são escalas de −3 a +3.

| # | Ingrediente | gordura (g) | água (g) | sal (g) | açúcar (g) | crocância | polêmica | categoria |
|---|---|---|---|---|---|---|---|---|
| 1 | Manteiga | 82 | 16 | 0.0 | 0 | 0 | 0 | gordura |
| 2 | Azeite de dendê | 100 | 0 | 0.0 | 0 | 0 | 1 | gordura |
| 3 | Bacon | 45 | 15 | 2.5 | 0 | +2 | 0 | salgado |
| 4 | Linguiça calabresa | 30 | 40 | 2.0 | 0 | +1 | 0 | salgado |
| 5 | Queijo coalho | 25 | 40 | 1.8 | 0 | +1 | 1 | salgado |
| 6 | Cebola | 0 | 89 | 0.0 | 4 | −1 | 0 | aromático |
| 7 | Alho | 0 | 59 | 0.0 | 1 | 0 | 0 | aromático |
| 8 | Cheiro-verde | 0 | 90 | 0.0 | 0 | 0 | 0 | aromático |
| 9 | Castanha-de-caju | 44 | 5 | 0.0 | 6 | +3 | 0 | crocante |
| 10 | Amendoim torrado | 49 | 2 | 0.0 | 4 | +3 | 1 | crocante |
| 11 | Ovo mexido | 10 | 75 | 0.3 | 0 | −2 | 0 | liga |
| 12 | Banana-da-terra | 0 | 65 | 0.0 | 20 | −2 | 2 | doce |
| 13 | Uva-passa | 0 | 15 | 0.0 | 59 | 0 | 3 | doce |
| 14 | Couve fatiada | 0 | 90 | 0.0 | 1 | −1 | 0 | verde |
| 15 | Pimenta-biquinho | 0 | 88 | 0.5 | 2 | 0 | 2 | tempero |

Sal e pimenta-do-reino **não** entram na lista: são controles separados, em gramas.

---

## 4. O modelo

### 4.1 Entrada

```ts
type Estado = {
  farinha: 'mandioca-fina' | 'mandioca-grossa' | 'mandioca-torrada' | 'fuba'
  gramasFarinha: number         // 50–1000, passo 10
  ingredientes: Record<string, number>  // id -> gramas
  sal: number                   // 0–30 g
  tostagem: number              // 0–10 (fogo × tempo, escala única)
  pessoas: number               // 1–20
}
```

### 4.2 Cálculo

Seja `F` = `gramasFarinha` e cada ingrediente `i` com massa `mᵢ`:

```
gorduraTotal = Σ mᵢ × gorduraᵢ/100
aguaTotal    = Σ mᵢ × aguaᵢ/100
salTotal     = sal + Σ mᵢ × salᵢ/100
pesoBruto    = F + Σ mᵢ + sal
```

**Gordura relativa**

```
G = gorduraTotal / F              // faixa boa: 0.25 – 0.40
```

**Evaporação e umidade**

```
fatorEvap    = 0.10 + 0.08 × tostagem      // 0.10 a 0.90
aguaResidual = aguaTotal × (1 − fatorEvap)
U            = aguaResidual / (F × absorcao)   // faixa boa: 0.08 – 0.20
```

**Sal**

```
pesoFinal = pesoBruto − aguaTotal × fatorEvap
S = salTotal / pesoFinal          // faixa boa: 0.008 – 0.012
```

**Crocância** (escala resultante 0–10, com clamp)

```
C = 5
  + crocanciaBase
  + Σ (crocanciaᵢ × (mᵢ / F) × 3)
  + (tostagem − 5) × 0.4
  − max(0, U − 0.20) × 12
  − max(0, G − 0.55) × 6        // gordura demais pesa e murcha
```

**Queimado**

```
Q = max(0, tostagem − 8.5)      // acima disso, amarga
```

**Rendimento**

```
porcoes = pesoFinal / 60        // 60 g por porção
```

**Polêmica** (0–10, só decorativo)

```
P = clamp(Σ (polemicaᵢ × min(mᵢ / F, 0.5) × 8), 0, 10)
```

### 4.3 Veredito

Decidido por `U`, `C` e `Q`, nesta ordem de precedência:

| Condição | Veredito | Tom |
|---|---|---|
| `Q > 0.8` | **"Queimou. Começa de novo."** | erro |
| `U > 0.45` | **"Isso virou pirão."** | erro |
| `U > 0.25` | **"Farofa molhada. Tem gente que gosta."** | alerta |
| `C < 3` | **"Farofa murcha. Faltou tostar."** | alerta |
| `U < 0.05 && C > 6` | **"Areia da praia. Beba água."** | alerta |
| `G < 0.15` | **"Seca e sem graça. Aumenta a gordura."** | alerta |
| `G > 0.55` | **"Encharcada de gordura."** | alerta |
| `S > 0.016` | **"Salgada demais."** | alerta |
| `S < 0.005` | **"Faltou sal."** | alerta |
| resto | **"No ponto."** | sucesso |

Cada veredito vem com uma **dica acionável** ("tira 20 g de manteiga", "sobe a tostagem
pra 7") derivada da métrica que disparou.

### 4.4 Saída

```ts
type Resultado = {
  metricas: { G: number; U: number; S: number; C: number; Q: number }
  faixas: Record<'G'|'U'|'S', 'baixo' | 'ideal' | 'alto'>
  veredito: { titulo: string; tom: 'sucesso'|'alerta'|'erro'; dica: string }
  porcoes: number
  polemica: number
  receita: LinhaReceita[]        // escalada para `pessoas`
  preparo: string[]              // passos gerados
}
```

**Escala da receita:** o estado é montado numa quantidade qualquer; a receita exibida é
reescalada por `pessoas × 60 g ÷ pesoFinal`, arredondando para múltiplos de 5 g.

**Medidas caseiras:** cada ingrediente tem uma densidade de colher/xícara na tabela,
para exibir "180 g (1 ½ xícara)" ao lado do valor em gramas.

**Modo de preparo:** gerado por template a partir das categorias presentes — gordura →
aromáticos → salgados → farinha → crocantes → finalização. A ordem **não** entra no
cálculo (decisão consciente, ver §7), só na exibição.

---

## 5. Interface

Layout em duas colunas no desktop, empilhado no celular.

**Coluna esquerda — controles**

- Seletor de farinha (4 botões).
- Slider de gramas de farinha.
- Grid dos 15 ingredientes: clicar adiciona com uma quantidade padrão; depois vira
  slider de 0 a 300 g. Ingrediente em 0 g fica visualmente apagado.
- Slider de sal.
- Slider de tostagem, com rótulos: *crua · leve · dourada · tostada · quase queimada*.
- Stepper de pessoas.
- Botões de preset.

**Coluna direita — resultado (atualiza em tempo real, sem botão de calcular)**

- **Card de veredito** no topo: título, tom (cor), dica.
- **Plano umidade × crocância**: ponto posicionado sobre as regiões coloridas. É o
  elemento visual principal — mostra o *porquê* do veredito.
- **Três barras** de faixa (gordura, umidade, sal) com a zona ideal marcada.
- **Rendimento** em porções.
- **Medidor de polêmica**.
- **Receita** em tabela + modo de preparo numerado.
- Botões: **copiar link**, **copiar receita**.

### Presets

| Preset | Composição |
|---|---|
| Churrasco | mandioca grossa, manteiga, bacon, cebola, alho, cheiro-verde, tostagem 6 |
| Natalina | mandioca fina, manteiga, uva-passa, castanha, ovo, cebola, tostagem 5 |
| De banana | mandioca fina, manteiga, banana-da-terra, cebola, tostagem 6 |
| Nordestina | mandioca torrada, dendê, calabresa, queijo coalho, pimenta, tostagem 7 |
| Vegana | mandioca grossa, dendê, cebola, alho, castanha, couve, cheiro-verde, tostagem 6 |

### Link compartilhável

Estado serializado na querystring com chaves curtas (`?f=mg&g=300&i=1-40.3-80.6-50&t=6&p=4`).
Ao carregar com querystring, o simulador reconstrói o estado. Sem estado na URL, abre no
preset de churrasco. `history.replaceState` ao mexer nos controles — sem poluir o
histórico do navegador.

---

## 6. Testes (vitest, só em `modelo.ts`)

1. Farofa vazia (só farinha) → veredito "seca e sem graça", `G = 0`.
2. Preset de churrasco → veredito "no ponto".
3. 300 g de farinha + 300 g de ovo → `U` alto → "isso virou pirão".
4. Tostagem 10 → `Q > 0` → "queimou".
5. Sal 30 g em 300 g de farinha → "salgada demais".
6. Monotonicidade: subir tostagem com o resto fixo nunca aumenta `U`.
7. Monotonicidade: subir castanha com o resto fixo nunca diminui `C`.
8. `url.ts`: `decode(encode(estado))` devolve o estado idêntico, para os 5 presets.

---

## 7. Fora de escopo nesta versão

- **Ordem de preparo no cálculo.** Tostar a farinha antes ou depois da gordura muda o
  resultado na vida real, mas dobra a superfície do modelo. Fica para a v2.
- Ingrediente livre digitado pela pessoa.
- Salvar farofas (exige backend ou localStorage; o link já resolve o compartilhamento).
- Imagem de OG dinâmica por farofa.

---

## 8. Critérios de aceite

- [ ] Mexer em qualquer controle atualiza o resultado sem recarregar e sem travar.
- [ ] Os 5 presets produzem vereditos coerentes (nenhum "pirão" ou "queimou").
- [ ] O link copiado, aberto em aba anônima, reproduz exatamente a mesma farofa.
- [ ] A receita escalada para 10 pessoas mantém as proporções da de 2 pessoas.
- [ ] `modelo.ts` não importa React e passa nos 8 testes.
- [ ] Funciona com teclado e em tela de 360 px de largura.
- [ ] Lighthouse: performance e acessibilidade acima de 90.

---

## 9. Ordem de execução sugerida

1. `ingredientes.ts` + `modelo.ts` + `modelo.test.ts` — modelo fechado e testado **antes**
   de qualquer pixel. É aqui que o experimento dá certo ou errado.
2. Calibrar as constantes rodando os presets até os vereditos baterem com o esperado.
3. `SimuladorFarofa.tsx` com os controles e o card de veredito.
4. O plano umidade × crocância e as barras de faixa.
5. Receita, modo de preparo e `url.ts`.
6. Responsivo, teclado, polimento.
