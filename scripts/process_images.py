"""Gera as imagens do site a partir dos originais em inovacar-assets/.

- Os originais nunca são alterados.
- As matrículas são desfocadas nas cópias (caixas em fração da largura/altura).
- Cada foto sai em WebP com 800 e 1600 px de largura para public/images/.
- Se a foto real faltar, usa a imagem de stock provisória de stock-assets/ e marca-a como ilustrativa.
- Escreve src/data/image-manifest.json com as dimensões e a origem de cada imagem.

Uso: python3 scripts/process_images.py
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "inovacar-assets"
STOCK = ROOT / "stock-assets"
OUT = ROOT / "public" / "images"
MANIFEST = ROOT / "src" / "data" / "image-manifest.json"
FONTS = ROOT / "node_modules" / "@fontsource" / "barlow-semi-condensed" / "files"

# Caixas (x0, y0, x1, y1) em fração da imagem, por cima de cada matrícula legível nas fotos reais.
PHOTOS = {
    "zonaTrabalho": {
        "real": "google-maps-02.jpg",
        "stock": "hero-ferramentas.jpg",
        "out": "oficina-zona-trabalho",
        "blur": [
            (0.108, 0.552, 0.188, 0.590),
            (0.385, 0.700, 0.466, 0.743),
            (0.755, 0.690, 0.846, 0.735),
        ],
    },
    "interior": {
        "real": "google-maps-01.jpg",
        "stock": "mecanico-oficina.jpg",
        "out": "oficina-interior",
        "blur": [
            (0.514, 0.610, 0.608, 0.650),
            (0.895, 0.650, 0.950, 0.695),
        ],
    },
    "ferrari": {
        "real": "google-maps-03.jpg",
        "stock": "maos-chave.jpg",
        "out": "oficina-ferrari",
        "blur": [
            (0.300, 0.835, 0.645, 0.905),
            (0.100, 0.350, 0.155, 0.385),
        ],
    },
    "maserati": {"real": "google-maps-04.jpg", "stock": "mecanico-capo.jpg", "out": "oficina-maserati", "blur": []},
    # Fotos só de stock, para as páginas de serviço, até existirem fotos reais.
    "oleo": {"real": "servico-oleo.jpg", "stock": "mudanca-oleo.jpg", "out": "servico-oleo", "blur": []},
    "roda": {"real": "servico-travoes.jpg", "stock": "roda-aperto.jpg", "out": "servico-travoes", "blur": []},
    "motor": {"real": "servico-motor.jpg", "stock": "motor-correias.jpg", "out": "servico-motor", "blur": []},
}

WIDTHS = (800, 1600)


def blur_boxes(img: Image.Image, boxes):
    w, h = img.size
    for x0, y0, x1, y1 in boxes:
        box = (int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))
        region = img.crop(box)
        radius = max(6, (box[2] - box[0]) // 8)
        img.paste(region.filter(ImageFilter.GaussianBlur(radius)), box)
    return img


def save_sizes(img: Image.Image, name: str):
    for width in WIDTHS:
        copy = img.copy()
        if copy.width > width:
            copy = copy.resize((width, round(copy.height * width / copy.width)), Image.LANCZOS)
        copy.save(OUT / f"{name}-{width}.webp", "WEBP", quality=80, method=6)


def provisional_logo() -> Image.Image:
    """Logótipo provisório em texto simples, só até existir o ficheiro real. Não imita a arte original."""
    img = Image.new("RGB", (1560, 950), (38, 41, 60))
    d = ImageDraw.Draw(img)
    big = ImageFont.truetype(str(FONTS / "barlow-semi-condensed-latin-700-normal.woff"), 300)
    small = ImageFont.truetype(str(FONTS / "barlow-semi-condensed-latin-600-normal.woff"), 96)
    for text, font, y in (("INOVACAR", big, 250), ("OFICINA AUTOMÓVEL", small, 600)):
        w = d.textlength(text, font=font)
        d.text(((1560 - w) / 2, y), text, font=font, fill=(54, 179, 175))
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, cfg in PHOTOS.items():
        real = SRC / cfg["real"]
        if real.exists():
            img = blur_boxes(Image.open(real).convert("RGB"), cfg["blur"])
            origin = "real"
        else:
            img = Image.open(STOCK / cfg["stock"]).convert("RGB")
            origin = "stock"
        save_sizes(img, cfg["out"])
        manifest[key] = {"width": img.width, "height": img.height, "stock": origin == "stock"}
        print(f"  {key}: {origin} {img.width}x{img.height}")

    logo = SRC / "logo-inovacar-referencia.png"
    if logo.exists():
        img = Image.open(logo).convert("RGB")
        manifest["logo"] = {"width": img.width, "height": img.height, "stock": False}
    else:
        print("! logótipo em falta, a gerar provisório em texto")
        img = provisional_logo()
        manifest["logo"] = {"width": img.width, "height": img.height, "stock": True}
    for width in (240, 480):
        copy = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        copy.save(OUT / f"logo-inovacar-{width}.png", "PNG", optimize=True)
        copy.save(OUT / f"logo-inovacar-{width}.webp", "WEBP", quality=90, method=6)

    # Imagem para partilha (1200x630) a partir da foto do hero.
    og = Image.open(OUT / "oficina-zona-trabalho-1600.webp").convert("RGB")
    h = round(og.width / (1200 / 630))
    top = max(0, (og.height - h) // 2)
    og.crop((0, top, og.width, top + h)).resize((1200, 630), Image.LANCZOS).save(OUT / "og-inovacar.jpg", "JPEG", quality=82)

    # Favicon a partir do logótipo (fundo escuro da marca).
    fav = Image.new("RGB", (64, 64), (38, 41, 60))
    ImageDraw.Draw(fav).text((14, 6), "I", font=ImageFont.truetype(str(FONTS / "barlow-semi-condensed-latin-700-normal.woff"), 52), fill=(54, 179, 175))
    fav.save(ROOT / "public" / "favicon.png")

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("feito")


if __name__ == "__main__":
    main()
