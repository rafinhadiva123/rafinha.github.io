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
