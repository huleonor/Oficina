import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const photoKey = z.enum(['zonaTrabalho', 'interior', 'ferrari', 'maserati', 'oleo', 'roda', 'motor']);

// Serviços: um ficheiro .md por serviço. O corpo do ficheiro é a descrição completa (texto rico).
const servicos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/servicos' }),
  schema: z.object({
    name: z.string(),
    shortDescription: z.string(),
    heroImage: photoKey,
    icon: z.enum(['oil', 'brake', 'diagnostic', 'battery', 'suspension', 'clutch', 'engine', 'inspection']),
    benefits: z.array(z.string()).min(3).max(5),
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).length(3),
    priceGuidance: z.string().default('Contacte-nos para um orçamento.'),
    seoTitle: z.string().max(65),
    seoDescription: z.string().max(160),
    featured: z.boolean().default(false),
    order: z.number(),
  }),
});

// Localidades: zonas de onde os clientes vêm. Não são filiais; a oficina é só uma, na R. da Paz.
const localidades = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/localidades' }),
  schema: z.object({
    city: z.string(),
    intro: z.string(),
    neighbourhoods: z.array(z.string()),
    driveTime: z.string(),
    mapEmbedUrl: z.string().default(''),
    heroImage: photoKey,
    seoTitle: z.string().max(65),
    seoDescription: z.string().max(160),
    order: z.number(),
  }),
});

// Trabalhos: só aparecem em público quando placeholder = false e há fotos antes/depois reais.
const projetos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projetos' }),
  schema: z.object({
    title: z.string(),
    beforePhoto: z.string().default(''),
    afterPhoto: z.string().default(''),
    story: z.string(),
    service: reference('servicos'),
    location: reference('localidades'),
    placeholder: z.boolean().default(true),
  }),
});

export const collections = { servicos, localidades, projetos };
