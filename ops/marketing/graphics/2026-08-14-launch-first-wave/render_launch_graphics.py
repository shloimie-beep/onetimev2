#!/usr/bin/env python3
"""Render the bounded One Time launch graphics from approved source pixels.

Google Drive remains the source-media store. The renderer accepts only the
exact Rabbi-only photo, logo, and fonts recorded below, then performs crop,
resize, tonal treatment, gradients, typography, and logo placement. It never
generates, restores, retouches, or otherwise changes a person.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps


NEAR_BLACK = "#050505"
YELLOW = "#FFD21F"
WHITE = "#FFFFFF"
CYAN = "#059ED1"
COOL_GREY = "#DCE4E8"
SAFE_ZONE_RATIO = 0.07
SAFE_ZONE_PERCENT = 7

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


class ForegroundGeometry:
    """Capture bounds from the exact Pillow operations that draw foreground pixels."""

    def __init__(self) -> None:
        self.items: list[dict[str, object]] = []

    @staticmethod
    def union(
        bounds: list[tuple[int | float, int | float, int | float, int | float]],
    ) -> tuple[int, int, int, int]:
        if not bounds:
            raise ValueError("foreground geometry requires at least one bound")
        return (
            math.floor(min(bound[0] for bound in bounds)),
            math.floor(min(bound[1] for bound in bounds)),
            math.ceil(max(bound[2] for bound in bounds)),
            math.ceil(max(bound[3] for bound in bounds)),
        )

    def add(
        self,
        element_id: str,
        kind: str,
        bounds: tuple[int | float, int | float, int | float, int | float],
        measurement: str,
    ) -> None:
        if any(item["element_id"] == element_id for item in self.items):
            raise ValueError(f"duplicate foreground element_id: {element_id}")
        left, top, right, bottom = self.union([bounds])
        if right <= left or bottom <= top:
            raise ValueError(f"empty foreground geometry for {element_id}")
        self.items.append(
            {
                "element_id": element_id,
                "kind": kind,
                "measurement": measurement,
                "bounds": {
                    "left": left,
                    "top": top,
                    "right_exclusive": right,
                    "bottom_exclusive": bottom,
                },
            }
        )

    def combined_bounds(self) -> tuple[int, int, int, int]:
        return self.union(
            [
                (
                    int(item["bounds"]["left"]),
                    int(item["bounds"]["top"]),
                    int(item["bounds"]["right_exclusive"]),
                    int(item["bounds"]["bottom_exclusive"]),
                )
                for item in self.items
            ]
        )


def place_logo(
    canvas: Image.Image,
    logo: Image.Image,
    x: int,
    y: int,
    size: int,
    audit: ForegroundGeometry,
    element_id: str,
) -> None:
    mark = logo.copy().convert("RGBA")
    mark.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, (x, y))
    alpha_bounds = mark.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("logo has no visible alpha pixels")
    audit.add(
        element_id,
        "logo",
        (
            x + alpha_bounds[0],
            y + alpha_bounds[1],
            x + alpha_bounds[2],
            y + alpha_bounds[3],
        ),
        "resized_logo_alpha_bbox",
    )


def draw_foreground_text(
    draw: ImageDraw.ImageDraw,
    audit: ForegroundGeometry,
    element_id: str,
    xy: tuple[int, int],
    value: str,
    *,
    font_value: ImageFont.FreeTypeFont,
    fill: str,
) -> None:
    draw.text(xy, value, font=font_value, fill=fill)
    audit.add(
        element_id,
        "glyphs",
        draw.textbbox(xy, value, font=font_value),
        "pillow_textbbox",
    )


def draw_foreground_rectangle(
    draw: ImageDraw.ImageDraw,
    audit: ForegroundGeometry,
    element_id: str,
    box: tuple[int, int, int, int],
    *,
    fill: str,
) -> None:
    draw.rectangle(box, fill=fill)
    audit.add(
        element_id,
        "rule",
        (box[0], box[1], box[2] + 1, box[3] + 1),
        "pillow_rectangle_inclusive_to_exclusive",
    )


def draw_spaced_text(
    draw: ImageDraw.ImageDraw,
    audit: ForegroundGeometry,
    element_id: str,
    xy: tuple[int, int],
    value: str,
    *,
    font_value: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int,
) -> None:
    x, y = xy
    bounds: list[tuple[int, int, int, int]] = []
    for character in value:
        draw.text((x, y), character, font=font_value, fill=fill)
        box = draw.textbbox((x, y), character, font=font_value)
        bounds.append(box)
        x = box[2] + spacing
    audit.add(
        element_id,
        "glyphs",
        ForegroundGeometry.union(bounds),
        "union_of_pillow_character_textbbox",
    )


def draw_button(
    draw: ImageDraw.ImageDraw,
    audit: ForegroundGeometry,
    element_id: str,
    box: tuple[int, int, int, int],
    value: str,
    font_value: ImageFont.FreeTypeFont,
) -> None:
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=YELLOW)
    bounds = draw.textbbox((0, 0), value, font=font_value)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]
    text_xy = (
        box[0] + (box[2] - box[0] - text_width) / 2,
        box[1] + (box[3] - box[1] - text_height) / 2 - 3,
    )
    draw.text(text_xy, value, font=font_value, fill=NEAR_BLACK)
    audit.add(
        element_id,
        "cta",
        ForegroundGeometry.union(
            [
                (box[0], box[1], box[2] + 1, box[3] + 1),
                draw.textbbox(text_xy, value, font=font_value),
            ]
        ),
        "union_of_pillow_button_and_textbbox",
    )


def render_cp001_feed(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1080, 1350
    audit = ForegroundGeometry()
    canvas = Image.new("RGBA", (width, height), NEAR_BLACK)
    panel_x = 390
    panel = prepare_photo(photo, (width - panel_x, height), center_x=0.52, center_y=0.50)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((610, height), 250, 18), (panel_x, 0))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 438, height), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((245, height), 248, 0), (438, 0))
    draw_foreground_rectangle(
        draw, audit, "accent_rule", (84, 265, 90, 718), fill=YELLOW
    )
    place_logo(canvas, logo, 84, 96, 100, audit, "logo")

    eyebrow = font(utility_font, 21, weight=700)
    detail = font(utility_font, 27, weight=700)
    utility = font(utility_font, 24, weight=650)
    utility_small = font(utility_font, 24, weight=600)
    button = font(utility_font, 28, weight=750)
    headline = font(headline_font, 82)
    headline_emphasis = font(headline_font, 91)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (82, 201),
        "LIVE MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=1,
    )
    draw_foreground_text(
        draw,
        audit,
        "rabbi_name",
        (82, 231),
        "WITH RABBI ELI SCHELLER",
        font_value=utility_small,
        fill=WHITE,
    )
    draw_foreground_text(
        draw, audit, "headline_classes", (96, 307), "CLASSES", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw, audit, "headline_start", (96, 393), "START", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw,
        audit,
        "headline_sunday",
        (96, 480),
        "SUNDAY",
        font_value=headline_emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw,
        audit,
        "schedule",
        (96, 625),
        "AUG 16  \u00b7  7 PM ISRAEL",
        font_value=detail,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "live_label",
        (96, 669),
        "LIVE ONLINE",
        font_value=utility,
        fill="#C7D2D9",
    )
    draw_button(draw, audit, "cta", (96, 787, 412, 863), "GET FREE ACCESS", button)
    draw_foreground_text(
        draw,
        audit,
        "no_card",
        (96, 896),
        "No card required",
        font_value=utility_small,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "free_until",
        (96, 928),
        "Free through Sept 11",
        font_value=utility_small,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (96, 1218),
        "join.onetimeonetime.com",
        font_value=utility_small,
        fill=COOL_GREY,
    )
    return canvas, audit


def render_cp002_feed(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1080, 1350
    audit = ForegroundGeometry()
    canvas = prepare_photo(photo, (width, height), center_x=0.49, center_y=0.34).convert(
        "RGBA"
    )
    # All copy sits over an alpha >= 226 black treatment. Even a white source
    # pixel therefore preserves >= 4.5:1 contrast for the cyan eyebrow.
    canvas.alpha_composite(vertical_gradient((width, 670), 226, 252), (0, 680))
    canvas.alpha_composite(horizontal_gradient((650, height), 86, 0), (0, 0))
    place_logo(canvas, logo, 84, 96, 142, audit, "logo")
    draw = ImageDraw.Draw(canvas)

    eyebrow = font(utility_font, 24, weight=700)
    headline = font(headline_font, 104)
    headline_emphasis = font(headline_font, 119)
    support = font(utility_font, 30, weight=650)
    utility = font(utility_font, 25, weight=700)
    utility_small = font(utility_font, 24, weight=600)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (84, 730),
        "ONE TIME MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=2,
    )
    draw_foreground_text(
        draw, audit, "headline_get_free", (84, 765), "GET FREE", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw,
        audit,
        "headline_access",
        (84, 864),
        "ACCESS",
        font_value=headline_emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_live",
        (84, 1013),
        "Live from Eretz Yisrael.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_perek",
        (84, 1057),
        "One perek each class day.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_rectangle(
        draw, audit, "divider", (84, 1121, 996, 1124), fill="#536671"
    )
    draw_foreground_text(
        draw,
        audit,
        "schedule",
        (84, 1150),
        "SUNDAY\u2013THURSDAY  \u00b7  7 PM ISRAEL",
        font_value=utility,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "offer_detail",
        (84, 1186),
        "No card required  \u00b7  Free through Sept 11",
        font_value=utility_small,
        fill=COOL_GREY,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (84, 1218),
        "join.onetimeonetime.com",
        font_value=utility_small,
        fill=WHITE,
    )
    return canvas, audit


def render_cp001_story(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1080, 1920
    audit = ForegroundGeometry()
    canvas = Image.new("RGBA", (width, height), NEAR_BLACK)
    panel_x = 360
    panel = prepare_photo(photo, (width - panel_x, height), center_x=0.50, center_y=0.44)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((520, height), 250, 12), (panel_x, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 430, height), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((260, height), 248, 0), (430, 0))
    draw_foreground_rectangle(
        draw, audit, "accent_rule", (84, 395, 92, 1060), fill=YELLOW
    )
    place_logo(canvas, logo, 84, 144, 150, audit, "logo")

    eyebrow = font(utility_font, 23, weight=700)
    name = font(utility_font, 24, weight=650)
    headline = font(headline_font, 94)
    emphasis = font(headline_font, 106)
    detail = font(utility_font, 28, weight=700)
    small = font(utility_font, 25, weight=600)
    button = font(utility_font, 29, weight=750)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (96, 332),
        "LIVE MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=1,
    )
    draw_foreground_text(
        draw,
        audit,
        "rabbi_name",
        (96, 369),
        "WITH RABBI ELI SCHELLER",
        font_value=name,
        fill=WHITE,
    )
    draw_foreground_text(
        draw, audit, "headline_classes", (100, 455), "CLASSES", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw, audit, "headline_start", (100, 558), "START", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw,
        audit,
        "headline_sunday",
        (100, 662),
        "SUNDAY",
        font_value=emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw, audit, "date", (100, 820), "AUG 16", font_value=detail, fill=WHITE
    )
    draw_foreground_text(
        draw, audit, "time", (100, 861), "7 PM ISRAEL", font_value=detail, fill=WHITE
    )
    draw_button(draw, audit, "cta", (100, 1044, 430, 1125), "GET FREE ACCESS", button)
    draw_foreground_text(
        draw,
        audit,
        "no_card",
        (100, 1165),
        "No card required",
        font_value=small,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "free_until",
        (100, 1202),
        "Free through Sept 11",
        font_value=small,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (100, 1715),
        "join.onetimeonetime.com",
        font_value=small,
        fill=COOL_GREY,
    )
    return canvas, audit


def render_cp002_story(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1080, 1920
    audit = ForegroundGeometry()
    canvas = prepare_photo(photo, (width, height), center_x=0.49, center_y=0.34).convert(
        "RGBA"
    )
    canvas.alpha_composite(vertical_gradient((width, 1010), 226, 253), (0, 910))
    canvas.alpha_composite(horizontal_gradient((650, height), 82, 0), (0, 0))
    place_logo(canvas, logo, 84, 144, 150, audit, "logo")
    draw = ImageDraw.Draw(canvas)

    eyebrow = font(utility_font, 25, weight=700)
    headline = font(headline_font, 116)
    emphasis = font(headline_font, 132)
    support = font(utility_font, 31, weight=650)
    detail = font(utility_font, 26, weight=700)
    small = font(utility_font, 25, weight=600)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (84, 1060),
        "ONE TIME MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=2,
    )
    draw_foreground_text(
        draw, audit, "headline_get_free", (84, 1100), "GET FREE", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw,
        audit,
        "headline_access",
        (84, 1215),
        "ACCESS",
        font_value=emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_live",
        (84, 1380),
        "Live from Eretz Yisrael.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_perek",
        (84, 1427),
        "One perek each class day.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_rectangle(
        draw, audit, "divider", (84, 1497, 996, 1501), fill="#536671"
    )
    draw_foreground_text(
        draw,
        audit,
        "schedule",
        (84, 1532),
        "SUNDAY\u2013THURSDAY  \u00b7  7 PM ISRAEL",
        font_value=detail,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "offer_detail",
        (84, 1582),
        "No card required  \u00b7  Free through Sept 11",
        font_value=small,
        fill=COOL_GREY,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (84, 1717),
        "join.onetimeonetime.com",
        font_value=small,
        fill=WHITE,
    )
    return canvas, audit


def render_cp001_social_preview(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1200, 630
    audit = ForegroundGeometry()
    canvas = Image.new("RGBA", (width, height), NEAR_BLACK)
    panel_x = 520
    panel = prepare_photo(photo, (width - panel_x, height), center_x=0.52, center_y=0.35)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((330, height), 250, 5), (panel_x, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 560, height), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((180, height), 246, 0), (560, 0))
    place_logo(canvas, logo, 92, 52, 102, audit, "logo")

    eyebrow = font(utility_font, 18, weight=700)
    headline = font(headline_font, 62)
    emphasis = font(headline_font, 69)
    detail = font(utility_font, 22, weight=700)
    small = font(utility_font, 19, weight=600)
    button = font(utility_font, 21, weight=750)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (92, 170),
        "LIVE MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=1,
    )
    draw_foreground_text(
        draw,
        audit,
        "headline",
        (92, 204),
        "CLASSES START",
        font_value=headline,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "emphasis",
        (92, 266),
        "SUNDAY",
        font_value=emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw,
        audit,
        "schedule",
        (92, 358),
        "AUG 16  \u00b7  7 PM ISRAEL",
        font_value=detail,
        fill=WHITE,
    )
    draw_button(draw, audit, "cta", (92, 416, 342, 477), "GET FREE ACCESS", button)
    draw_foreground_text(
        draw,
        audit,
        "offer_detail",
        (92, 503),
        "No card required \u00b7 Free through Sept 11",
        font_value=small,
        fill=COOL_GREY,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (92, 548),
        "join.onetimeonetime.com",
        font_value=small,
        fill=WHITE,
    )
    return canvas, audit


def render_cp002_social_preview(
    photo: Image.Image,
    logo: Image.Image,
    headline_font: Path,
    utility_font: Path,
) -> tuple[Image.Image, ForegroundGeometry]:
    width, height = 1200, 630
    audit = ForegroundGeometry()
    canvas = Image.new("RGBA", (width, height), NEAR_BLACK)
    panel_x = 570
    panel = prepare_photo(photo, (width - panel_x, height), center_x=0.49, center_y=0.32)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((340, height), 250, 5), (panel_x, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 610, height), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((190, height), 246, 0), (610, 0))
    place_logo(canvas, logo, 92, 52, 102, audit, "logo")

    eyebrow = font(utility_font, 18, weight=700)
    headline = font(headline_font, 66)
    emphasis = font(headline_font, 74)
    support = font(utility_font, 23, weight=650)
    detail = font(utility_font, 20, weight=700)
    small = font(utility_font, 19, weight=600)

    draw_spaced_text(
        draw,
        audit,
        "eyebrow",
        (92, 166),
        "ONE TIME MISHNAYOS",
        font_value=eyebrow,
        fill=CYAN,
        spacing=1,
    )
    draw_foreground_text(
        draw, audit, "headline_get_free", (92, 202), "GET FREE", font_value=headline, fill=WHITE
    )
    draw_foreground_text(
        draw,
        audit,
        "headline_access",
        (92, 267),
        "ACCESS",
        font_value=emphasis,
        fill=YELLOW,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_live",
        (92, 358),
        "Live from Eretz Yisrael.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "support_perek",
        (92, 392),
        "One perek each class day.",
        font_value=support,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "schedule",
        (92, 450),
        "SUNDAY\u2013THURSDAY  \u00b7  7 PM ISRAEL",
        font_value=detail,
        fill=WHITE,
    )
    draw_foreground_text(
        draw,
        audit,
        "offer_detail",
        (92, 492),
        "No card required \u00b7 Free through Sept 11",
        font_value=small,
        fill=COOL_GREY,
    )
    draw_foreground_text(
        draw,
        audit,
        "url",
        (92, 548),
        "join.onetimeonetime.com",
        font_value=small,
        fill=WHITE,
    )
    return canvas, audit


def render_landing_desktop(
    photo: Image.Image,
) -> tuple[Image.Image, ForegroundGeometry | None]:
    """Text-free 1600x900 production handoff with a left HTML-copy safe zone."""
    width, height = 1600, 900
    canvas = Image.new("RGBA", (width, height), NEAR_BLACK)
    panel_x = 580
    panel = prepare_photo(photo, (width - panel_x, height), center_x=0.50, center_y=0.36)
    canvas.alpha_composite(panel.convert("RGBA"), (panel_x, 0))
    canvas.alpha_composite(horizontal_gradient((560, height), 252, 12), (panel_x, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 650, height), fill=NEAR_BLACK)
    canvas.alpha_composite(horizontal_gradient((300, height), 250, 0), (650, 0))
    return canvas, None


def render_landing_mobile(
    photo: Image.Image,
) -> tuple[Image.Image, ForegroundGeometry | None]:
    """Text-free 1080x1600 production handoff with a lower HTML-copy safe zone."""
    width, height = 1080, 1600
    canvas = prepare_photo(photo, (width, height), center_x=0.49, center_y=0.28).convert(
        "RGBA"
    )
    canvas.alpha_composite(vertical_gradient((width, 910), 20, 252), (0, 690))
    canvas.alpha_composite(vertical_gradient((width, 300), 155, 0), (0, 0))
    return canvas, None


def save_png(
    image: Image.Image,
    path: Path,
    *,
    geometry: ForegroundGeometry | None,
    asset_id: str,
    concept_id: str | None,
    format_id: str,
) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, format="PNG", optimize=True)
    safe_x = (image.width * SAFE_ZONE_PERCENT + 99) // 100
    safe_y = (image.height * SAFE_ZONE_PERCENT + 99) // 100
    safe_zone: dict[str, object]
    if geometry is None:
        if concept_id is not None:
            raise ValueError(f"{asset_id}: copy-bearing render requires geometry")
        safe_zone = {
            "applicable": False,
            "ratio": SAFE_ZONE_RATIO,
            "geometry_source": "none_text_free",
            "reason": "text-free background; no logo, copy, CTA, rule, or URL",
        }
    else:
        if concept_id is None:
            raise ValueError(f"{asset_id}: text-free render must not declare foreground geometry")
        left, top, right, bottom = geometry.combined_bounds()
        item_records: list[dict[str, object]] = []
        for item in geometry.items:
            item_bounds = item["bounds"]
            edge_buffers = {
                "left": item_bounds["left"] - safe_x,
                "top": item_bounds["top"] - safe_y,
                "right": image.width - safe_x - item_bounds["right_exclusive"],
                "bottom": image.height - safe_y - item_bounds["bottom_exclusive"],
            }
            item_records.append(
                {
                    **item,
                    "edge_buffers_px": edge_buffers,
                    "minimum_buffer_px": min(edge_buffers.values()),
                    "pass": all(buffer >= 0 for buffer in edge_buffers.values()),
                }
            )
        safe_zone = {
            "applicable": True,
            "ratio": SAFE_ZONE_RATIO,
            "geometry_source": "pillow_operation_bboxes",
            "coordinate_convention": (
                "left/top inclusive; right_exclusive/bottom_exclusive"
            ),
            "inset_x_px": safe_x,
            "inset_y_px": safe_y,
            "foreground_item_count": len(item_records),
            "foreground_items": item_records,
            "minimum_buffer_px": min(
                item["minimum_buffer_px"] for item in item_records
            ),
            "foreground_bounds": {
                "left": left,
                "top": top,
                "right_exclusive": right,
                "bottom_exclusive": bottom,
            },
            "pass": (
                all(item["pass"] is True for item in item_records)
                and left >= safe_x
                and top >= safe_y
                and right <= image.width - safe_x
                and bottom <= image.height - safe_y
            ),
        }
    return {
        "asset_id": asset_id,
        "concept_id": concept_id,
        "format": format_id,
        "relative_path": f"renders/{path.name}",
        "filename": path.name,
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "safe_zone": safe_zone,
    }


def contain_preview(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    preview = image.convert("RGB").copy()
    preview.thumbnail(size, Image.Resampling.LANCZOS)
    return preview


def build_contact_sheet(
    outputs: list[dict[str, object]], target: Path, utility_font: Path
) -> dict[str, object]:
    width, height = 2460, 2580
    sheet = Image.new("RGB", (width, height), "#E8ECEE")
    draw = ImageDraw.Draw(sheet)
    title_font = font(utility_font, 32, weight=750)
    label_font = font(utility_font, 20, weight=700)
    detail_font = font(utility_font, 17, weight=600)
    draw.text((90, 52), "ONE TIME - LAUNCH GRAPHICS REVIEW", font=title_font, fill="#111820")
    draw.text(
        (90, 98),
        "Deterministic drafts - operator approval pending - not scheduled or published",
        font=detail_font,
        fill="#495761",
    )
    draw.text(
        (90, 126),
        "Cyan = 7% outer-edge guide; green = Pillow-measured foreground union",
        font=detail_font,
        fill="#495761",
    )

    cells = [
        (90, 170),
        (870, 170),
        (1650, 170),
        (90, 940),
        (870, 940),
        (1650, 940),
        (90, 1710),
        (870, 1710),
    ]
    for record, (x, y) in zip(outputs, cells):
        draw.rounded_rectangle((x, y, x + 700, y + 700), radius=24, fill="#FFFFFF")
        source_path = target.parent.parent / str(record["relative_path"])
        preview = contain_preview(Image.open(source_path), (620, 590))
        px = x + (700 - preview.width) // 2
        py = y + 26 + (570 - preview.height) // 2
        sheet.paste(preview, (px, py))
        label = str(record["asset_id"])
        if record["concept_id"]:
            label += f" - {record['concept_id']}"
        draw.text((x + 34, y + 612), label, font=label_font, fill="#111820")
        draw.text(
            (x + 34, y + 650),
            f"{record['format']} - {record['width']}x{record['height']}",
            font=detail_font,
            fill="#495761",
        )
        if record["safe_zone"]["applicable"]:
            inset_x = (preview.width * SAFE_ZONE_PERCENT + 99) // 100
            inset_y = (preview.height * SAFE_ZONE_PERCENT + 99) // 100
            draw.rectangle(
                (
                    px + inset_x,
                    py + inset_y,
                    px + preview.width - inset_x,
                    py + preview.height - inset_y,
                ),
                outline="#00A7C7",
                width=2,
            )
            bounds = record["safe_zone"]["foreground_bounds"]
            scale_x = preview.width / record["width"]
            scale_y = preview.height / record["height"]
            draw.rectangle(
                (
                    px + round(bounds["left"] * scale_x),
                    py + round(bounds["top"] * scale_y),
                    px + round(bounds["right_exclusive"] * scale_x),
                    py + round(bounds["bottom_exclusive"] * scale_y),
                ),
                outline="#24A56A",
                width=2,
            )
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, format="PNG", optimize=True)
    return {
        "relative_path": f"visual-proof/{target.name}",
        "filename": target.name,
        "width": width,
        "height": height,
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
    }


def build_phone_proof(
    story_paths: list[Path], landing_mobile_path: Path, target: Path, utility_font: Path
) -> dict[str, object]:
    width, height = 1800, 1450
    sheet = Image.new("RGB", (width, height), "#E8ECEE")
    draw = ImageDraw.Draw(sheet)
    title_font = font(utility_font, 31, weight=750)
    label_font = font(utility_font, 20, weight=700)
    detail_font = font(utility_font, 17, weight=600)
    draw.text((80, 50), "PHONE VISUAL PROOF", font=title_font, fill="#111820")
    draw.text(
        (80, 95),
        "Exact 390x844 content viewport - key copy remains inside the 7% asset safe zone",
        font=detail_font,
        fill="#495761",
    )

    previews = [
        (story_paths[0], "CP-001 STORY / REEL"),
        (story_paths[1], "CP-002 STORY / REEL"),
        (landing_mobile_path, "LANDING MOBILE BG"),
    ]
    x_positions = (80, 680, 1280)
    for index, ((path, label), x) in enumerate(zip(previews, x_positions)):
        outer = (x, 170, x + 440, 1154)
        draw.rounded_rectangle(outer, radius=56, fill="#090B0D")
        viewport_box = (x + 25, 240, x + 415, 1084)
        image = Image.open(path).convert("RGB")
        viewport_size = (
            viewport_box[2] - viewport_box[0],
            viewport_box[3] - viewport_box[1],
        )
        if index < 2:
            # Social apps preserve the 9:16 canvas inside taller phone screens;
            # model the resulting top/bottom app chrome rather than cropping copy.
            viewport = Image.new("RGB", viewport_size, NEAR_BLACK)
            contained = ImageOps.contain(
                image,
                viewport_size,
                method=Image.Resampling.LANCZOS,
            )
            viewport.paste(
                contained,
                (
                    (viewport_size[0] - contained.width) // 2,
                    (viewport_size[1] - contained.height) // 2,
                ),
            )
        else:
            viewport = ImageOps.fit(
                image,
                viewport_size,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
        mask = Image.new("L", viewport.size, 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle((0, 0, *viewport.size), radius=34, fill=255)
        sheet.paste(viewport, (viewport_box[0], viewport_box[1]), mask)
        draw.rounded_rectangle((x + 170, 188, x + 270, 202), radius=7, fill="#24282C")
        draw.rounded_rectangle((x + 160, 1112, x + 280, 1120), radius=4, fill="#5D646A")
        label_box = draw.textbbox((0, 0), label, font=label_font)
        label_width = label_box[2] - label_box[0]
        draw.text((x + (440 - label_width) / 2, 1195), label, font=label_font, fill="#111820")
        draw.text(
            (x + 58, 1238),
            "Draft only - no provider effect",
            font=detail_font,
            fill="#495761",
        )
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, format="PNG", optimize=True)
    return {
        "relative_path": f"visual-proof/{target.name}",
        "filename": target.name,
        "width": width,
        "height": height,
        "bytes": target.stat().st_size,
        "sha256": sha256(target),
        "content_viewport": {"width": 390, "height": 844},
    }


def relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [
        channel / 12.92
        if channel <= 0.04045
        else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(foreground: str, background: str) -> float:
    first = relative_luminance(foreground)
    second = relative_luminance(background)
    lighter, darker = max(first, second), min(first, second)
    return round((lighter + 0.05) / (darker + 0.05), 2)


def contrast_proof() -> dict[str, object]:
    # #272727 is the worst-case result of an all-white source pixel beneath the
    # minimum 220/255 black photo-copy overlay used by these layouts.
    pairs = [
        ("white_on_near_black", WHITE, NEAR_BLACK),
        ("yellow_on_near_black", YELLOW, NEAR_BLACK),
        ("cyan_on_near_black", CYAN, NEAR_BLACK),
        ("cool_grey_on_near_black", COOL_GREY, NEAR_BLACK),
        ("near_black_on_yellow_button", NEAR_BLACK, YELLOW),
        ("cyan_on_worst_case_photo_overlay", CYAN, "#272727"),
        ("white_on_worst_case_photo_overlay", WHITE, "#272727"),
        ("cool_grey_on_worst_case_photo_overlay", COOL_GREY, "#272727"),
    ]
    records = [
        {
            "pair": name,
            "foreground": foreground,
            "background": background,
            "ratio": contrast_ratio(foreground, background),
        }
        for name, foreground, background in pairs
    ]
    return {
        "standard": "WCAG 2.2 AA normal text",
        "minimum_required": 4.5,
        "minimum_measured": min(record["ratio"] for record in records),
        "pairs": records,
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

    render_jobs = [
        (
            "OTM-A000003",
            "OTM-CP-001",
            "feed_1080x1350",
            "OTM-CP-001-feed-1080x1350.png",
            render_cp001_feed(photo, logo, sources["headline_font"], sources["utility_font"]),
        ),
        (
            "OTM-A000005",
            "OTM-CP-001",
            "story_reel_1080x1920",
            "OTM-CP-001-story-reel-1080x1920.png",
            render_cp001_story(photo, logo, sources["headline_font"], sources["utility_font"]),
        ),
        (
            "OTM-A000007",
            "OTM-CP-001",
            "social_preview_1200x630",
            "OTM-CP-001-social-preview-1200x630.png",
            render_cp001_social_preview(
                photo, logo, sources["headline_font"], sources["utility_font"]
            ),
        ),
        (
            "OTM-A000004",
            "OTM-CP-002",
            "feed_1080x1350",
            "OTM-CP-002-feed-1080x1350.png",
            render_cp002_feed(photo, logo, sources["headline_font"], sources["utility_font"]),
        ),
        (
            "OTM-A000006",
            "OTM-CP-002",
            "story_reel_1080x1920",
            "OTM-CP-002-story-reel-1080x1920.png",
            render_cp002_story(photo, logo, sources["headline_font"], sources["utility_font"]),
        ),
        (
            "OTM-A000008",
            "OTM-CP-002",
            "social_preview_1200x630",
            "OTM-CP-002-social-preview-1200x630.png",
            render_cp002_social_preview(
                photo, logo, sources["headline_font"], sources["utility_font"]
            ),
        ),
        (
            "OTM-A000009",
            None,
            "landing_desktop_1600x900",
            "landing-hero-desktop-1600x900.png",
            render_landing_desktop(photo),
        ),
        (
            "OTM-A000010",
            None,
            "landing_mobile_1080x1600",
            "landing-hero-mobile-1080x1600.png",
            render_landing_mobile(photo),
        ),
    ]

    records: list[dict[str, object]] = []
    output_paths: dict[str, Path] = {}
    for asset_id, concept_id, format_id, filename, rendered in render_jobs:
        image, geometry = rendered
        path = args.output_dir / filename
        records.append(
            save_png(
                image,
                path,
                geometry=geometry,
                asset_id=asset_id,
                concept_id=concept_id,
                format_id=format_id,
            )
        )
        output_paths[asset_id] = path

    proof_dir = args.output_dir.parent / "visual-proof"
    contact_sheet = build_contact_sheet(
        records,
        proof_dir / "first-wave-contact-sheet.png",
        sources["utility_font"],
    )
    phone_proof = build_phone_proof(
        [output_paths["OTM-A000005"], output_paths["OTM-A000006"]],
        output_paths["OTM-A000010"],
        proof_dir / "first-wave-phone-proof.png",
        sources["utility_font"],
    )
    manifest = {
        "schema_version": 2,
        "authority": {
            "marketing_pr": 183,
            "marketing_base_sha": "595e38b2c53c7f9dd1b0018ae1954e42061f07f4",
            "product_pr": 131,
            "product_read_only_sha": "0ed5c3955892450d8985765d622d5fb7809b5c95",
        },
        "source_hashes": {
            role: expected_sha for role, (_, expected_sha) in SOURCE_FILES.items()
        },
        "renders": records,
        "visual_proof": {
            "contact_sheet": contact_sheet,
            "phone": phone_proof,
        },
        "contrast": contrast_proof(),
        "external_effects": {
            "drive_writes": 0,
            "canva_writes": 0,
            "provider_writes": 0,
            "publication_events": 0,
            "scheduled_events": 0,
            "spend_usd": 0,
        },
    }
    manifest_path = args.output_dir.parent / "render-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
