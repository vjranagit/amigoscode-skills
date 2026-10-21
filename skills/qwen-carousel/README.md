# Qwen Carousel

A weak-model wrapper for local LLMs, tuned on qwen3.8-27b, that turns technical topics into linked, checked carousels using Amigoscode's carousel renderer.

## Install

From this skill directory, run `scripts/setup.sh`. It installs Playwright in the repository's `skills/carousel/scripts` dependency directory. CPU-only rendering is supported.

## Usage

Copy `templates/content.json` into your chosen output directory, fill in the requested topic, then run `scripts/make.sh <out>/content.json <out>`. Prompt pattern: “Use the qwen-carousel skill to make a dense 6-8 slide carousel about: <topic>. Save everything to <out>/.”

## Results

Best version: attempt 3. AI critic assessment (not a benchmark): attempt 1 scored 3.9/10, attempt 2 scored 5.6/10, and attempt 3 scored 6.3/10 overall. Attempt 3 rubric: accuracy 6.5, diagram 5.0, readability 7.0, layout 6.5, adherence 7.0, density 6.0.

## Example

`examples/graph-algorithms.png` is the best attempt poster.

## License

The upstream repository license applies (MIT). This wrapper and its modifications are provided under MIT; the original upstream license and copyright notice are retained in the repository.
