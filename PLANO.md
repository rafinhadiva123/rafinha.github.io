# rafinha.xyz — v0

Esqueleto do lab no ar: site publicado no domínio, com layout, home, `/sobre` e a
estrutura de experimentos pronta pra receber o primeiro.

**Escopo fechado:** nenhum experimento é implementado aqui. A v0 termina quando um push
na `main` publica automaticamente em `https://rafinha.xyz`. O simulador de farofa vem
depois, seguindo `spec-simulador-farofa.md`.

---

## 1. Stack

| Peça | Escolha |
|---|---|
| Framework | Astro 7 (última major) |
| Conteúdo | Content collections com `glob` loader + MDX |
| Ilhas interativas | React, só nas páginas de experimento |
| Estilo | CSS puro com custom properties — sem Tailwind, sem framework |
| Deploy | GitHub Actions → GitHub Pages |
| Node | LTS atual |

Decisão consciente de não usar framework de CSS: o site é pequeno, o conteúdo é técnico,
e tokens próprios em CSS puro evitam uma dependência que precisa de manutenção.

---

## 2. Scaffold

```bash
npm create astro@latest rafinha-xyz -- --template minimal --typescript strict
cd rafinha-xyz
npx astro add mdx react sitemap
git init && git add -A && git commit -m "scaffold"
```

Commitar o `package-lock.json` — a action oficial do Astro detecta o gerenciador de
pacotes pelo lockfile.

---

## 3. Configuração

### `astro.config.mjs`

```js
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://rafinha.xyz',
  // sem `base`: domínio próprio no apex
  integrations: [mdx(), react(), sitemap()],
})
```

### `public/CNAME`

Arquivo com uma única linha:

```
rafinha.xyz
```

> **Gotcha importante:** com deploy via Actions, o `CNAME` precisa estar em `public/`.
> Se ficar só configurado nas Settings do repositório, cada build sobrescreve o domínio
> e o site cai pra `*.github.io`.

### `src/content.config.ts`

```ts
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const experimentos = defineCollection({
  loader: glob({ base: './src/content/experimentos', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    titulo: z.string(),
    resumo: z.string().max(160),
    data: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    status: z.enum(['rascunho', 'publicado']).default('rascunho'),
    destaque: z.boolean().default(false),
  }),
})

export const collections = { experimentos }
```

O schema quebra o build se faltar campo — é de propósito. Erro na hora de escrever é
melhor que experimento publicado com metadado faltando.

---

## 4. Estrutura

```
public/
  CNAME
  fonts/
src/
  content.config.ts
  content/experimentos/
    exemplo.mdx                 rascunho, serve de referência de formato
  components/
    Cabecalho.astro
    Rodape.astro
    CardExperimento.astro
    AlternadorTema.astro
    labs/                       ilhas dos experimentos (vazio na v0)
  layouts/
    Base.astro                  <head>, meta, tema, cabeçalho, rodapé
    Experimento.astro           layout das páginas de experimento
  pages/
    index.astro
    sobre.astro
    experimentos/[...slug].astro
  styles/
    tokens.css
    global.css
.github/workflows/deploy.yml
```

---

## 5. Design

### `tokens.css`

Escuro por padrão, claro via `[data-tema="claro"]`. Um único conjunto de variáveis:

```css
:root {
  --fundo: #0f1115;
  --superficie: #171a21;
  --texto: #e6e8ec;
  --texto-suave: #9aa3b2;
  --borda: #262b36;
  --destaque: #7dd3a0;      /* cor de acento, usada com parcimônia */
  --fonte-texto: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fonte-mono: ui-monospace, 'SF Mono', Menlo, monospace;
  --largura-leitura: 68ch;
  --largura-pagina: 1100px;
  --raio: 10px;
  --espaco: 1rem;
}
```

Regras: largura de leitura contida em `--largura-leitura`; o acento só em links, foco e
estados ativos; contraste mínimo AA em ambos os temas; `prefers-reduced-motion`
respeitado. O tema escolhido persiste em `localStorage`, com script inline no `<head>`
pra não piscar branco no carregamento.

### Páginas

**`index.astro`** — nome, uma frase do que é o site, e o grid de experimentos.
`getCollection('experimentos')` filtrando `status === 'publicado'` em produção
(`import.meta.env.PROD`), ordenado por `data` decrescente. Rascunhos aparecem em dev.
Com o grid vazio, exibir uma linha honesta de "primeiro experimento a caminho" em vez de
espaço em branco.

**`sobre.astro`** — bio, stack, links. Conteúdo fica como placeholder; o texto é seu.

**`experimentos/[...slug].astro`** — `getStaticPaths()` sobre a collection, renderiza com
`render(entry)`, layout com título, data, tags e o corpo do MDX. É aqui que a ilha do
experimento é embutida, com `client:load`.

**`Base.astro`** — `<title>`, `description`, canonical, Open Graph, `lang="pt-BR"`.

---

## 6. Deploy

### `.github/workflows/deploy.yml`

```yaml
name: Deploy no GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: withastro/action@v6

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

### Passos manuais no repositório

1. Settings → Pages → **Source: GitHub Actions** (não "Deploy from a branch").
2. Push na `main` e conferir a action verde.
3. Confirmar que `rafinha.xyz` carrega o site.
4. Settings → Pages → marcar **Enforce HTTPS** (só aparece depois do certificado sair —
   pode levar algumas horas no primeiro deploy).

---

## 7. Critérios de aceite

- [ ] `npm run dev` sobe sem warning.
- [ ] `npm run build` passa; `npm run preview` mostra o site montado.
- [ ] Push na `main` publica sozinho, sem passo manual.
- [ ] `https://rafinha.xyz` e `https://www.rafinha.xyz` abrem o site com HTTPS válido.
- [ ] O `CNAME` sobrevive a dois deploys seguidos.
- [ ] Alternador de tema funciona, persiste e não pisca ao recarregar.
- [ ] `exemplo.mdx` em rascunho aparece em dev e **não** aparece no build de produção.
- [ ] Layout íntegro em 360 px de largura.
- [ ] Navegação completa por teclado, com foco visível.
- [ ] Lighthouse acima de 90 em performance e acessibilidade.

---

## 8. Ordem de execução

1. Scaffold, integrações, `astro.config.mjs`, `public/CNAME`.
2. Workflow de deploy — **subir o site praticamente vazio primeiro.** Deploy e DNS são a
   parte que dá errado; melhor descobrir com uma página de uma linha do que com o site
   pronto.
3. `tokens.css`, `global.css`, `Base.astro`, cabeçalho e rodapé.
4. `content.config.ts` + `exemplo.mdx` + `CardExperimento.astro`.
5. `index.astro` com o grid.
6. `experimentos/[...slug].astro` + `Experimento.astro`.
7. `sobre.astro`.
8. Alternador de tema, responsivo, acessibilidade, Lighthouse.

---

## 9. Depois da v0

Seguir `spec-simulador-farofa.md`. O primeiro experimento é o que valida o padrão
MDX + ilha de ponta a ponta — se ele encaixar sem gambiarra, a estrutura está certa.
