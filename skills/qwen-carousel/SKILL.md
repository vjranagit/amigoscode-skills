---
name: qwen-carousel
description: Use when asked to create a carousel (6-8 content slides) about a technical topic; fill the JSON content template and render it with scripts/make.sh, which owns layout, branding, slide numbers, link maps and fit checks.
---

# Qwen Carousel

`<out>` = the folder the user asked you to save into. Keep every file inside it.

1. Copy `templates/content.json` to `<out>/content.json`. Edit only that JSON; the script owns layout, slide numbers, cover, outro and the link map.
2. Fill it:
   - `title` ≤42 chars. The cover prints it in capitals, so write `API`, not `APIs`.
   - `slides`: 6-8 objects. Each has `title` ≤36, `description` ≤160 (1-2 sentences), and at least one of:
     - `rows`: 2-4 `["label ≤16", "value ≤48"]` pairs: numbers, comparisons, cause → effect.
     - `code`: one line ≤42 chars: a formula, notation or worked trace.
   - Write real symbols, not ASCII: → ≤ ≥ ≠ × ² ᵀ √ Σ ∞ σ ε Δ λ.
3. Density: one concept per slide, each with a concrete number or notation example. One slide is a worked example with real values. Every part named in the request gets a slide or a row.
4. Links: content slides are numbered 1, 2, 3… in order. A row links when its value says `slide N`, e.g. `["If it fails", "back to slide 2"]`. Add at least one loop back to an earlier slide, plus branches that skip ahead. Never link only to the next slide; the arrow already means next.
5. Accuracy: name the real cause of each effect; no absolute words ("replaces", "always") unless true; leave out any number you are unsure of.
6. Run exactly `scripts/make.sh <out>/content.json <out>`. Never copy or edit the script.
7. `"status":"fix"`: apply every listed fix to the JSON and rerun.
8. `"status":"rendered"`: answer every `review` question by re-reading content.json. Any "no": fix the JSON and rerun. All "yes": report the listed PNGs.

| Common failure | Fix |
| --- | --- |
| `carousel install missing` | Run `scripts/setup.sh`; do not substitute another renderer. |
| Invalid JSON | Keep the template's quotes, commas and brackets. |
