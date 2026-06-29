# BE LIGHT — Project Master Brief

## Concept
An experimental web project exploring **color as a phenomenon of light**. Color is treated as both a passive and active force — shaped by light, and capable of generating light itself. The audience is designers.

Inspired by Bruce Lee's "BE WATER," the project proposes **BE LIGHT**: each chapter is a principle derived from the behavior of light, applied to human experience.

The navigation and conceptual structure are organized as an analogy to the **Tree of Life** (Kabbalah), read through a hermetic / Kybalion lens. The project takes the *structure* of the Tree (10 sefirot + 1 hidden) and the *spirit* of the Kybalion (esp. "as above, so below"). Each chapter's POSITION on the Tree encodes its principle: which pillar and which height it occupies is part of its meaning. Counting the chapters in order = tracing the descent of light from its origin to the eye.

## Title
Displayed homepage title: **"LA VIDA EN COLOR"**, shown twice — once at the top and once mirrored/inverted at the bottom. The mirror is a deliberate gesture: it visually states the Kybalion principle "as above, so below" (como es arriba, es abajo), and evokes light reflecting.

## Navigation Structure — the Tree of Life

The homepage is NOT a linear carousel. It is a **field of 11 numbered nodes** (circles) arranged on the Tree of Life, laid over **three large overlapping circles** (a Venn-like intersection).

**The three large circles = additive color (RGB light).** They represent the three primaries of LIGHT — red, green, blue — which is faithful to the project's thesis (color as a phenomenon of *light*, i.e. ADDITIVE / RGB, NOT subtractive / CMY). Where all three overlap, additive mixing yields WHITE — and in that white center lives the hidden node 11 (Da'ath). The hidden node is conceived as white light: the unity that contains all colors but cannot be seen directly without a prism to break it apart.

**Hover interaction on the three circles:** additive light mixing (RGB), still being finalized. On hover, circles should behave like colored light overlapping (red/green/blue), with additive blending in the intersection zones. (Exact behavior TBD — implement as a tunable hook.)

**The three pillars of the Tree map to three behaviors of light:**
- **Right pillar (Mercy / expansion):** light that is EMITTED — the active, the source, what radiates.
- **Left pillar (Severity / form):** light that is ABSORBED — shadow, the color an object is NOT, what is retained.
- **Middle pillar (Equilibrium):** light that is TRANSMITTED — the path from source to eye, descending from pure light (Keter) to the perceived world (Malkuth).

Color-as-perception is born in the tension between emission and absorption, resolved in what reaches the eye.

