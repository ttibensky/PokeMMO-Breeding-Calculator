# Mewtwo sprite as favicon + header logo

**Date:** 2026-06-13
**Status:** Approved design

## Goal

Give the app a Mewtwo identity: an animated Mewtwo sprite as the header logo and a
matching favicon in the browser tab. Replace the current broken favicon reference.

## Source asset

- `~/Downloads/mewtwo-sprite.gif` — 200×200, 24-frame animated GIF, classic
  grey/purple Mewtwo, **already has a transparent background**.
- Used **as-is**. The Mewtwo artwork must not be altered (no recolor, no redraw).

## Decisions

- **Header logo:** the animated GIF (it animates in the header).
- **Favicon:** a **static PNG** generated from the GIF's first frame. Browser tabs
  do not reliably animate GIFs (Chrome shows a static first frame; Firefox may
  animate), and a PNG is sharper and universally supported.

## Deliverables

### Assets (new `public/` directory)

Vite serves files in `public/` at the app's base path (`/PokeMMO-Breeding-Calculator/`).
Create `public/` and add:

1. `public/mewtwo-sprite.gif` — the source GIF copied in unchanged.
2. `public/favicon.png` — generated from frame 0 of the GIF:
   - take the first frame,
   - trim the surrounding transparent margin (so the Mewtwo fills the icon — this
     removes empty space only, it does not change the Mewtwo),
   - pad back to a square canvas so the aspect ratio is preserved,
   - export as PNG (square, e.g. 128×128) with transparency preserved.

### 1. Favicon — `index.html`

- Current (broken) line:
  `<link rel="icon" type="image/svg+xml" href="/PokeMMO-Breeding-Calculator/vite.svg" />`
  (referenced `vite.svg` does not exist).
- Replace with a PNG icon link pointing at `public/favicon.png`, following the
  existing base-path style used in the file. Confirm during implementation whether
  this project hardcodes the base path (as the current line does) or relies on
  Vite's base rewriting, and match the working convention.

### 2. Header logo — `src/components/AppLayout.tsx`

- The header is a Mantine `AppShell.Header` containing a `Group` with a `Burger`
  and a `Title` ("PokeMMO Breeding Calculator") at roughly `AppLayout.tsx:20–24`.
- Add an `<img>` for the animated GIF inside that `Group`, **between the Burger and
  the Title**:
  - `src` = the GIF in `public/` (resolved against the app base path, e.g. via
    `import.meta.env.BASE_URL`),
  - `alt="Mewtwo"`,
  - height ≈ 32px (matches the `Title order={3}` text scale), width auto.
- Do not change the title text or other header behavior.

## Testing (mandatory)

These changes are observable in the running app → **e2e (Playwright)**. Extend the
most relevant existing layout/header spec if one fits; otherwise add a focused spec.

- Favicon: the document's `<link rel="icon">` resolves to `favicon.png`, and the
  file loads successfully (HTTP 200).
- Header logo: the header renders an `<img>` whose `src` points to the Mewtwo GIF
  and which has `alt="Mewtwo"`, positioned before the title text.

No unit tests apply (no pure logic added). If the diff is purely the above, that is
the complete test surface.

## Out of scope

- PWA manifest, `apple-touch-icon`, multiple favicon sizes / `.ico`.
- Recoloring or redrawing the Mewtwo.
- Any header behavior beyond inserting the logo image.
