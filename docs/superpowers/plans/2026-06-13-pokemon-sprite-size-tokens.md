# Pokémon Sprite Size Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc per-call-site numeric sprite sizes with three shared named size tokens (`sm`=56, `md`=80, `lg`=120 px), making every Pokémon sprite ~2.3–2.8x bigger.

**Architecture:** A `const AVATAR_SIZES` map and an `AvatarSize` union type live inside `PokemonAvatar.tsx` (the single component all sprites render through). The `size` prop changes from `number` to `'sm' | 'md' | 'lg'`; the component resolves the token to px internally. All ~12 call sites migrate from `size={N}` to `size="<token>"` using a value→token mapping. The prop-type change makes TypeScript flag every un-migrated call site.

**Tech Stack:** React + TypeScript, Mantine UI (inline styles), Vitest (unit, jsdom), Playwright (e2e). Sprites keep `imageRendering: 'pixelated'`.

**Value → token mapping (applies everywhere):**

| Old `size={N}` | New token | Resolved px |
|---|---|---|
| 20, 24 | `sm` | 56 |
| 28, 32, 36 | `md` | 80 |
| 48 | `lg` | 120 |

---

### Task 1: Convert `PokemonAvatar` to size tokens

**Files:**
- Modify: `src/components/PokemonAvatar.tsx`
- Test: `src/components/PokemonAvatar.test.tsx`

- [ ] **Step 1: Update the existing dimension test and add token-resolution cases**

In `src/components/PokemonAvatar.test.tsx`, replace this existing test (currently around lines 51–56):

```tsx
  it('applies the given size to img dimensions', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} size={64} />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('64');
    expect(img.getAttribute('height')).toBe('64');
  });
```

with these three tests:

```tsx
  it('resolves the "lg" size token to img dimensions', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} size="lg" />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('120');
    expect(img.getAttribute('height')).toBe('120');
  });

  it('resolves the "sm" size token to img dimensions', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} size="sm" />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('56');
    expect(img.getAttribute('height')).toBe('56');
  });

  it('defaults to the "md" size token (80px) when no size is given', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('80');
    expect(img.getAttribute('height')).toBe('80');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- src/components/PokemonAvatar.test.tsx`
Expected: FAIL — `size="lg"` is a type/runtime mismatch against the current numeric prop; `width` resolves to the literal default `40` (or NaN), not `120`/`56`/`80`.

- [ ] **Step 3: Implement size tokens in the component**

Replace the full contents of `src/components/PokemonAvatar.tsx` with:

