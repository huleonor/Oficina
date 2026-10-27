# Site INOVACAR - Oficina Automóvel

Site estático em [Astro](https://astro.build), em português europeu.

## Comandos

```sh
npm install        # instalar dependências
npm run dev        # pré-visualização local em http://localhost:4321
npm run build      # gerar o site em dist/
npm run images     # gerar as imagens do site a partir de inovacar-assets/
```

`npm run images` precisa de Python 3 com Pillow (`pip install pillow`).

## Onde mudar o quê

| O quê | Ficheiro |
| --- | --- |
| Cores, tipografia, espaçamentos | `src/styles/global.css` (bloco `:root`) |
| Nome, telefone, morada, horário, email | `src/data/business.ts` |
| Widget de avaliações, mapa, avaliações coladas à mão | `src/data/business.ts` |
| Serviço do formulário (Formspree ou outro) | `formEndpoint` em `src/data/business.ts` |
| Serviços (8) | `src/content/servicos/*.md` |
| Trabalhos antes/depois | `src/content/projetos/*.md` |
| Domínio final | variável `SITE_URL` (ver `astro.config.mjs`) |

### Trabalhos (antes e depois)

Os três ficheiros em `src/content/projetos/` são exemplos com `placeholder: true` e não aparecem no site.
Para publicar um trabalho real: ponha as duas fotos em `public/images/`, preencha `beforePhoto`,
`afterPhoto` e `story`, e mude `placeholder` para `false`. A galeria antes/depois aparece na página
inicial assim que existir pelo menos um trabalho real.

### Imagens

Os originais ficam em `inovacar-assets/` e nunca são alterados. `npm run images` desfoca as matrículas
(coordenadas em `scripts/process_images.py`), cria as versões WebP em `public/images/` e a imagem de
partilha `og-inovacar.jpg`.

### Vídeo do portão

A entrada da página inicial mostra um vídeo do portão a abrir (toca uma vez, sem som). Para usar o vídeo da oficina:

1. Filme o portão a abrir (5 a 8 segundos, câmara fixa, sem pessoas nem matrículas).
2. Converta-o:
   `ffmpeg -i portao-original.mov -vf "scale=1600:-2" -an -c:v libx264 -crf 26 -movflags +faststart public/video/portao.mp4`
3. Substitua `public/video/portao.mp4` e crie a capa: `ffmpeg -i public/video/portao.mp4 -frames:v 1 public/video/portao-inicio.jpg`.

Quem tem "reduzir movimento" ativo no sistema vê só a foto, sem animação.
