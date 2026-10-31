# Fork patch: no Amigoscode branding by default

Fork: vjranagit/amigoscode-skills (upstream: amigoscode/skills). Licence is MIT, Copyright (c) 2026 Amigoscode.
`LICENSE` (this folder and repo root) is kept untouched, as MIT requires. The notice stays in files; it is simply
never rendered into images, videos or captions.

## What changed (small on purpose)

- `scripts/make.mjs`: `BRANDING` env var, off by default. Off = the Amigoscode mark and wordmark are not read, not
  embedded and not drawn (square, GIF and reel); header and diagram shift up into the freed space.
  `BRANDING=1` (or on/true/yes) restores the original frame exactly.
- `SKILL.md`, `README.md`, `package.json`, `references/pipeline.md`, `references/voiceover-captions.md`: no more
  "branded Amigoscode" wording, and the caption.txt "Follow Amigoscode ..." sign-off is not written unless BRANDING=1.
- `assets/` logo files are untouched and simply unused unless BRANDING=1. Templates contain no brand text.

## Re-apply after an upstream update

```bash
cd ~/visual-content-lab/repos/amigoscode-skills
git fetch upstream && git checkout -b sync-upstream main && git merge upstream/main
# if make.mjs or a doc conflicts, or main was reset to pure upstream:
git apply --3way skills/flows-diagram/fork-patches/nobrand.patch   # try --check first
# verify: no logo in the harness page
MODE=check KEEP_WORK=1 node skills/flows-diagram/scripts/make.mjs <proj> <scene> t T E x
grep -c 'data:image' "$FLOWS_DIR/.work/t/harness.html"    # must print 0
git checkout main && git merge --no-ff sync-upstream && git push origin main
```

If upstream adds new logo spots (new scripts or templates), grep `-rniI "amigo\|logo\|wordmark" skills/flows-diagram`
and gate them behind `BRANDING` the same way.

## How this machine uses it

`~/.claude/skills/flows-diagram` -> `~/visual-content-lab/repos/amigoscode-skills/skills/flows-diagram` (symlink).
That clone has `origin` = the fork and `upstream` = amigoscode/skills, on branch `main` (patched). `carousel`
is symlinked from the same clone and is untouched.
