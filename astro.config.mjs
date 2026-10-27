// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Publicado no GitHub Pages em https://huleonor.github.io/Oficina/.
// Com um domínio próprio: SITE_URL=https://dominio.pt BASE_PATH=/ npm run build
const site = process.env.SITE_URL ?? 'https://huleonor.github.io';
const base = process.env.BASE_PATH ?? '/Oficina/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
});
