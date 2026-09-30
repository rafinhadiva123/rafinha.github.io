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
    // 'larga' solta o corpo da página até a largura do site (cenas grandes);
    // o texto corrido continua na largura de leitura.
    largura: z.enum(['leitura', 'larga']).default('leitura'),
  }),
})

export const collections = { experimentos }
