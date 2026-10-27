// Fotografias do site. Gerado por scripts/process_images.py: usa a foto real da oficina
// (Google Maps, uso autorizado, matrículas desfocadas) ou, se ainda não existir, uma imagem de stock
// identificada como ilustrativa (ver stock-assets/README.md).
import manifest from './image-manifest.json';

export type Photo = {
  base: string;
  width: number;
  height: number;
  alt: string;
  stock: boolean;
};

type Slot = { base: string; alt: string; stockAlt: string };

const slots = {
  zonaTrabalho: {
    base: '/images/oficina-zona-trabalho',
    alt: 'Zona de trabalho da INOVACAR com elevadores, ferramentas e três automóveis',
    stockAlt: 'Imagem ilustrativa: parede de ferramentas numa oficina automóvel',
  },
  interior: {
    base: '/images/oficina-interior',
    alt: 'Interior da oficina INOVACAR com uma autocaravana e um automóvel de capô aberto',
    stockAlt: 'Imagem ilustrativa: mecânico a trabalhar no motor de um automóvel',
  },
  ferrari: {
    base: '/images/oficina-ferrari',
    alt: 'Ferrari vermelho de capô aberto no interior da oficina',
    stockAlt: 'Imagem ilustrativa: mãos com uma chave de bocas junto a um motor',
  },
  maserati: {
    base: '/images/oficina-maserati',
    alt: 'Interior de um Maserati com a zona de trabalho da oficina ao fundo',
    stockAlt: 'Imagem ilustrativa: mecânico debaixo do capô aberto de um automóvel',
  },
  oleo: {
    base: '/images/servico-oleo',
    alt: 'Mudança de óleo na oficina INOVACAR',
    stockAlt: 'Imagem ilustrativa: óleo novo a ser deitado no motor',
  },
  roda: {
    base: '/images/servico-travoes',
    alt: 'Trabalho numa roda na oficina INOVACAR',
    stockAlt: 'Imagem ilustrativa: aperto dos parafusos de uma roda com máquina',
  },
  motor: {
    base: '/images/servico-motor',
    alt: 'Motor de um automóvel na oficina INOVACAR',
    stockAlt: 'Imagem ilustrativa: correias e polias de um motor',
  },
} satisfies Record<string, Slot>;

export type PhotoKey = keyof typeof slots;

const info = manifest as Record<string, { width: number; height: number; stock: boolean }>;

export const photos = Object.fromEntries(
  Object.entries(slots).map(([key, s]) => {
    const m = info[key];
    return [key, { base: s.base, width: m.width, height: m.height, stock: m.stock, alt: m.stock ? s.stockAlt : s.alt }];
  }),
) as Record<PhotoKey, Photo>;

export const anyStock = Object.values(photos).some((p) => p.stock);
export const logoIsProvisional = info.logo?.stock ?? true;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const srcset = (p: Photo) => `${base}${p.base}-800.webp 800w, ${base}${p.base}-1600.webp 1600w`;
export const src = (p: Photo, w: 800 | 1600 = 1600) => `${base}${p.base}-${w}.webp`;
