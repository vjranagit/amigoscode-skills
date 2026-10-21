// Validates content.json, lays out every slide with fixed script-owned blocks,
// renders through the upstream Amigoscode carousel template, then measures the
// DOM and fails with one-line fix hints instead of shipping clipped slides.
// Script-owned extras: a visible "3 / 7" index, link chips that name the target
// slide, a cover map with link arcs, and an outro list of every link.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const [contentPath, outDir, samplePkg, templatePath] = process.argv.slice(2);
const { chromium } = createRequire(samplePkg)('playwright');
const { buildCarouselHtml } = await import(pathToFileURL(templatePath).href);

const fixes = [];
const fail = (msg) => fixes.push(msg);
const done = () => {
  if (!fixes.length) return;
  console.log(JSON.stringify({ status: 'fix', fixes }));
  process.exit(1);
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const str = (v) => typeof v === 'string' && v.trim() !== '';

let c;
try {
  c = JSON.parse(fs.readFileSync(contentPath, 'utf8')) || {};
} catch (e) {
  fail(`content.json is not valid JSON (${e.message}); keep the template's quotes, commas and brackets`);
  done();
}

// ---- static checks (cheap, precise hints) ----
const LIMITS = { title: 42, slideTitle: 36, desc: 160, label: 16, value: 48, code: 42 };
const KEYS = ['title', 'description', 'rows', 'code'];
// ASCII stand-ins read as source code, not notation.
const NOTATION = [
  [/(^|\s)->(?=\s|$)/, '→'], [/<=/, '≤'], [/>=/, '≥'], [/!=/, '≠'],
  [/\^T\b/, 'ᵀ'], [/\^2\b/, '²'], [/\^3\b/, '³'], [/\^-1\b/, '⁻¹'],
  [/\bsqrt\(/, '√'], [/\bsum\(/, 'Σ'], [/\binf\b/i, '∞'],
  [/\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|tau|phi|omega)[_^]/i, 'the Greek letter (α β γ Δ ε θ λ μ σ τ φ ω)'],
];
const notation = (where, s) => {
  for (const [re, sym] of NOTATION) {
    const m = String(s).match(re);
    if (m) fail(`${where}: write ${sym} instead of ASCII "${m[0].trim()}"`);
  }
};
if (!str(c.title) || c.title.length > LIMITS.title) fail(`title: required, <=${LIMITS.title} chars`);
else if (/\b[A-Z]{2,}s\b/.test(c.title)) fail(`title: the cover is all capitals, so "${c.title.match(/\b[A-Z]{2,}s\b/)[0]}" misreads; drop the plural s or spell it out`);
else notation('title', c.title);
const slides = Array.isArray(c.slides) ? c.slides.map((s) => (s && typeof s === 'object' ? s : {})) : [];
const N = slides.length;
if (N < 6 || N > 8) fail(`slides: need 6-8 slide objects, found ${N}`);
const links = []; // { from, to, label, row } from rows whose value says "slide N"
const REF = /\bslide (\d+)/gi;
slides.forEach((s, i) => {
  const n = `slide ${i + 1}`;
  const extra = Object.keys(s).filter((k) => !KEYS.includes(k));
  if (extra.length) fail(`${n}: unknown key ${extra.join(', ')}; allowed keys are ${KEYS.join(', ')}`);
  if (!str(s.title) || s.title.length > LIMITS.slideTitle) fail(`${n}: title required, <=${LIMITS.slideTitle} chars (now ${String(s.title || '').length})`);
  if (!str(s.description) || s.description.length > LIMITS.desc) fail(`${n}: description required, <=${LIMITS.desc} chars (now ${String(s.description || '').length}); move facts into rows`);
  if (s.rows === undefined && s.code === undefined) fail(`${n}: add rows (2-4 ["label","value"] pairs) or a one-line code example`);
  const texts = [s.title, s.description, s.code].filter(str);
  if (s.rows !== undefined) {
    if (!Array.isArray(s.rows) || s.rows.length < 2 || s.rows.length > 4) fail(`${n}: rows must be a list of 2-4 ["label","value"] pairs`);
    else s.rows.forEach((r, k) => {
      if (!Array.isArray(r) || r.length !== 2 || !str(r[0]) || !str(r[1])) return fail(`${n} rows[${k}]: must be ["label","value"]`);
      if (r[0].length > LIMITS.label) fail(`${n} rows[${k}]: label "${r[0]}" >${LIMITS.label} chars`);
      if (r[1].length > LIMITS.value) fail(`${n} rows[${k}]: value >${LIMITS.value} chars (now ${r[1].length})`);
      texts.push(r[0], r[1]);
      const to = [...r[1].matchAll(REF)].map((m) => +m[1]).filter((t) => t >= 1 && t <= N && t !== i + 1);
      if (to.length && to.every((t) => t === i + 2)) fail(`${n} rows[${k}]: only points to the next slide, which the arrow already does; link a branch further ahead or a loop back instead`);
      to.forEach((t) => links.push({ from: i + 1, to: t, label: r[0], row: k }));
    });
  }
  if (s.code !== undefined && (!str(s.code) || s.code.length > LIMITS.code || s.code.includes('\n')))
    fail(`${n}: code must be one line, <=${LIMITS.code} chars (now ${String(s.code).length})`);
  for (const t of texts) {
    notation(n, t);
    for (const m of t.matchAll(REF)) {
      if (+m[1] < 1 || +m[1] > N) fail(`${n}: "${m[0]}" does not exist; content slides are numbered 1-${N}`);
      else if (+m[1] === i + 1) fail(`${n}: "${m[0]}" points at itself; link another slide`);
    }
  }
});
if (N >= 6 && N <= 8) {
  if (!links.some((l) => l.to < l.from)) fail('links: no row loops back; on a later slide add a row like ["If it fails", "back to slide 2"]');
  if (links.length > 8) fail(`links: ${links.length} slide links; keep the 8 that show branches and loops`);
}
done();

// ---- script-owned layout ----
// Sizes scale with --qc-s; the measure step grows it per slide while everything still fits.
const css = `
@font-face { font-family: 'QcGreek'; src: local('DejaVu Sans Mono Bold'); unicode-range: U+0370-03FF; }
.page-number { display: none; }
.qc-index { position: absolute; top: 80px; left: 80px; z-index: 2; font: 700 40px/56px 'Poppins', sans-serif; color: #0F172A; background: var(--qc-accent); border-radius: 28px; padding: 0 26px; word-spacing: 6px; }
.content-body, .cover-title, .outro-text { --qc-s: 1; }
.content-body { top: 180px; bottom: 240px; transform: translateX(-50%); width: 920px; gap: calc(28px * var(--qc-s)); justify-content: center; }
.content-title { font-family: 'QcGreek', 'JetBrains Mono', monospace; font-size: calc(56px * min(var(--qc-s), 1.15)); text-wrap: balance; }
.content-desc { font-size: calc(32px * var(--qc-s)); line-height: 1.45; }
.qc-stack { display: flex; flex-direction: column; gap: calc(26px * var(--qc-s)); }
.qc-rows { display: grid; grid-template-columns: fit-content(400px) 1fr; border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; overflow: hidden; background: rgba(0,0,0,0.22); }
.qc-lab, .qc-val { padding: 14px 22px; border-top: 1px solid rgba(255,255,255,0.12); font-size: calc(30px * var(--qc-s)); line-height: calc(42px * var(--qc-s)); }
.qc-lab:nth-child(1), .qc-val:nth-child(2) { border-top: 0; }
.qc-lab { font-family: 'QcGreek', 'JetBrains Mono', monospace; font-weight: 700; color: var(--qc-accent); white-space: nowrap; overflow: hidden; background: rgba(255,255,255,0.05); }
.qc-val { font-family: 'Poppins', sans-serif; font-weight: 600; color: white; overflow-wrap: anywhere; }
.qc-ref { color: var(--qc-accent); }
.qc-code { font: 700 calc(34px * var(--qc-s))/1.35 'QcGreek', 'JetBrains Mono', monospace; color: var(--qc-accent); background: rgba(0,0,0,0.38); border-left: 6px solid var(--qc-accent); border-radius: 12px; padding: 16px 24px; white-space: pre; overflow: hidden; }
.qc-links { display: flex; flex-wrap: wrap; gap: 12px; }
.qc-chip { font: 600 calc(28px * var(--qc-s))/1.45 'Poppins', sans-serif; color: white; border: 2px solid var(--qc-accent); border-radius: 12px; padding: 4px 16px; }
.qc-chip.back { background: var(--qc-accent); color: #0F172A; }
.qc-n { font-family: 'JetBrains Mono', monospace; font-weight: 700; background: var(--qc-accent); color: #0F172A; border-radius: 8px; padding: 0 10px; margin-right: 10px; }
.qc-chip.back .qc-n { background: #0F172A; color: var(--qc-accent); }
.cover-title { top: 190px; bottom: 110px; transform: none; text-transform: none; letter-spacing: 0; display: flex; flex-direction: column; justify-content: center; gap: calc(44px * var(--qc-s)); }
.qc-ct { display: block; font-size: calc(72px * min(var(--qc-s), 1.15)); line-height: 1.2; letter-spacing: 1.5px; text-transform: uppercase; }
.qc-map { display: flex; flex-direction: column; gap: calc(14px * var(--qc-s)); position: relative; font: 600 calc(32px * var(--qc-s))/1.3 'Poppins', sans-serif; }
.qc-item { display: flex; align-items: center; gap: 18px; }
.qc-badge { flex: none; width: calc(52px * var(--qc-s)); height: calc(52px * var(--qc-s)); border-radius: 50%; background: var(--qc-accent); color: #0F172A; font: 700 calc(30px * var(--qc-s))/calc(52px * var(--qc-s)) 'JetBrains Mono', monospace; text-align: center; }
.qc-arcs { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.qc-legend { display: block; font: 600 calc(28px * var(--qc-s))/1.4 'Poppins', sans-serif; opacity: 0.85; }
.outro-text { top: 110px; bottom: 110px; width: 920px; transform: translateX(-50%); text-align: left; display: flex; flex-direction: column; justify-content: center; gap: calc(22px * var(--qc-s)); }
.qc-ot { display: block; font-size: calc(60px * min(var(--qc-s), 1.15)); line-height: 1.25; }
.qc-os { display: block; font-size: calc(34px * var(--qc-s)); line-height: 1.4; color: var(--qc-accent); }
.qc-ol { display: block; font-size: calc(32px * var(--qc-s)); line-height: 1.35; }
.qc-ol i { font-style: normal; color: var(--qc-accent); margin: 0 12px; }
.qc-ol2 { display: block; font-size: calc(27px * var(--qc-s)); line-height: 1.4; opacity: 0.8; }
`;
const theme = { background: '#0F172A', accent: '#0D9488', accentLight: '#99F6E4', glow: '#134E4A' };
const ref = (s) => esc(s).replace(/\bslide (\d+)/gi, '<b class="qc-ref">slide $1</b>');
const num = (n) => `<b class="qc-n">${n}</b>`;
const name = (n) => `${num(n)}${esc(slides[n - 1].title)}`;
const chips = (i) => {
  const out = [...new Set(links.filter((l) => l.from === i).map((l) => l.to))]
    .map((t) => `<span class="qc-chip${t < i ? ' back' : ''}">${t < i ? '↩' : '→'} ${name(t)}</span>`);
  const into = [...new Set(links.filter((l) => l.to === i && l.from > i).map((l) => l.from))]
    .map((f) => `<span class="qc-chip">↺ from ${name(f)}</span>`);
  return out.length + into.length ? `<div class="qc-links">${out.join('')}${into.join('')}</div>` : '';
};
const body = (s, i) => {
  let h = `<div>${ref(s.description)}</div>`;
  if (s.code) h += `<div class="qc-code">${esc(s.code)}</div>`;
  if (s.rows) h += `<div class="qc-rows">${s.rows.map(([l, v]) => `<div class="qc-lab">${esc(l)}</div><div class="qc-val">${ref(v)}</div>`).join('')}</div>`;
  return h + chips(i);
};
const desc = (s, i) => `<div class="qc-stack">${body(s, i)}</div>`;
const cover = `<span class="qc-ct">${esc(c.title)}</span>`
  + `<span class="qc-map">${slides.map((s, i) => `<span class="qc-item" data-n="${i + 1}"><span class="qc-badge">${i + 1}</span><span>${esc(s.title)}</span></span>`).join('')}</span>`
  + '<span class="qc-legend">Solid line: loops back · dashed: skips ahead</span>';
const outro = `<span class="qc-ot">${esc(c.title)}</span><span class="qc-os">How the parts connect</span>`
  + links.map((l) => `<span class="qc-ol">${num(l.from)}<i>${l.to < l.from ? '↩ back to' : '→ jumps to'}</i>${name(l.to)}`
    + `<span class="qc-ol2">${esc(l.label)}: ${ref(slides[l.from - 1].rows[l.row][1])}</span></span>`).join('');
const assets = path.join(path.dirname(path.dirname(templatePath)), 'assets');
let html = buildCarouselHtml({
  coverTitle: cover,
  techIconSvg: '',
  contentSlides: slides.map((s, i) => ({ title: { text: esc(s.title) }, description: desc(s, i + 1) })),
  logoSvg: '',
  swipeIconSvg: fs.readFileSync(path.join(assets, 'swipe-icon.svg'), 'utf8'),
  arrowSvg: fs.readFileSync(path.join(assets, 'arrow-vector.svg'), 'utf8'),
  outroLogoSvg: '',
  photoPath: '',
  footerText: esc(c.title),
  outroCta: outro,
  theme,
});
html = html.replace(/<div class="website">[^<]*<\/div>/, ''); // the cover already shows the title
html = html.replace(/<div class="page-number">(\d+)<\/div>/g, `<div class="qc-index">$1 / ${N}</div>`);
html = html.replace('</style>', `${css}\n:root { --qc-accent: ${theme.accentLight}; }\n</style>`);

// ---- render + measure ----
const dir = path.join(outDir, 'carousel');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const tmpHtml = path.join(dir, '_carousel.html');
fs.writeFileSync(tmpHtml, html);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 })).newPage();
await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// Layout is measured here, never chosen by Qwen: cover-map lanes, per-slide type scale, then fit checks.
const problems = await page.evaluate((links) => {
  const lines = (el) => { const s = getComputedStyle(el); return Math.round((el.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)) / parseFloat(s.lineHeight)); };
  const blocks = '.content-body,.qc-index,.website,.arrow,.swipe,.cover-title,.outro-text,.logo,.outro-logo,.outro-photo,.cover-topic-logo';
  const slidesEl = [...document.querySelectorAll('.slide')];
  const last = slidesEl.length - 1;
  const check = (slide, i) => {
    const out = [];
    const name = i === 0 ? 'cover' : i === last ? 'outro' : `slide ${i}`;
    const hint = name === 'cover' ? 'shorten the deck title or slide titles' : name === 'outro' ? 'drop a link row or shorten its label' : 'shorten the description, drop a row or the code line';
    const S = slide.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - S.left, t: r.top - S.top, r: r.right - S.left, b: r.bottom - S.top }; };
    const parts = [...slide.querySelectorAll(blocks)].filter((el) => el.innerHTML.trim() !== '' || el.tagName === 'IMG').map((el) => ({ el, box: rel(el) }));
    for (const { el, box } of parts) {
      if (box.l < 40 || box.t < 40 || box.r > 1040 || box.b > 1310)
        out.push(`${name}: ${el.className} runs off the slide edge; ${hint}`);
    }
    for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
      const p = parts[a].box, q = parts[b].box;
      const over = Math.min(p.b, q.b) - Math.max(p.t, q.t);
      if (Math.min(p.r, q.r) - Math.max(p.l, q.l) > 0 && over > 0)
        out.push(`${name}: ${parts[a].el.className} overlaps ${parts[b].el.className} by ${Math.ceil(over)}px; ${hint}`);
    }
    const box = slide.querySelector('.content-body,.cover-title,.outro-text');
    if (box) {
      const B = box.getBoundingClientRect(), kids = [...box.children].map((k) => k.getBoundingClientRect());
      const over = Math.max(B.top - Math.min(...kids.map((k) => k.top)), Math.max(...kids.map((k) => k.bottom)) - B.bottom);
      if (over > 1) out.push(`${name}: content is ${Math.ceil(over)}px too tall; ${hint}`);
      if (box.scrollWidth > box.clientWidth + 1) out.push(`${name}: a word is too long for one line; add spaces or shorten it`);
    }
    const t = slide.querySelector('.content-title');
    if (t && lines(t) > 2) out.push(`${name}: title wraps to ${lines(t)} lines; shorten it`);
    const ct = slide.querySelector('.qc-ct');
    if (ct && (lines(ct) > 3 || ct.scrollWidth > ct.clientWidth + 1)) out.push('cover: deck title is too long or has a word too long for one line; shorten it');
    slide.querySelectorAll('.qc-val').forEach((v, k) => { if (lines(v) > 2) out.push(`${name} rows[${k}]: value wraps to ${lines(v)} lines; shorten it`); });
    slide.querySelectorAll('.qc-lab').forEach((v, k) => { if (v.scrollWidth > v.clientWidth + 1) out.push(`${name} rows[${k}]: label too wide; shorten it`); });
    slide.querySelectorAll('.qc-code').forEach((v) => { if (v.scrollWidth > v.clientWidth + 1) out.push(`${name}: code line too wide; shorten it`); });
    return out;
  };

  // Cover map lanes: shortest links nearest the badges, no two overlapping spans share a lane.
  const map = document.querySelector('.qc-map');
  const seen = new Set();
  const L = links.filter((l) => !seen.has(`${l.from}>${l.to}`) && seen.add(`${l.from}>${l.to}`))
    .sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
  const lanes = [];
  for (const l of L) {
    const lo = Math.min(l.from, l.to), hi = Math.max(l.from, l.to);
    let k = 0;
    while (lanes[k] && lanes[k].some(([a, b]) => lo < b && a < hi)) k++;
    (lanes[k] = lanes[k] || []).push([lo, hi]);
    l.lane = k;
  }
  const GAP = 22;
  map.style.paddingLeft = `${lanes.length * GAP + 14}px`;

  // Type scale: the largest step at which every fit check passes; floors keep text phone-readable.
  slidesEl.forEach((slide, i) => {
    const box = slide.querySelector('.content-body,.cover-title,.outro-text');
    if (!box) return;
    const floor = i === 0 ? 0.8 : i === slidesEl.length - 1 ? 0.7 : 0.9;
    for (let s = 1.4; s >= floor - 0.001; s -= 0.05) {
      box.style.setProperty('--qc-s', s.toFixed(2));
      if (!check(slide, i).length) return;
    }
  });

  const M = map.getBoundingClientRect();
  const at = (n) => { const r = map.querySelector(`[data-n="${n}"] .qc-badge`).getBoundingClientRect(); return { x: r.left - M.left, y: r.top - M.top + r.height / 2 }; };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--qc-accent').trim();
  const paths = L.map((l) => {
    const s = at(l.from), t = at(l.to), x = s.x - 14 - l.lane * GAP, back = l.to < l.from;
    const ys = s.y + (back ? -8 : 8), yt = t.y + (back ? 8 : -8);
    return `<path d="M${s.x} ${ys} H${x} V${yt} H${t.x - 4}" fill="none" stroke="${back ? ink : 'white'}" stroke-width="${back ? 4 : 3}" ${back ? '' : 'stroke-dasharray="10 8"'} stroke-linejoin="round" marker-end="url(#qc-${back ? 'b' : 'f'})"/>`;
  });
  const head = (id, col) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker>`;
  map.insertAdjacentHTML('afterbegin', `<svg class="qc-arcs" width="${M.width}" height="${M.height}"><defs>${head('qc-b', ink)}${head('qc-f', 'white')}</defs>${paths.join('')}</svg>`);

  return slidesEl.flatMap(check);
}, links);

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'slide';
const els = await page.$$('.slide');
const files = [];
for (let i = 0; i < els.length; i++) {
  const nn = String(i + 1).padStart(2, '0');
  const f = path.join(dir, i === 0 ? `${nn}-cover.png` : i === els.length - 1 ? `${nn}-outro.png` : `${nn}-${slug(slides[i - 1].title)}.png`);
  await els[i].screenshot({ path: f });
  files.push(f);
}
await browser.close();
fs.unlinkSync(tmpHtml);
problems.forEach(fail);
done();
console.log(JSON.stringify({
  status: 'rendered',
  slides: files,
  review: [
    'Does every count in a description (e.g. "three cases") equal what its slide lists?',
    'Does every description agree with the rows on its slide, and every row label match its value?',
    'Does each cause → effect name what really causes it, not just where it shows up?',
    'Would an expert sign off on every number? Delete any you are unsure of.',
    'Does every part named in the request appear on a slide or row?',
  ],
  next: 'Re-read content.json against each review question. Any "no": fix the JSON and rerun. All "yes": done.',
}));
