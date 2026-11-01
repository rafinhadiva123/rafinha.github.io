// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://rafinha.xyz',
  // sem `base`: domínio próprio no apex
  integrations: [
    mdx(),
    react(),
    // a página de teste do escritório fica fora do sitemap
    sitemap({ filter: pagina => !pagina.includes('/labs/escritorio-teste') }),
  ],
});