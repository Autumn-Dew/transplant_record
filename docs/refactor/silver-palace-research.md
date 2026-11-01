# Silver Palace public front-end asset research

> **Scope and rights boundary.** Structural study of publicly delivered, first-party pages and browser-visible bundles. It does **not** authorize reuse. The proposed pack is original and excludes Silver Palace logos, crests, character/key art, story copy, and illustrations. Do not download official assets into this project.
>
> **Method.** Static inspection of HTML, Nuxt chunks, and CSS from the requested production origins. Asset names evidence technique, not permission to copy pixels. Hashed URLs may change. Inspected 2026-11-01 (repository environment date).

## 1. Executive findings

The sites are regional deployments of substantially the same **Nuxt/Vite** front end. Their HTML shares a root stylesheet and bootstrap module, while the larger locale/application chunk differs. Both ship modern modules and `nomodule` legacy bundles. An inline script calculates responsive `rem` units from explicit PC/mobile artboards before hydration, preserving an art-directed composition.[^global-html][^cn-html][^entry-css]

Visual richness has two layers:

1. **Reusable presentation system:** viewport backgrounds; display type; clipped text texture; menu/popup plates; controls; line/particle overlays; masks; hover plates; page-transition shaders; loader motion; audio; and CSS transitions.
2. **Campaign content:** character portraits/backgrounds, city/world illustrations, narrative scenes, promotional media, and official identity. This creates much immediate spectacle but is neither necessary nor appropriate to reuse.

The transferable lesson is **layering and orchestration**, not imagery: combine a tonal base, faint material texture, edge treatment, one atmospheric layer, typographic hierarchy, and state-specific ornament.

## 2. Delivery architecture

The international document loads `entry.pdV-iOna.css`, `DpN_u16L.js`, and `CGLAuHev.js`; China uses the same entry CSS/bootstrap family but its own application chunk. Both expose Nuxt payload data and legacy scripts.[^global-html][^cn-html][^global-app][^cn-app]

The sizing script reveals:

- desktop reference: **2560 × 1392**;
- mobile reference: **1179 × 2556**;
- desktop chooses width/height scaling around a 16:9 threshold;
- mobile scales against target aspect ratios;
- root `font-size`, `--home-fs`, and `--home-rem-ratio` receive the result.

This scales an artboard instead of independently reflowing every decoration.[^global-html]

The application bundle advertises route/component CSS including `app_pc`, `default_pc`, `features`, `news`, `newsDetail`, `ReservePopup`, and `InitialLoader`, indicating lazy route/component styling.[^global-app] Representative chunks cover the desktop shell, layout, feature page, and loader.[^app-pc][^default-pc][^features-css][^loader-css]

## 3. Public asset taxonomy

### Fonts and typographic texture

References include **Cinzel Decorative** and regional **Source Han Sans/Serif** subsets. Some data is embedded; public paths and a hashed Source Han Serif subset also appear.[^cn-app][^index-css] The layout uses `text_clip_bg` as clipped text fill, while loader text uses transparent fill with `background-clip:text`.[^default-pc][^loader-css]

Transferable category: a display serif, legible UI family, tracking, and subtle generated metallic/ink fill. Do not redistribute observed font files without independently confirming licenses and provenance.

### Backgrounds

Route state maps pages to `index_bg`, `home_bg`, `news_bg`, `world_bg`, `feature_bg`, `detail_bg`, and `char_bg` images.[^shader-state] CSS also references page-specific JPEG fields.[^features-css][^index-css]

These are reusable **categories**, but the files are campaign/key art. Their useful contribution is distinct tonal fields per route, center/cover positioning, and continuity during transitions.

### Plates, frames, controls, and overlays

Browser-visible names identify small compositing assets:

- `menu_panel_bg` — menu/popup plate;
- `btn_reserve_bg` — CTA treatment;
- `feature_info_bg_hover` — hover plate;
- `feature_arrow`, `camp_btn_close` — controls;
- `loading_line` — line overlay;
- `loading_particle_apng` — transparent animated particles.[^default-pc][^features-css][^loader-css]

