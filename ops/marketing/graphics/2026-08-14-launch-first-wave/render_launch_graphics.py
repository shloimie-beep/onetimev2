#!/usr/bin/env python3
"""Render the bounded launch-first-wave feed graphics from approved sources.

The source folder is intentionally external to the repository. Google Drive
remains the binary source of truth; SHA-256 checks prevent accidental source
substitution. The script performs only deterministic crop, resize, tonal
treatment, logo placement, and typography. It does not generate or alter a
person.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont


WIDTH = 1080
HEIGHT = 1350
NEAR_BLACK = "#050505"
YELLOW = "#FFD21F"
WHITE = "#FFFFFF"
CYAN = "#059ED1"

SOURCE_FILES = {
    "photo": (
        "rabbi-teaching-vertical-01.jpeg",
        "1e504b0e9be675e668560d225d2886aee9927ec6667aa2033fbe853fe3d80447",
    ),
    "logo": (
        "onetimelogo-white.webp",
        "6b534dde8625b991cc9ef5e244190de950599718f35113825ab8c4c241edf441",
    ),
    "headline_font": (
        "DMSerifDisplay-Regular.ttf",
        "8cc3643535edf039aa5d95440a8542735e9197e4f4b8d9303e980fefbf5ab616",
    ),
    "utility_font": (
        "Montserrat-VariableFont_wght.ttf",
        "0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7",
    ),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_sources(source_dir: Path) -> dict[str, Path]:
    resolved: dict[str, Path] = {}
    for role, (filename, expected_sha) in SOURCE_FILES.items():
        path = source_dir / filename
        if not path.is_file():
            raise SystemExit(f"Missing required {role}: {path}")
        actual_sha = sha256(path)
        if actual_sha != expected_sha:
            raise SystemExit(
                f"SHA-256 mismatch for {path.name}: expected {expected_sha}, got {actual_sha}"
            )
        resolved[role] = path
    return resolved


def cover_crop(
    image: Image.Image,
    size: tuple[int, int],
    *,
    center_x: float = 0.5,
    center_y: float = 0.5,
) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = round((resized.width - target_width) * center_x)
    top = round((resized.height - target_height) * center_y)
    left = max(0, min(left, resized.width - target_width))
    top = max(0, min(top, resized.height - target_height))
    return resized.crop((left, top, left + target_width, top + target_height))


def prepare_photo(photo: Image.Image, size: tuple[int, int], **crop: float) -> Image.Image:
    prepared = cover_crop(photo, size, **crop).convert("RGB")
    prepared = ImageEnhance.Color(prepared).enhance(0.90)
    return ImageEnhance.Brightness(prepared).enhance(0.88)


def horizontal_gradient(
    size: tuple[int, int], start_alpha: int, end_alpha: int
) -> Image.Image:
    width, height = size
    gradient = Image.new("L", (width, 1))
    gradient.putdata(
        [
            round(start_alpha + (end_alpha - start_alpha) * x / max(width - 1, 1))
            for x in range(width)
        ]
    )
    gradient = gradient.resize((width, height))
    overlay = Image.new("RGBA", size, NEAR_BLACK)
    overlay.putalpha(gradient)
    return overlay


def vertical_gradient(
    size: tuple[int, int], start_alpha: int, end_alpha: int
) -> Image.Image:
    width, height = size
    gradient = Image.new("L", (1, height))
    gradient.putdata(
        [
            round(start_alpha + (end_alpha - start_alpha) * y / max(height - 1, 1))
            for y in range(height)
        ]
    )
    gradient = gradient.resize((width, height))
    overlay = Image.new("RGBA", size, NEAR_BLACK)
    overlay.putalpha(gradient)
    return overlay


def font(path: Path, size: int, *, weight: int | None = None) -> ImageFont.FreeTypeFont:
    loaded = ImageFont.truetype(str(path), size=size)
    if weight is not None:
        try:
            loaded.set_variation_by_axes([float(weight)])
        except (AttributeError, OSError, ValueError):
            pass
    return loaded


def place_logo(canvas: Image.Image, logo: Image.Image, x: int, y: int, size: int) -> None:
    mark = logo.copy().convert("RGBA")
    mark.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, (x, y))


def draw_spaced_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    *,
    font_value: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int,
) -> None:
    x, y = xy
    for character in value:
        draw.text((x, y), character, font=font_value, fill=fill)
        box = draw.textbbox((x, y), character, font=font_value)
        x = box[2] + spacing


def render_cp001(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), NEAR_BLACK)
    panel_x = 390
    panel_width = WIDTH - panel_x
    panel = prepare_photo(photo, (panel_width, HEIGHT), center_x=0.52, center_y=0.50)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((610, HEIGHT), 250, 18), (panel_x, 0))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 438, HEIGHT), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((245, HEIGHT), 248, 0), (438, 0))
    draw.rectangle((74, 265, 80, 718), fill=YELLOW)
    place_logo(canvas, logo, 74, 48, 138)

    eyebrow = font(utility_font, 21, weight=700)
    detail = font(utility_font, 27, weight=700)
    utility = font(utility_font, 24, weight=650)
    utility_small = font(utility_font, 24, weight=600)
    button = font(utility_font, 28, weight=750)
    headline = font(headline_font, 82)
    headline_emphasis = font(headline_font, 91)

    draw_spaced_text(
        draw,
        (82, 201),
        "LIVE MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=1,
    )
    draw.text((82, 231), "WITH RABBI ELI SCHELLER", font=utility_small, fill=WHITE)

    draw.text((96, 307), "CLASSES", font=headline, fill=WHITE)
    draw.text((96, 393), "START", font=headline, fill=WHITE)
    draw.text((96, 480), "SUNDAY", font=headline_emphasis, fill=YELLOW)

    draw.text((96, 625), "AUG 16  ·  7 PM ISRAEL", font=detail, fill=WHITE)
    draw.text((96, 669), "LIVE ONLINE", font=utility, fill="#C7D2D9")

    button_box = (96, 787, 412, 863)
    draw.rounded_rectangle(button_box, radius=36, fill=YELLOW)
    button_text = "GET FREE ACCESS"
    button_bounds = draw.textbbox((0, 0), button_text, font=button)
    button_width = button_bounds[2] - button_bounds[0]
    button_height = button_bounds[3] - button_bounds[1]
    draw.text(
        (
            button_box[0] + (button_box[2] - button_box[0] - button_width) / 2,
            button_box[1] + (button_box[3] - button_box[1] - button_height) / 2 - 3,
        ),
        button_text,
        font=button,
        fill=NEAR_BLACK,
    )

    draw.text((96, 896), "No card required", font=utility_small, fill=WHITE)
    draw.text((96, 928), "Free through Sept 11", font=utility_small, fill=WHITE)
    draw.text((96, 1264), "join.onetimeonetime.com", font=utility_small, fill="#DCE4E8")
    return canvas


def render_cp002(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> Image.Image:
    canvas = prepare_photo(photo, (WIDTH, HEIGHT), center_x=0.49, center_y=0.34).convert("RGBA")
    canvas.alpha_composite(vertical_gradient((WIDTH, 910), 0, 250), (0, 440))
    canvas.alpha_composite(horizontal_gradient((650, HEIGHT), 86, 0), (0, 0))
    place_logo(canvas, logo, 74, 42, 142)
    draw = ImageDraw.Draw(canvas)

    eyebrow = font(utility_font, 24, weight=700)
    headline = font(headline_font, 104)
    headline_emphasis = font(headline_font, 119)
    support = font(utility_font, 30, weight=650)
    utility = font(utility_font, 25, weight=700)
    utility_small = font(utility_font, 24, weight=600)

    draw_spaced_text(
        draw,
        (76, 730),
        "ONE TIME MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=2,
    )
    draw.text((72, 765), "GET FREE", font=headline, fill=WHITE)
    draw.text((72, 864), "ACCESS", font=headline_emphasis, fill=YELLOW)
    draw.text((76, 1013), "Live from Eretz Yisrael.", font=support, fill=WHITE)
    draw.text((76, 1057), "One perek each class day.", font=support, fill=WHITE)
    draw.rectangle((76, 1121, 1004, 1124), fill="#324047")
    draw.text((76, 1150), "SUNDAY–THURSDAY  ·  7 PM ISRAEL", font=utility, fill=WHITE)
    draw.text((76, 1199), "No card required  ·  Free through Sept 11", font=utility_small, fill="#DCE4E8")
    draw.text((76, 1265), "join.onetimeonetime.com", font=utility_small, fill=WHITE)
    return canvas


def save_png(image: Image.Image, path: Path) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="PNG", optimize=True)
    return {
        "filename": path.name,
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def build_contact_sheet_with_labels(
    outputs: list[Path], target: Path, utility_font: Path
) -> dict[str, object]:
    sheet = Image.new("RGB", (1880, 1260), "#E8ECEE")
    draw = ImageDraw.Draw(sheet)
    title_font = font(utility_font, 27, weight=750)
    label_font = font(utility_font, 19, weight=600)
    draw.text((150, 42), "ONE TIME — LAUNCH FIRST-WAVE REVIEW", font=title_font, fill="#111820")
    preview_width, preview_height = 720, 900
    x_positions = (150, 1010)
    labels = ("OTM-CP-001 · CLASSES START SUNDAY", "OTM-CP-002 · GET FREE ACCESS")
    for index, output in enumerate(outputs):
        preview = Image.open(output).convert("RGB").resize(
            (preview_width, preview_height), Image.Resampling.LANCZOS
        )
        sheet.paste(preview, (x_positions[index], 110))
        draw.text((x_positions[index], 1034), labels[index], font=label_font, fill="#111820")
        draw.text(
            (x_positions[index], 1072),
            "1080×1350 feed draft · final review · not scheduled",
            font=label_font,
            fill="#495761",
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, format="PNG", optimize=True)
    return {
        "filename": target.name,
        "width": sheet.width,
        "height": sheet.height,
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "renders",
    )
    args = parser.parse_args()

    sources = require_sources(args.source_dir.resolve())
    photo = Image.open(sources["photo"]).convert("RGB")
    logo = Image.open(sources["logo"]).convert("RGBA")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    output_paths = [
        args.output_dir / "OTM-CP-001-feed-1080x1350.png",
        args.output_dir / "OTM-CP-002-feed-1080x1350.png",
    ]
    rendered = [
        render_cp001(
            photo,
            logo,
            sources["headline_font"],
            sources["utility_font"],
        ),
        render_cp002(
            photo,
            logo,
            sources["headline_font"],
            sources["utility_font"],
        ),
    ]
    records = [save_png(image, path) for image, path in zip(rendered, output_paths)]
    contact_sheet = build_contact_sheet_with_labels(
        output_paths,
        args.output_dir.parent / "visual-proof" / "first-wave-contact-sheet.png",
        sources["utility_font"],
    )
    manifest = {
        "schema_version": 1,
        "source_hashes": {
            role: expected_sha for role, (_, expected_sha) in SOURCE_FILES.items()
        },
        "renders": records,
        "visual_proof": contact_sheet,
    }
    manifest_path = args.output_dir.parent / "render-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
