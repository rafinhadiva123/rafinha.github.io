// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://rafinha.xyz',
  // sem `base`: domínio próprio no apex
  integrations: [mdx(), react(), sitemap()],
});