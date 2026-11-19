"""Extract slides + speaker notes from a .pptx into structured JSON.

Emits: lesson-framework/out/deck.json
Also copies slide media to: lesson-framework/out/media/
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Emu


def extract_shape_text(shape) -> str:
    if not shape.has_text_frame:
        return ""
    parts = []
    for para in shape.text_frame.paragraphs:
        line = "".join(run.text for run in para.runs)
        if line.strip():
            parts.append(line)
    return "\n".join(parts)


def extract_slide(slide, slide_idx: int, media_dir: Path) -> dict:
    title = ""
    body_parts: list[str] = []
    images: list[str] = []

    for shape in slide.shapes:
        if shape.has_text_frame:
            text = extract_shape_text(shape)
            if not text:
                continue
            if shape.is_placeholder and shape.placeholder_format.idx == 0:
                title = text
            elif not title and shape.is_placeholder and shape.placeholder_format.type in (13, 15):
                title = text
            else:
                body_parts.append(text)
        if shape.shape_type == 13:
            try:
                image = shape.image
                ext = image.ext
                fname = f"slide{slide_idx}_img{len(images) + 1}.{ext}"
                (media_dir / fname).write_bytes(image.blob)
                images.append(fname)
            except Exception:
                pass

    if not title and body_parts:
        title = body_parts[0].split("\n")[0][:80]

    notes = ""
    if slide.has_notes_slide:
        notes = slide.notes_slide.notes_text_frame.text or ""

    return {
        "index": slide_idx,
        "title": title.strip(),
        "body": "\n\n".join(body_parts).strip(),
        "notes": notes.strip(),
        "images": images,
    }


def main(pptx_path: str, out_dir: str) -> None:
    out = Path(out_dir)
    media = out / "media"
    out.mkdir(parents=True, exist_ok=True)
    media.mkdir(parents=True, exist_ok=True)

    prs = Presentation(pptx_path)
    slides = [extract_slide(s, i + 1, media) for i, s in enumerate(prs.slides)]

    deck = {
        "source": pptx_path,
        "slide_count": len(slides),
        "slides": slides,
    }

    (out / "deck.json").write_text(json.dumps(deck, indent=2, ensure_ascii=False))
    print(f"Wrote {len(slides)} slides → {out / 'deck.json'}")
    print(f"Media → {media}")


if __name__ == "__main__":
    pptx = sys.argv[1] if len(sys.argv) > 1 else \
        "/Users/robertpaszek/Desktop/Tilburg University/Deep Learning/Lecture Presentations/1 Multilayer Perceptrons.pptx"
    out = sys.argv[2] if len(sys.argv) > 2 else \
        "/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/lesson-framework/out"
    main(pptx, out)