**The hidden 11 (Da'ath):** rendered lighter, centered in the triple intersection, left intentionally undefined. In the Tree, Da'ath ("knowledge") is not counted among the ten and lives veiled in the abyss. Keep it velado — the indefiniteness is faithful to the source. Its content is TBD (possibly the white-light unity).

## Chapter Map (numbering follows the "lightning flash" descent of light)

| # | Sefirah | Pillar / height | Principle of light | Chapter |
|---|---------|-----------------|--------------------|---------|
| 01 | Keter | center, top | pure light / origin — light before color | (to define) |
| 02 | Chokmah | right, high | the spark, first emission | (to define) |
| 03 | Binah | left, high | light takes form, finds its path | **PATH** (elevated/abstract: light acquiring a cauce, not literal sound) |
| 04 | Chesed | right, middle | expansive emission, sources that build an object | **FOCUS** |
| 05 | Gevurah | left, middle | absorption — the color an object is NOT | (to define) |
| 06 | Tiferet | center, heart | integration / equilibrium — the heart of the Tree | **RESERVED** for a chapter yet to come (do not fill with a leftover) |
| 07 | Netzach | right, low | flow, vibration, the travelling wave | **WAVEFRONT** (see detailed spec below) |
| 08 | Hod | left, low | analysis, the spectrum decomposed, the prism | (to define) |
| 09 | Yesod | center, low | the medium that transmits; light amolda to what it meets | **ADAPTABILITY** |
| 10 | Malkuth | center, bottom | the eye, the perceived world — color appears on things | (to define) — closing chapter |
| 11 | Da'ath | center, veiled | hidden / white-light unity | **HIDDEN**, undefined |

Note: PATH's original sound/sonoluminescence idea is set aside in favor of a more abstract reading suited to Binah (above the abyss).

## Detailed Chapter Specs

### 07 — WAVEFRONT (Netzach) — currently built in file `cap-04-coherence.html`
NOTE ON FILE NAMING: this chapter was originally prototyped as "COHERENCE" in `cap-04-coherence.html`. Its concept has since shifted to WAVEFRONT and its Tree position is 07. Keep building in the existing file for now; reconcile the filename/number later (rename to `cap-07-wavefront.html` once stable). The name "COHERENCE" is freed for a possible future chapter about true phase synchronization.

**Principle:** *Between one color and the next there is a moment that belongs to neither — the old hue lingers as a wake while the new one arrives.* Color is not a switch but a PROCESS: a front that travels, with a trace behind it. (BE LIGHT life-principle: transformation is never instant; every change drags a wake of what we were, and for a moment we are both at once.)

**What is built (Stage 1 + Stage 2):**
- A single cohesive voxel body: an ordered 3D brick of cubes (grid, default 14×10×12 = 1680 cubes) rendered with a single InstancedMesh. The rest state is to become an ERODED SKYLINE (uneven towers/columns with gaps), re-randomized into a new silhouette each time it reassembles. (Skyline carving was the next step in progress.)
- **True isometric** OrthographicCamera; the brick sits SMALL and centered with generous air around it (tunable `viewSize`), reading as set back in open space. No perspective vanishing point. Subtle field-rotation toward the mouse gives life (ortho has no parallax).
- **Dispersion on hover of a central screen zone:** entering disperses the body — all cubes move OUTWARD from a SINGLE shared center, inflating into one airy, porous mass (one body, lower density, NO separate islands; per-cube variation keeps it organic). Leaving reassembles it. Smooth lerp both ways.
- **Color toggle on click:** the whole field is one color at a time — vivid saturated BLUE (#1d6bff) or RED (#ff2233), chosen for high ocular contrast (simultaneous-contrast vibration, faithful to the perception thesis). Each click sweeps the new color across the field from the click point outward as a WAVEFRONT (not an instant snap) — this travelling front + the wake of the old color is the conceptual core.
- **Color-change spin:** each toggle triggers a brief angular impulse that eases out, staggered with the color wavefront so cubes flip as the new color reaches them (a ripple of turning), not continuous spinning.
- Dark/light mode works throughout.
- All tunables live in a CONFIG object at the top of the file.

### 04 — FOCUS (Chesed) — file `cap-01-focus.html` (filename to reconcile)
Changing the source changes what is brought into focus. Implemented as a fullscreen interactive WebGL fluid / optical-diffusion simulation (`cap-01-fluid.html`) embedded via <iframe>. Click cycles the light-source color; the field responds. (Note: built as cap-01; its Tree position is 04 — reconcile numbering later.)

### 03 — PATH (Binah)
Light takes form and finds its cauce. Elevated/abstract reading (supernal, above the abyss): not the literal sound/sonoluminescence idea, but light acquiring trajectory and form before manifestation. (To build.)

### 09 — ADAPTABILITY (Yesod)
"Light takes the shape of what it illuminates. It adapts. If you take the shape of what you focus on, then you and it become one." Yesod = the receptive medium that transmits, amolding to what it receives. (To build.)

## Visual System
- **Tone:** Minimalist and typographic. Type as a visual element, generous whitespace.
- **Tech stack:** HTML + CSS + JavaScript vanilla. Three.js permitted where a chapter requires 3D/WebGL. No other frameworks unless requested.
- **Dark / Light mode:** global, user-toggleable, shared across homepage and all chapters via a root-level CSS-variable scheme + persisted in localStorage (own Vercel site, so localStorage is fine). Default light. Every chapter — including WebGL scenes — reads the current theme and adapts background, type color, and scene clear-color. Toggle is discreet and typographic, not a standard UI button.
- **Color fidelity:** the project is about light → use ADDITIVE/RGB logic for the homepage circles. High-contrast saturated hues where ocular impact is the point (e.g. WAVEFRONT's blue/red).
- **Responsiveness:** must not break on mobile, even though desktop is the primary experience.

## Technical Architecture
- **Single-URL experience with hash routing.** Entry point `index.html` contains the Tree homepage + a router listening to `#` changes (e.g. `#capitulo-01`). Chapters load when their hash is active; the user never leaves the URL. Back button works.
- **Chapter loading:** simple HTML/CSS chapters are fetched and injected into `index.html`. **IMPORTANT:** scripts injected via innerHTML do NOT execute — chapters that need their own JavaScript (WebGL scenes) are embedded via **<iframe>** instead.
- **Back navigation:** every chapter has a "back to index" control that sets the hash to `#home` — never a full page reload, hash change only.
- **Hosting:** GitHub repo → Vercel (auto-deploys on push). `index.html` is the served entry point.

## File Naming Convention
- `index.html` — Tree homepage + router
- `cap-XX-name.html` per chapter
- WebGL/JS-heavy chapters embedded via iframe (e.g. `cap-01-fluid.html` holds the FOCUS simulation)
- **Reconciliation note:** some files were created before the Tree numbering (e.g. `cap-01-focus.html` is Tree #04; `cap-04-coherence.html` is Tree #07 / WAVEFRONT). Keep working in existing files; rename to match Tree numbers once each chapter is stable, updating the router accordingly.

## Homepage Design (current)
- 11 numbered circular nodes (01–11) positioned on the Tree of Life, over three large overlapping RGB-light circles.
- Title "LA VIDA EN COLOR" top + mirrored bottom.
- Node 11 lighter, centered in the triple intersection, hidden/undefined (Da'ath).
- Node positions encode pillar + height (emission right, absorption left, transmission center).
- Three circles get an additive-light hover interaction (RGB), TBD — build as a tunable hook.
- Clicking a node routes to that chapter via hash.

## Key Instructions for Claude Code
- Always read this brief at the start of a session.
- Use the shared visual system (typographic, minimal, dark/light) as the baseline for every chapter.
- Tie each chapter's interaction conceptually to its principle and its Tree position — not decorative.
- Keep JavaScript in the same file unless told otherwise; expose tunables in a CONFIG block at the top.
- Commit-ready output: clean code, no console.log leftovers, no placeholder text.
- When in doubt about a visual or conceptual decision, ASK before implementing.
- **Performance matters** (this project has lagged on modest machines): use InstancedMesh for repeated geometry, no per-frame allocations (reuse scratch objects), cap pixelRatio (~1.5), keep bloom modest, throttle expensive work.
