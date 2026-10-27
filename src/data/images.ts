// Fotografias reais da oficina (Google Maps, uso autorizado pelo proprietário).
// Os ficheiros são gerados por scripts/process_images.py com matrículas desfocadas.

export type Photo = {
  base: string;
  width: number;
  height: number;
  alt: string;
};

export const photos = {
  zonaTrabalho: {
    base: '/images/oficina-zona-trabalho',
    width: 1600,
    height: 1200,
    alt: 'Zona de trabalho da INOVACAR com elevadores, ferramentas e três automóveis',
  },
  interior: {
    base: '/images/oficina-interior',
    width: 1600,
    height: 2133,
    alt: 'Interior da oficina INOVACAR com uma autocaravana e um automóvel de capô aberto',
  },
  ferrari: {
    base: '/images/oficina-ferrari',
    width: 1600,
    height: 2133,
    alt: 'Ferrari vermelho de capô aberto no interior da oficina',
  },
  maserati: {
    base: '/images/oficina-maserati',
    width: 1600,
    height: 1200,
    alt: 'Interior de um Maserati com a zona de trabalho da oficina ao fundo',
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof photos;

export const srcset = (p: Photo) => `${p.base}-800.webp 800w, ${p.base}-1600.webp 1600w`;
export const src = (p: Photo, w: 800 | 1600 = 1600) => `${p.base}-${w}.webp`;