```tsx
import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { getSpeciesById } from '../data/index';

const AVATAR_SIZES = { sm: 56, md: 80, lg: 120 } as const;
type AvatarSize = keyof typeof AVATAR_SIZES;

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
        <img
          src={species.spriteUrl}
          alt={species.name}
          width={px}
          height={px}
          loading="lazy"
          style={{ imageRendering: 'pixelated', flexShrink: 0 }}
          onError={() => setImgError(true)}
        />
      )}
      {showName && <Text size="sm">{species.name}</Text>}
    </Box>
  );
}
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npm run test:unit -- src/components/PokemonAvatar.test.tsx`
Expected: PASS (all three new tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/PokemonAvatar.tsx src/components/PokemonAvatar.test.tsx
git commit -m "feat: add size tokens to PokemonAvatar (sm/md/lg)"
```

---

### Task 2: Migrate all call sites to size tokens

After Task 1, `tsc -b` reports a type error at every site still passing `size={<number>}`. Fix each by applying the value→token mapping.

**Files (each line is the current `<PokemonAvatar ... size={N} ... />`):**
- Modify: `src/features/projects/ProjectsPage.tsx` — `size={36}` → `size="md"`
- Modify: `src/features/owned/OwnedPokemonList.tsx` — `size={48}` → `size="lg"`
- Modify: `src/components/SpeciesSelect.tsx` — `size={24}` → `size="sm"`
- Modify: `src/features/projects/ProjectDetailPage.tsx` — nine usages (see step below)

- [ ] **Step 1: Migrate the single-usage files**

In `src/features/projects/ProjectsPage.tsx`:
```tsx
<PokemonAvatar speciesId={project.goal.speciesId} size="md" />
```

In `src/features/owned/OwnedPokemonList.tsx`:
```tsx
<PokemonAvatar speciesId={mon.speciesId} size="lg" />
```

In `src/components/SpeciesSelect.tsx`:
```tsx
{species && <PokemonAvatar speciesId={id} size="sm" />}
```

- [ ] **Step 2: Migrate all nine usages in `ProjectDetailPage.tsx`**

Apply the value→token mapping to each `PokemonAvatar` in `src/features/projects/ProjectDetailPage.tsx`. The full set of replacements (left = current, right = new):

```tsx
// goal-species header: 48 -> lg
{species && <PokemonAvatar speciesId={species.id} size="lg" />}

// offspring species display: 32 -> md
<PokemonAvatar speciesId={offspringSpecies.id} size="md" showName />

// parent match: 32 -> md
//   (the parent-match avatar currently using size={32})
//   change size={32} to size="md"

// parent A: 32 -> md
<PokemonAvatar speciesId={parentA.speciesId} size="md" showName />

// parent B: 32 -> md
<PokemonAvatar speciesId={parentB.speciesId} size="md" showName />

// child Pokémon: 28 -> md
//   (the child avatar currently using size={28})
//   change size={28} to size="md"

// offspring species list: 24 -> sm
<PokemonAvatar speciesId={offSp.id} size="sm" showName />

// alternative-species rows (two usages): 20 -> sm
<PokemonAvatar key={altId} speciesId={alt.speciesId} size="sm" />
<PokemonAvatar key={altId} speciesId={alt.speciesId} size="sm" />
```

Practical check: after editing, there must be **zero** occurrences of a numeric `size={` on a `PokemonAvatar` anywhere in the file. Verify with:

```bash
grep -n 'PokemonAvatar' src/features/projects/ProjectDetailPage.tsx
grep -rn 'size={[0-9]' src/   # expect: no PokemonAvatar matches
```

- [ ] **Step 3: Typecheck to confirm every call site is migrated**

Run: `npm run typecheck`
Expected: PASS (no `Type 'number' is not assignable to type 'AvatarSize'` errors). Any remaining error points at a missed call site — fix it.

- [ ] **Step 4: Run the full unit suite**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/ProjectsPage.tsx src/features/projects/ProjectDetailPage.tsx src/features/owned/OwnedPokemonList.tsx src/components/SpeciesSelect.tsx
git commit -m "feat: migrate all sprite call sites to size tokens"
```

---

### Task 3: Add an e2e assertion that the owned-card sprite uses the `lg` token

The owned-list card sprite is the `lg` (120px) token — a good real-render check. Extend the existing "adds a Pokémon" test in `e2e/owned.spec.ts`.

**Files:**
- Modify: `e2e/owned.spec.ts`

- [ ] **Step 1: Add the dimension assertion to the existing add test**

In `e2e/owned.spec.ts`, in the test `'adds a Pokémon through the form and shows it in the list'`, immediately after the final assertion (`await expect(page.getByText('Bulbasaur')).toBeVisible();`), add:

```tsx
    // The owned-list card sprite renders at the large size token (120px)
    const cardSprite = page.getByRole('img', { name: 'Bulbasaur' });
    await expect(cardSprite).toHaveAttribute('width', '120');
    await expect(cardSprite).toHaveAttribute('height', '120');
```

- [ ] **Step 2: Build the preview bundle the e2e server serves**

Run: `npm run build`
Expected: PASS (Playwright's `webServer` runs `npm run preview`, which serves the built bundle).

- [ ] **Step 3: Run the owned e2e spec to verify the assertion passes**

Run: `npm run test:e2e -- owned.spec.ts`
Expected: PASS — including the new width/height assertions.

- [ ] **Step 4: Commit**

```bash
git add e2e/owned.spec.ts
git commit -m "test: assert owned-card sprite uses lg size token (120px)"
```

---

### Task 4: Full verification gate + visual check

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

Run each and confirm green:
```bash
npm run typecheck
npm run lint
npm run test:unit
npm run build && npm run test:e2e
```
Expected: all PASS. If an e2e test other than the owned spec fails because a sprite grew (e.g. a layout/overlap issue), note it — that's the layout-nudge follow-up below, not a regression in logic.

- [ ] **Step 2: Visual check in the running app**

Run: `npm run dev`, then open the app and look at: Projects list card icons, the Project detail header (goal species), parents shown side-by-side, the offspring/alternative species lists, the species-select dropdown, and the Owned Pokémon cards.

Confirm sprites are visibly ~2.3–2.8x larger and nothing overlaps or clips. If a specific row feels tight (parents side-by-side, dropdown option height are the likely spots), nudge only that container's Mantine spacing (`gap`/`Group` props) — do not redo layout. If you make a layout nudge, add/adjust the relevant e2e assertion and commit separately.

- [ ] **Step 3: Final commit (only if Step 2 required layout nudges)**

```bash
git add -A
git commit -m "fix: adjust spacing for larger sprites"
```

---

## Notes for the implementer

- Sprites are intentionally low-resolution and use `imageRendering: 'pixelated'`; they will look chunky at the new sizes — that is expected, not a bug.
- Do not reintroduce numeric `size` support on `PokemonAvatar`. Tokens only.
- The default size is now `md` (80px). No current call site relies on the default, but keep it correct for future callers.