Small alpha assets establish consistent edges and states. Recreate the category from fresh geometry; do not trace.

### Texture/shader inputs, particles, and media

A route-state module stores current/next texture, transition direction/mode, wheel speed, progress, and ticking; routes map to background textures.[^shader-state] This strongly indicates a GPU-style image transition. No conventional standalone `normal`/`noise` map appeared in inspected CSS; displacement may be procedural, embedded, or in another lazy chunk. Incidental `three` strings do not prove Three.js; the defensible finding is shader state, image inputs, and animation-frame scheduling.

The loader combines a fixed black cover, horse animation container (`webm` and mobile/APNG class variants), line image, APNG particles, and clipped text. CSS enlarges the particle layer with transforms, avoiding a full-screen simulation.[^loader-css] The bundle also includes Web Audio/HTML5 audio handling and `requestAnimationFrame`.[^global-app]

Observed motion methods: `.32s` opacity fades, transform scale/translation, `object-fit:contain`, cover/contain backgrounds, clipped text, dedicated hover images, and frame-driven route texture state.[^loader-css][^features-css][^shader-state]


## 4. Richness attribution

| Contribution | Reusable category? | Impact | Safe lesson |
|---|---:|---:|---|
| Character/world/feature backgrounds | Category yes; files no | Very high | Give screens distinct original abstract/environmental fields |
| Official logo, identity, crests | No | High | Plain product wordmark and original non-heraldic index mark |
| Character portraits/key art | No | Very high | Use data visualization, generic architecture, or no figure |
| Menu plates/framed panels | Yes, if redrawn | Medium–high | Original 9-slice frame grammar |
| Text texture/serif hierarchy | Yes | Medium | Licensed fonts and generated masks |
| Particle/line overlays | Yes, if original | Medium | Sparse dust, glints, rule sweeps |
| Shader route transition | Yes, as technique | Medium–high | Original noise/backgrounds; only major navigation |
| Hover/close/arrow ornament | Yes, if redesigned | Medium | One state language across controls |
| Audio ambience | Yes, if original/licensed | Low visually | Optional, off by default |

Key/character art creates most *first-glance spectacle*; reusable systems create most *finish and coherence*. This productivity app should pursue the latter.

## 5. Proposed original pack: **Nocturne Registry**

A civic-records/precision-instrument concept, not a fantasy-palace imitation. Motifs: registry ticks, offset folio corners, calibration arcs, punched index holes, oxidized steel, carbon ink, and translucent vellum. Avoid crowns, shields, wings, heraldry, character silhouettes, and the Silver Palace wordmark.

```text
public/art/nocturne-registry/
  materials/
    vellum-fiber-512.webp
    steel-grain-512.webp
    glass-smudge-512.webp
    noise-64.png
  fields/
    desk-light-1920.webp
    archive-dark-1920.webp
    report-grid.svg
  frames/
    panel-9slice.svg
    dialog-9slice.svg
    rule-cap.svg
    index-notch.svg
  atmosphere/
    dust-01.webp
    sweep-line.svg
    vignette.svg
  controls/
    chevron.svg
    close.svg
    status-diamond.svg
    focus-brackets.svg
  motion/
    dust-loop.webm
  fonts/
    LICENSES.md
```

Prefer SVG/CSS for rules and frames, WebP for material/field rasters, and a tiny PNG only for deterministic pixel noise. Generate textures from documented procedural recipes and retain sources/checksums. Suggested palette: carbon `#10181c`, oxidized teal `#245b5b`, vellum `#eee8da`, nickel `#aeb9ba`, muted brass `#ad8b51`, docket red `#7c3442`.

## 6. Implementation plan for `transplant_record`

The repository is Vue 3 + Vite + Electron and already has a Silver-Palace-named theme stylesheet with original-only intent. This plan is advisory; **no application code was edited**.

