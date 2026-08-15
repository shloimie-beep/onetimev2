#!/usr/bin/env python3
"""Validate the bounded launch-graphics packet and deterministic outputs."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from PIL import Image


EXPECTED_RENDERS = {
    "OTM-A000003": ("OTM-CP-001", "feed_1080x1350", 1080, 1350),
    "OTM-A000005": ("OTM-CP-001", "story_reel_1080x1920", 1080, 1920),
    "OTM-A000007": ("OTM-CP-001", "social_preview_1200x630", 1200, 630),
    "OTM-A000004": ("OTM-CP-002", "feed_1080x1350", 1080, 1350),
    "OTM-A000006": ("OTM-CP-002", "story_reel_1080x1920", 1080, 1920),
    "OTM-A000008": ("OTM-CP-002", "social_preview_1200x630", 1200, 630),
    "OTM-A000009": (None, "landing_desktop_1600x900", 1600, 900),
    "OTM-A000010": (None, "landing_mobile_1080x1600", 1080, 1600),
}

EXPECTED_FOREGROUND_ELEMENTS = {
    "OTM-A000003": {
        "accent_rule": "rule",
        "logo": "logo",
        "eyebrow": "glyphs",
        "rabbi_name": "glyphs",
        "headline_classes": "glyphs",
        "headline_start": "glyphs",
        "headline_sunday": "glyphs",
        "schedule": "glyphs",
        "live_label": "glyphs",
        "cta": "cta",
        "no_card": "glyphs",
        "free_until": "glyphs",
        "url": "glyphs",
    },
    "OTM-A000004": {
        "logo": "logo",
        "eyebrow": "glyphs",
        "headline_get_free": "glyphs",
        "headline_access": "glyphs",
        "support_live": "glyphs",
        "support_perek": "glyphs",
        "divider": "rule",
        "schedule": "glyphs",
        "offer_detail": "glyphs",
        "url": "glyphs",
    },
    "OTM-A000005": {
        "accent_rule": "rule",
        "logo": "logo",
        "eyebrow": "glyphs",
        "rabbi_name": "glyphs",
        "headline_classes": "glyphs",
        "headline_start": "glyphs",
        "headline_sunday": "glyphs",
        "date": "glyphs",
        "time": "glyphs",
        "cta": "cta",
        "no_card": "glyphs",
        "free_until": "glyphs",
        "url": "glyphs",
    },
    "OTM-A000006": {
        "logo": "logo",
        "eyebrow": "glyphs",
        "headline_get_free": "glyphs",
        "headline_access": "glyphs",
        "support_live": "glyphs",
        "support_perek": "glyphs",
        "divider": "rule",
        "schedule": "glyphs",
        "offer_detail": "glyphs",
        "url": "glyphs",
    },
    "OTM-A000007": {
        "logo": "logo",
        "eyebrow": "glyphs",
        "headline": "glyphs",
        "emphasis": "glyphs",
        "schedule": "glyphs",
        "cta": "cta",
        "offer_detail": "glyphs",
        "url": "glyphs",
    },
    "OTM-A000008": {
        "logo": "logo",
        "eyebrow": "glyphs",
        "headline_get_free": "glyphs",
        "headline_access": "glyphs",
        "support_live": "glyphs",
        "support_perek": "glyphs",
        "schedule": "glyphs",
        "offer_detail": "glyphs",
        "url": "glyphs",
    },
}

EXPECTED_MEASUREMENTS = {
    "logo": {"resized_logo_alpha_bbox"},
    "rule": {"pillow_rectangle_inclusive_to_exclusive"},
    "cta": {"union_of_pillow_button_and_textbbox"},
    "glyphs": {"pillow_textbbox", "union_of_pillow_character_textbbox"},
}

EXPECTED_CREATIVE_ROWS = {
    "OTM-CR-202608-001-V01": ("OTM-A000003", "feed_4x5"),
    "OTM-CR-202608-001-V02": ("OTM-A000005", "story_reel_9x16"),
    "OTM-CR-202608-001-V03": ("OTM-A000007", "social_preview_1200x630"),
    "OTM-CR-202608-002-V01": ("OTM-A000004", "feed_4x5"),
    "OTM-CR-202608-002-V02": ("OTM-A000006", "story_reel_9x16"),
    "OTM-CR-202608-002-V03": ("OTM-A000008", "social_preview_1200x630"),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def proof_digest(manifest: dict[str, object]) -> dict[str, tuple[object, ...]]:
    digests: dict[str, tuple[object, ...]] = {}
    for record in manifest["renders"]:
        digests[str(record["relative_path"])] = (
            record["width"],
            record["height"],
            record["bytes"],
            record["sha256"],
            json.dumps(record["safe_zone"], sort_keys=True),
        )
    for record in manifest["visual_proof"].values():
        digests[str(record["relative_path"])] = (
            record["width"],
            record["height"],
            record["bytes"],
            record["sha256"],
            json.dumps(record.get("content_viewport"), sort_keys=True),
        )
    return digests


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--write-report", action="store_true")
    args = parser.parse_args()

    packet_dir = Path(__file__).resolve().parent
    registry_dir = packet_dir.parents[1] / "content-registry"
    manifest_path = packet_dir / "render-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    require(manifest["schema_version"] == 2, "render manifest schema_version must be 2")

    render_by_id = {record["asset_id"]: record for record in manifest["renders"]}
    require(set(render_by_id) == set(EXPECTED_RENDERS), "render asset set mismatch")
    for asset_id, (concept_id, format_id, width, height) in EXPECTED_RENDERS.items():
        record = render_by_id[asset_id]
        require(record["concept_id"] == concept_id, f"{asset_id}: concept mismatch")
        require(record["format"] == format_id, f"{asset_id}: format mismatch")
        require((record["width"], record["height"]) == (width, height), f"{asset_id}: dimensions mismatch")
        path = packet_dir / record["relative_path"]
        require(path.is_file(), f"{asset_id}: missing render")
        require(path.stat().st_size == record["bytes"], f"{asset_id}: byte count mismatch")
        require(sha256(path) == record["sha256"], f"{asset_id}: checksum mismatch")
        with Image.open(path) as image:
            require(image.size == (width, height), f"{asset_id}: image header mismatch")
            require(image.mode == "RGB", f"{asset_id}: expected RGB PNG")

        safe_zone = record.get("safe_zone")
        require(isinstance(safe_zone, dict), f"{asset_id}: missing safe-zone proof")
        require(safe_zone["ratio"] == 0.07, f"{asset_id}: safe-zone ratio must be 7%")
        if concept_id is None:
            require(
                safe_zone["applicable"] is False,
                f"{asset_id}: text-free landing render must mark safe zone not applicable",
            )
            require(
                safe_zone["geometry_source"] == "none_text_free",
                f"{asset_id}: text-free geometry source mismatch",
            )
            require(
                "foreground_bounds" not in safe_zone,
                f"{asset_id}: unexpected foreground bounds",
            )
        else:
            expected_x = (width * 7 + 99) // 100
            expected_y = (height * 7 + 99) // 100
            require(safe_zone["applicable"] is True, f"{asset_id}: safe zone must apply")
            require(
                safe_zone["geometry_source"] == "pillow_operation_bboxes",
                f"{asset_id}: geometry must come from Pillow operations",
            )
            require(
                safe_zone["coordinate_convention"]
                == "left/top inclusive; right_exclusive/bottom_exclusive",
                f"{asset_id}: coordinate convention mismatch",
            )
            require(safe_zone["inset_x_px"] == expected_x, f"{asset_id}: horizontal inset mismatch")
            require(safe_zone["inset_y_px"] == expected_y, f"{asset_id}: vertical inset mismatch")
            items = safe_zone["foreground_items"]
            require(
                safe_zone["foreground_item_count"] == len(items),
                f"{asset_id}: foreground item count mismatch",
            )
            item_by_id = {item["element_id"]: item for item in items}
            require(len(item_by_id) == len(items), f"{asset_id}: duplicate geometry element")
            expected_elements = EXPECTED_FOREGROUND_ELEMENTS[asset_id]
            require(
                set(item_by_id) == set(expected_elements),
                f"{asset_id}: foreground element coverage mismatch",
            )

            item_bounds: list[tuple[int, int, int, int]] = []
            item_minimum_buffers: list[int] = []
            for element_id, item in item_by_id.items():
                kind = item["kind"]
                require(
                    kind == expected_elements[element_id],
                    f"{asset_id}/{element_id}: geometry kind mismatch",
                )
                require(
                    item["measurement"] in EXPECTED_MEASUREMENTS[kind],
                    f"{asset_id}/{element_id}: geometry measurement mismatch",
                )
                bounds = item["bounds"]
                require(
                    set(bounds)
                    == {"left", "top", "right_exclusive", "bottom_exclusive"},
                    f"{asset_id}/{element_id}: geometry bound keys mismatch",
                )
                require(
                    all(type(value) is int for value in bounds.values()),
                    f"{asset_id}/{element_id}: geometry bounds must be integers",
                )
                require(
                    bounds["left"] < bounds["right_exclusive"]
                    and bounds["top"] < bounds["bottom_exclusive"],
                    f"{asset_id}/{element_id}: empty geometry bounds",
                )
                require(
                    bounds["left"] >= expected_x,
                    f"{asset_id}/{element_id}: exceeds left safe zone",
                )
                require(
                    bounds["top"] >= expected_y,
                    f"{asset_id}/{element_id}: exceeds top safe zone",
                )
                require(
                    bounds["right_exclusive"] <= width - expected_x,
                    f"{asset_id}/{element_id}: exceeds right safe zone",
                )
                require(
                    bounds["bottom_exclusive"] <= height - expected_y,
                    f"{asset_id}/{element_id}: exceeds bottom safe zone",
                )
                expected_buffers = {
                    "left": bounds["left"] - expected_x,
                    "top": bounds["top"] - expected_y,
                    "right": width - expected_x - bounds["right_exclusive"],
                    "bottom": height - expected_y - bounds["bottom_exclusive"],
                }
                require(
                    item["edge_buffers_px"] == expected_buffers,
                    f"{asset_id}/{element_id}: edge-buffer proof mismatch",
                )
                require(
                    item["minimum_buffer_px"] == min(expected_buffers.values()),
                    f"{asset_id}/{element_id}: minimum-buffer proof mismatch",
                )
                require(item["pass"] is True, f"{asset_id}/{element_id}: item proof failed")
                item_minimum_buffers.append(item["minimum_buffer_px"])
                item_bounds.append(
                    (
                        bounds["left"],
                        bounds["top"],
                        bounds["right_exclusive"],
                        bounds["bottom_exclusive"],
                    )
                )

            if asset_id == "OTM-A000004":
                require(
                    item_by_id["url"]["edge_buffers_px"]["bottom"] >= 8,
                    "OTM-A000004/url: requires at least 8px beyond the 7% bottom inset",
                )

            actual_union = {
                "left": min(bounds[0] for bounds in item_bounds),
                "top": min(bounds[1] for bounds in item_bounds),
                "right_exclusive": max(bounds[2] for bounds in item_bounds),
                "bottom_exclusive": max(bounds[3] for bounds in item_bounds),
            }
            require(
                safe_zone["foreground_bounds"] == actual_union,
                f"{asset_id}: declared foreground union does not match item geometry",
            )
            require(
                safe_zone["minimum_buffer_px"] == min(item_minimum_buffers),
                f"{asset_id}: safe-zone minimum buffer mismatch",
            )
            require(
                actual_union["left"] >= expected_x,
                f"{asset_id}: foreground union exceeds left safe zone",
            )
            require(
                actual_union["top"] >= expected_y,
                f"{asset_id}: foreground union exceeds top safe zone",
            )
            require(
                actual_union["right_exclusive"] <= width - expected_x,
                f"{asset_id}: foreground union exceeds right safe zone",
            )
            require(
                actual_union["bottom_exclusive"] <= height - expected_y,
                f"{asset_id}: foreground union exceeds bottom safe zone",
            )
            require(safe_zone["pass"] is True, f"{asset_id}: safe-zone proof failed")

    for record in manifest["visual_proof"].values():
        path = packet_dir / record["relative_path"]
        require(path.is_file(), f"missing visual proof: {path.name}")
        require(path.stat().st_size == record["bytes"], f"{path.name}: byte count mismatch")
        require(sha256(path) == record["sha256"], f"{path.name}: checksum mismatch")
        with Image.open(path) as image:
            require(image.size == (record["width"], record["height"]), f"{path.name}: dimensions mismatch")

    phone_proof = manifest["visual_proof"]["phone"]
    require(
        phone_proof.get("content_viewport") == {"width": 390, "height": 844},
        "phone proof content viewport must be exactly 390x844",
    )

    schema = json.loads((registry_dir / "content-asset.schema.json").read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    assets = [
        json.loads(line)
        for line in (registry_dir / "assets.ndjson").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    asset_by_id = {asset["asset_id"]: asset for asset in assets}
    require(len(asset_by_id) == len(assets), "duplicate asset_id in assets.ndjson")
    for asset in assets:
        errors = sorted(validator.iter_errors(asset), key=lambda error: list(error.path))
        require(not errors, f"{asset['asset_id']}: schema error: {errors[0].message if errors else ''}")

    for asset_id, record in render_by_id.items():
        require(asset_id in asset_by_id, f"{asset_id}: missing registry record")
        asset = asset_by_id[asset_id]
        require(asset["contains_student"] is False, f"{asset_id}: Student imagery forbidden")
        require(asset["contains_private_data"] is False, f"{asset_id}: private data forbidden")
        require(asset["contains_rabbi"] is True, f"{asset_id}: Rabbi source lineage missing")
        require(asset["workflow_state"] == "final_review", f"{asset_id}: must remain final_review")
        require((asset["width"], asset["height"]) == (record["width"], record["height"]), f"{asset_id}: registry dimensions mismatch")
        require(record["sha256"] in asset["notes"], f"{asset_id}: checksum missing from registry notes")

    with (packet_dir / "graphics-manifest.csv").open(encoding="utf-8", newline="") as handle:
        creative_rows = list(csv.DictReader(handle))
    creative_by_id = {row["creative_id"]: row for row in creative_rows}
    require(set(creative_by_id) == set(EXPECTED_CREATIVE_ROWS), "creative manifest row set mismatch")
    for creative_id, (asset_id, format_id) in EXPECTED_CREATIVE_ROWS.items():
        row = creative_by_id[creative_id]
        require(row["asset_id"] == asset_id, f"{creative_id}: asset mismatch")
        require(row["format"] == format_id, f"{creative_id}: format mismatch")
        require(row["workflow_state"] == "final_review", f"{creative_id}: workflow state mismatch")
        require(row["contains_student"] == "false", f"{creative_id}: Student imagery forbidden")
        require(row["contains_rabbi"] == "true", f"{creative_id}: Rabbi lineage missing")
        require(row["cta"] == "GET FREE ACCESS", f"{creative_id}: CTA drift")
        require(row["destination"] == "https://join.onetimeonetime.com", f"{creative_id}: destination drift")
        require(row["operator_approval"] == "pending", f"{creative_id}: approval must remain pending")

    packages_text = (registry_dir / "creative-packages.yaml").read_text(encoding="utf-8")
    for token in [
        "feed_1080x1350",
        "story_reel_1080x1920",
        "social_preview_1200x630",
        "landing_desktop_1600x900",
        "landing_mobile_1080x1600",
        *EXPECTED_RENDERS.keys(),
    ]:
        require(token in packages_text, f"creative-packages.yaml missing {token}")

    contrast = manifest["contrast"]
    require(contrast["minimum_required"] == 4.5, "contrast threshold drift")
    require(contrast["minimum_measured"] >= contrast["minimum_required"], "contrast proof failed")
    require(all(pair["ratio"] >= contrast["minimum_required"] for pair in contrast["pairs"]), "contrast pair failed")
    require(all(value == 0 for value in manifest["external_effects"].values()), "external effect recorded")

    with tempfile.TemporaryDirectory(prefix="ot-launch-graphics-") as temporary:
        temporary_path = Path(temporary)
        subprocess.run(
            [
                sys.executable,
                str(packet_dir / "render_launch_graphics.py"),
                "--source-dir",
                str(args.source_dir.resolve()),
                "--output-dir",
                str(temporary_path / "renders"),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        rerendered_manifest = json.loads(
            (temporary_path / "render-manifest.json").read_text(encoding="utf-8")
        )
        require(proof_digest(manifest) == proof_digest(rerendered_manifest), "deterministic rerender mismatch")

    report = {
        "schema_version": 1,
        "status": "pass",
        "render_count": len(render_by_id),
        "creative_count": len(creative_rows),
        "registry_asset_count": len(assets),
        "registry_schema": "content-asset.v1",
        "minimum_contrast_ratio": contrast["minimum_measured"],
        "safe_zone_ratio": 0.07,
        "safe_zone_renders_passed": 6,
        "pillow_geometry_items_asserted": sum(
            record["safe_zone"].get("foreground_item_count", 0)
            for record in render_by_id.values()
        ),
        "cp002_feed_url_bottom_buffer_px": next(
            item
            for item in render_by_id["OTM-A000004"]["safe_zone"][
                "foreground_items"
            ]
            if item["element_id"] == "url"
        )["edge_buffers_px"]["bottom"],
        "phone_content_viewport": "390x844",
        "deterministic_rerender": "byte_exact",
        "student_bearing_derivatives": 0,
        "publication_events": 0,
        "provider_writes": 0,
        "checks": [
            "source hashes",
            "render dimensions and checksums",
            "contact sheet and phone proof",
            "7% foreground safe zones",
            "Pillow-derived logo/glyph/CTA/rule geometry and exact unions",
            "CP002 feed URL bottom buffer beyond 7% inset",
            "exact 390x844 phone content viewport",
            "content asset JSON Schema",
            "creative manifest exact CTA and destination",
            "package registry linkage",
            "WCAG 2.2 AA contrast",
            "byte-exact deterministic rerender",
            "zero external effects",
        ],
    }
    if args.write_report:
        (packet_dir / "validation-report.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
        )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
