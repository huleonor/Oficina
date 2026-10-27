"""Gera as imagens do site a partir dos originais em inovacar-assets/.

- Os originais nunca são alterados.
- As matrículas são desfocadas nas cópias (caixas em fração da largura/altura).
- Cada foto sai em WebP com 800 e 1600 px de largura para public/images/.
- Se um original faltar, gera uma imagem provisória identificada, para o site compilar.

Uso: python3 scripts/process_images.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "inovacar-assets"
OUT = ROOT / "public" / "images"

# Caixas (x0, y0, x1, y1) em fração da imagem, por cima de cada matrícula legível.
PHOTOS = {
    "google-maps-02.jpg": {
        "out": "oficina-zona-trabalho",
        "blur": [
            (0.108, 0.552, 0.188, 0.590),
            (0.385, 0.700, 0.466, 0.743),
            (0.755, 0.690, 0.846, 0.735),
        ],
    },
    "google-maps-01.jpg": {
        "out": "oficina-interior",
        "blur": [
            (0.514, 0.610, 0.608, 0.650),
            (0.895, 0.650, 0.950, 0.695),
        ],
    },
    "google-maps-03.jpg": {
        "out": "oficina-ferrari",
        "blur": [
            (0.300, 0.835, 0.645, 0.905),
            (0.100, 0.350, 0.155, 0.385),
        ],
    },
    "google-maps-04.jpg": {"out": "oficina-maserati", "blur": []},
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


def standin(label: str, size=(1600, 1200)) -> Image.Image:
    img = Image.new("RGB", size, (58, 62, 79))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 42)
    except OSError:
        font = ImageFont.load_default()
    d.text((60, size[1] - 120), f"FOTO EM FALTA: {label}", fill=(201, 205, 216), font=font)
    return img


def save_sizes(img: Image.Image, name: str):
    for width in WIDTHS:
        copy = img.copy()
        if copy.width > width:
            copy = copy.resize((width, round(copy.height * width / copy.width)), Image.LANCZOS)
        copy.save(OUT / f"{name}-{width}.webp", "WEBP", quality=80, method=6)
    print(f"  {name}: {img.width}x{img.height}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for file, cfg in PHOTOS.items():
        path = SRC / file
        if path.exists():
            img = Image.open(path).convert("RGB")
            img = blur_boxes(img, cfg["blur"])
        else:
            print(f"! {file} em falta, a gerar provisória")
            img = standin(file, (1600, 2133) if file in ("google-maps-01.jpg", "google-maps-03.jpg") else (1600, 1200))
        save_sizes(img, cfg["out"])

    logo = SRC / "logo-inovacar-referencia.png"
    if logo.exists():
        img = Image.open(logo).convert("RGB")
    else:
        print("! logótipo em falta, a gerar provisório")
        img = Image.new("RGB", (1560, 950), (38, 41, 60))
        ImageDraw.Draw(img).rectangle((40, 40, 1520, 910), outline=(54, 179, 175), width=8)
    for width in (240, 480):
        copy = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        copy.save(OUT / f"logo-inovacar-{width}.png", "PNG", optimize=True)
        copy.save(OUT / f"logo-inovacar-{width}.webp", "WEBP", quality=90, method=6)
    # Imagem para partilha em redes sociais (1200x630) a partir da foto do hero.
    hero = OUT / "oficina-zona-trabalho-1600.webp"
    og = Image.open(hero).convert("RGB")
    ratio = 1200 / 630
    h = round(og.width / ratio)
    top = max(0, (og.height - h) // 2)
    og.crop((0, top, og.width, top + h)).resize((1200, 630), Image.LANCZOS).save(OUT / "og-inovacar.jpg", "JPEG", quality=82)
    print("feito")


if __name__ == "__main__":
    main()