1. **Rename the concept.** Keep useful semantic tokens, but ship the user-facing theme as “Nocturne Registry” (or another original name). Remove franchise references from labels and paths.
2. **Create documented originals.** Generate neutral fiber, grain, dust, and drafting geometry. Record author, tool, seed, license, and SHA-256 in `assets-manifest.json`.
3. **Use three layers.** Base field; material at 2–5% opacity; edge/vignette/atmosphere. Make overlays non-interactive and keep text contrast independent.
4. **Frame selectively.** Implement panel/dialog frames with CSS `border-image` or pseudo-elements using the original 9-slice SVG. Reserve ornament for page, modal, and section hierarchy.
5. **Typography.** Choose independently licensed OFL display and CJK-capable text families, self-host only needed subsets, include licenses, and retain system fallbacks. Never extract production subsets from the researched site.
6. **Motion budget.** Interactions 110–180 ms; page reveal 220–320 ms; one slow atmosphere loop. Prefer opacity/transform; gate media/canvas behind visibility and `prefers-reduced-motion`.
7. **Optional transition canvas.** If warranted, use one low-resolution WebGL canvas to crossfade two original fields with `noise-64.png`; provide a CSS fade fallback and pause while hidden. Do not add a large 3D library solely for this.
8. **Electron targets.** Initial decoration ≤1.5 MB compressed; each UI raster ≤250 KB; lazy-decode large fields; cap canvas DPR; test integrated GPU and 1366×768.
9. **Accessibility.** Maintain 4.5:1 body contrast, visible focus outline/brackets, no color-only information, toggleable sound, and no flashing particles.
10. **Validate.** Screenshot light/dark at 1366×768, 1920×1080, and narrow widths; test reduced motion; inspect Electron memory/GPU use.

### Recommended first slice

Ship only `vellum-fiber`, `steel-grain`, `panel-9slice`, `rule-cap`, and `sweep-line`. Apply them to the title bar, sidebar, one modal, and one report panel. Add sparse dust only after usability and frame-time checks; defer WebGL until static layering proves insufficient.

## 7. Sources and verification notes

All citations are public first-party Silver Palace origins. Hashed assets may be replaced. Page roots are durable starting points; chunk URLs identify the inspected build. No cited visual asset was copied into this repository.

[^global-html]: Silver Palace international page HTML, <https://silverpalace.elementagames.com/en-us>.
[^cn-html]: Silver Palace China page HTML, <https://www.silverpalace.cn/>.
[^entry-css]: Shared entry stylesheet, <https://silverpalace.elementagames.com/_nuxt/entry.pdV-iOna.css>.
[^global-app]: International application bundle, <https://silverpalace.elementagames.com/_nuxt/CGLAuHev.js>.
[^cn-app]: China application bundle, <https://www.silverpalace.cn/_nuxt/xc-ZzTA1.js>.
[^app-pc]: Desktop application CSS, <https://silverpalace.elementagames.com/_nuxt/app_pc.Cn6zhBYw.css>.
[^default-pc]: Desktop layout CSS (menu plate, button, text clip), <https://silverpalace.elementagames.com/_nuxt/default_pc.D_4ItJKS.css>.
[^features-css]: Features CSS (backgrounds, arrows, close controls, hover plate), <https://silverpalace.elementagames.com/_nuxt/features.CI8nsu4d.css>.
[^loader-css]: Loader CSS (line, APNG particles, media sizing, fades), <https://silverpalace.elementagames.com/_nuxt/InitialLoader.nuLEq1Q5.css>.
[^index-css]: Route CSS with hashed Source Han Serif subset/background, <https://silverpalace.elementagames.com/_nuxt/index.CXod_omh.css>.
[^shader-state]: Lazy module exposing route texture names and transition state, <https://silverpalace.elementagames.com/_nuxt/B1FGSQXe.js>.
