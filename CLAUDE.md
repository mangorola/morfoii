# BE LIGHT — Project Brief

## Concept

An experimental web project exploring **color as a phenomenon of light**. Color is treated as both a passive and active force — shaped by light, and capable of generating light itself.

Inspired by Bruce Lee's "BE WATER," this project proposes **BE LIGHT**: each chapter is a principle derived from the behavior of light, applied to human experience. The audience is designers.

## Structure

Single URL experience with hash routing. The entry point is `index.html`, which contains:

- A homepage with a carousel showing a minimal preview and name of each chapter  
- A router that listens to URL hash changes (e.g. `/#capitulo-1`, `/#capitulo-2`)  
- Each chapter loads dynamically when its hash is active — the user never leaves the same URL

Each chapter is a separate HTML file loaded into the main page via JavaScript. This keeps files manageable while preserving the single-URL experience. The back button works correctly between chapters.

## Visual System

- **Tone:** Minimalist and typographic  
- **Tech stack:** HTML \+ CSS \+ JavaScript vanilla only. No frameworks, no libraries unless explicitly requested.  
- **Typography:** Clean, generous whitespace, type as a visual element  
- **Interactions:** Each chapter has one core interaction tied to its concept  
- **Responsiveness:** Must not break on mobile, even if desktop is the primary experience

## File Naming Convention

- `index.html` — entry point, carousel homepage, and router  
- `cap-01-focus.html`  
- `cap-02-path.html`  
- `cap-03-adaptability.html`  
- (and so on up to cap-10)

Chapters are loaded dynamically into `index.html` via fetch() when the corresponding hash is active.

## Shared Base Template

Every chapter file uses the same internal structure:

- Navigation bar with chapter number, principle name, and arrows (previous / next)  
- A "back to index" button that sets the hash back to `#home`, returning the user to the carousel — this must never trigger a full page reload, only a hash change  
- Title block  
- Consistent font and spacing system  
- Content \+ interaction area

Only the color, content, and interaction change per chapter. The router in `index.html` handles transitions between chapters.

## Chapters

### 01 — FOCUS

Changing the source changes what is brought into focus. Explores how a light source interacts with a space and object. Multiple light sources layered onto a single object. Shadows and color within shadows.

### 02 — PATH

What movements does light make when exposed to sound? Relationship between sound and light, potentially through sonoluminescence.

### 03 — ADAPTABILITY

Light takes the shape of what it illuminates. It adapts. "If you take the shape of what you focus on, then you and it become one."

### 04–10 — (Under development)

Principles to be defined. Same structure applies.

## Key Instructions for Claude Code

- Always use the shared base template as the starting point for each new chapter  
- Keep JavaScript in the same HTML file unless told otherwise  
- Prioritize visual precision over code elegance  
- When generating interactions, tie them conceptually to the chapter's principle — not decorative  
- Commit-ready output: clean code, no console.log leftovers, no placeholder text  
- When in doubt about a visual decision, ask before implementing

