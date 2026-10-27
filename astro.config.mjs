// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// [DOMÍNIO A CONFIRMAR] Defina SITE_URL com o domínio final antes de publicar.
// Os URLs canónicos, o sitemap e o schema usam este valor.
const site = process.env.SITE_URL ?? 'https://inovacar.example';

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [sitemap()],
});
