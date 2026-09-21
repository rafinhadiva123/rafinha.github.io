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
    // Ajuste fino da borboleta na home. Sem isso, posição e cor saem do slug.
    borboleta: z
      .object({
        cor: z.string().optional(),
        x: z.number().min(0).max(100).optional(),
        y: z.number().min(0).max(100).optional(),
        tamanho: z.number().min(24).max(200).optional(),
      })
      .optional(),
  }),
})

export const collections = { experimentos }
