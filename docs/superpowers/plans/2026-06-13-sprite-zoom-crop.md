# Sprite Zoom / Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crop the transparent padding around Pokémon sprites so the creature fills its frame, by scaling the image inside a fixed-size `overflow: hidden` box — without changing any layout footprint.

**Architecture:** In `PokemonAvatar.tsx`, add a module-level `SPRITE_ZOOM` constant and wrap the success-branch `<img>` in a token-px-sized box with `overflow: hidden`. The img keeps its `width`/`height={px}` attributes and gains `transform: scale(SPRITE_ZOOM)` (centered), so the enlarged transparent margins overflow the box and are clipped. The box footprint stays the token px, so layout is unchanged.

**Tech Stack:** React + TypeScript, Mantine UI (inline styles), Vitest (unit, jsdom + Testing Library), Playwright (e2e).

---

### Task 1: Add zoom/crop to `PokemonAvatar`

**Files:**
- Modify: `src/components/PokemonAvatar.tsx`
- Test: `src/components/PokemonAvatar.test.tsx`

- [ ] **Step 1: Write the failing test**

In `src/components/PokemonAvatar.test.tsx`, add this test (place it alongside the existing token-size tests, inside the same top-level `describe`/file — after the `defaults to the "md" size token` test):

```tsx
  it('zooms the sprite via a centered transform inside an overflow-hidden frame', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} size="lg" />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    // Zoom is applied as a CSS transform on the img (attributes stay at the token px).
    expect(img.style.transform).toBe('scale(1.4)');
    // The img is wrapped in a fixed-size frame that clips the overflowing margins.
    expect(img.parentElement?.style.overflow).toBe('hidden');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- src/components/PokemonAvatar.test.tsx`
Expected: FAIL — the img currently has no `transform` (so `img.style.transform` is `''`), and its parent is the outer inline-flex Box with no `overflow`.

- [ ] **Step 3: Implement the zoom in the component**

Replace the FULL contents of `src/components/PokemonAvatar.tsx` with:

```tsx
import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { getSpeciesById } from '../data/index';

const AVATAR_SIZES = { sm: 56, md: 80, lg: 120 } as const;
type AvatarSize = keyof typeof AVATAR_SIZES;

const SPRITE_ZOOM = 1.4; // crops ~15% of transparent margin per edge

interface PokemonAvatarProps {
  speciesId: number;
  size?: AvatarSize;
  showName?: boolean;
}

export function PokemonAvatar({ speciesId, size = 'md', showName = false }: PokemonAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const species = getSpeciesById(speciesId);
  const px = AVATAR_SIZES[size];

  if (!species) {
    return (
      <Box
        style={{
          width: px,
          height: px,
          backgroundColor: 'var(--mantine-color-gray-2)',
          borderRadius: 4,
          display: 'inline-block',
        }}
        aria-label="Unknown Pokémon"
      />
    );
  }

  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {imgError ? (
        <Box
          style={{
            width: px,
            height: px,
            backgroundColor: 'var(--mantine-color-gray-2)',
            borderRadius: 4,
            flexShrink: 0,
          }}
          aria-label={species.name}
        />
      ) : (
        <Box
          style={{
            width: px,
            height: px,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={species.spriteUrl}
            alt={species.name}
            width={px}
            height={px}
            loading="lazy"
            style={{ imageRendering: 'pixelated', transform: `scale(${SPRITE_ZOOM})` }}
            onError={() => setImgError(true)}
          />
        </Box>
      )}
      {showName && <Text size="sm">{species.name}</Text>}
    </Box>
  );
}
```

Note: the `<img>` keeps `width={px}`/`height={px}` (so the existing dimension tests still pass); the `flexShrink: 0` moved from the img to the new wrapper Box. The fallback boxes are unchanged.

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npm run test:unit -- src/components/PokemonAvatar.test.tsx`
Expected: PASS — the new zoom test passes AND all existing tests (width/height = 120/56/80, default md, unknown species, error fallback, showName) still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/PokemonAvatar.tsx src/components/PokemonAvatar.test.tsx
git commit -m "feat: zoom/crop sprite padding via scale-and-clip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add an e2e assertion that the owned-card sprite is zoomed

The owned-card sprite already has an e2e test asserting its 120px footprint. Extend it to also assert a non-identity transform (proves the zoom is applied in the real, built app).

**Files:**
- Modify: `e2e/owned.spec.ts`

- [ ] **Step 1: Add the transform assertion**

In `e2e/owned.spec.ts`, find the test `'adds a Pokémon through the form and shows it in the list'`. It already contains these lines:

```tsx
    // The owned-list card sprite renders at the large size token (120px)
    const cardSprite = page.getByRole('img', { name: 'Bulbasaur' });
    await expect(cardSprite).toHaveAttribute('width', '120');
    await expect(cardSprite).toHaveAttribute('height', '120');
```

Immediately AFTER those lines (still inside the test), add:

```tsx
    // The sprite is zoomed/cropped via a CSS transform (matrix, not identity)
    const transform = await cardSprite.evaluate((el) => getComputedStyle(el).transform);
    expect(transform).not.toBe('none');
    expect(transform).toContain('matrix');
```

- [ ] **Step 2: Build the preview bundle**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run the owned e2e spec (stale-server-safe)**

Run: `pkill -f "vite preview" || true` then `npm run test:e2e -- owned.spec.ts`
Expected: PASS — including the new transform assertions. (The `pkill` avoids a stale preview server from another worktree serving an old bundle.)

- [ ] **Step 4: Commit**

```bash
git add e2e/owned.spec.ts
git commit -m "test: assert owned-card sprite has a zoom transform

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Full verification gate + visual check

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite (stale-server-safe)**

Run each and confirm green:
```bash
npm run typecheck
npm run lint
npm run test:unit
pkill -f "vite preview" || true && npm run build && npm run test:e2e
```
Expected: all PASS.

- [ ] **Step 2: Visual check via screenshots**

Build and serve on a dedicated port to avoid stale bundles, then capture the key views with Playwright (save PNGs under a scratch dir, e.g. the job tmp dir):
- Owned page with a Pokémon added (`#/owned`) — `lg` sprite.
- Projects list (`#/projects`) — `md` sprite.
- Project detail (`#/projects` → open the project) — `lg` header sprite.
- Species dropdown open in the add form — `sm` sprites.

Confirm: the creature now fills the frame with the padding cropped, and no important sprite detail (Charizard wings, etc.) is clipped at `SPRITE_ZOOM = 1.4`. If clipping looks too aggressive or too subtle, adjust the single `SPRITE_ZOOM` constant in `src/components/PokemonAvatar.tsx` and re-check (update the `scale(1.4)` value in the Task 1 unit test to match if you change it), then commit the tweak.

- [ ] **Step 3: Final commit (only if Step 2 required a SPRITE_ZOOM tweak)**

```bash
git add src/components/PokemonAvatar.tsx src/components/PokemonAvatar.test.tsx
git commit -m "fix: tune SPRITE_ZOOM crop factor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- Do NOT touch the call sites — this change is entirely inside `PokemonAvatar`.
- Keep the img `width`/`height={px}` attributes; the zoom must be the CSS transform only, so the layout footprint and existing dimension assertions stay intact.
- Sprites remain `imageRendering: 'pixelated'` — pixelated upscaling is intended.
- `SPRITE_ZOOM` is the single source of truth for the crop; if you change it, update the unit test's expected `scale(...)` string.
