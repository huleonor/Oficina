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
| Mapa, links do Google, vídeo do portão | `src/data/business.ts` |
| Serviços (8) | `src/content/servicos/*.md` |
| Trabalhos antes/depois | `src/content/projetos/*.md` |
| Domínio final | variável `SITE_URL` (ver `astro.config.mjs`) |
| Programa de pontos (API) | `PUBLIC_PONTOS_API` em `.env` — ver [sheets/README.md](sheets/README.md) |

### Programa de pontos

Página pública em `/pontos/`: o cliente consulta saldo e histórico com o telemóvel.
A oficina gere clientes, gastos, indicações e resgates num **Google Sheet**;
o site fala com um Apps Script Web App (nunca com a folha em público).

1. Siga [sheets/README.md](sheets/README.md) para criar a folha e publicar o Web App.
2. Copie `.env.example` para `.env` e ponha o URL em `PUBLIC_PONTOS_API`.
3. Reinicie `npm run dev`. Sem a variável, a página mostra o catálogo e avisa que a consulta ainda não está ligada.

Regra base: **1 € = 1 ponto**. Custo alvo da oficina: **~5%** (0,05 € por ponto).
Indicação: **300 pontos** (~15 €). Detalhe em [sheets/ECONOMIA.md](sheets/ECONOMIA.md).
Resgates só na oficina (a página é só de consulta).

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

Quem tem "reduzir movimento" ativo no sistema vê só a imagem de capa.
