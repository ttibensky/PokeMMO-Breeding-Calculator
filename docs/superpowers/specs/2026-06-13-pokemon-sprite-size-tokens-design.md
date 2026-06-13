# Pokémon sprite size tokens

**Date:** 2026-06-13
**Status:** Approved, pending implementation plan

## Goal

Make the Pokémon sprites across the app roughly 2–3x bigger than they are today,
while replacing the current ad-hoc per-call-site sizes with a small set of shared,
named size tokens defined in one place.

## Background

All Pokémon sprites render through a single central component,
`src/components/PokemonAvatar.tsx`, which takes a numeric `size` prop (px) and applies
it as the `<img>` `width`/`height` (and to the error-fallback `Box`). Sprites are
rendered with `imageRendering: 'pixelated'`.

Today the `size` value is hardcoded independently at ~12 call sites, producing 6
distinct sizes (20, 24, 28, 32, 36, 48 px) with no single source of truth. Styling is
Mantine inline styles; there is no Tailwind/CSS-modules layer.

## Design

### 1. Size tokens (single source of truth)

In `PokemonAvatar.tsx`, define a size map and change the `size` prop from a raw number
to a named token:

```ts
const AVATAR_SIZES = { sm: 56, md: 80, lg: 120 } as const
type AvatarSize = keyof typeof AVATAR_SIZES // 'sm' | 'md' | 'lg'
```

- The component resolves the token to px internally for `width`/`height` and for the
  error-fallback `Box`.
- Default `size` becomes `md` (80px).
- `imageRendering: 'pixelated'` is unchanged — sprites are low-resolution, so they
  remain intentionally chunky at the larger sizes (consistent with current behavior).
- The prop accepts only `'sm' | 'md' | 'lg'`. Raw numeric sizes are no longer
  supported (YAGNI — every call site is being migrated to tokens).

### 2. Call-site mapping

All 12 sprite render sites switch from a raw number to a token:

| Token | New px | Replaces (old px) | Call sites |
|---|---|---|---|
| `sm` | 56 | 20, 24 | `SpeciesSelect.tsx` dropdown option (24); `ProjectDetailPage.tsx` offspring species list (24), alternative-species rows (20, 20) |
| `md` | 80 | 28, 32, 36 | `ProjectsPage.tsx` project card icon (36); `ProjectDetailPage.tsx` child Pokémon (28), parent match (32), parent A (32), parent B (32), offspring species display (32) |
| `lg` | 120 | 48 | `OwnedPokemonList.tsx` owned card (48); `ProjectDetailPage.tsx` goal-species header (48) |

This yields roughly a 2.3–2.8x increase across the board.

### 3. Layout

`lg`=120 and `md`=80 are substantially larger than today's 48/32. Surrounding Mantine
`Group`/`Stack` layouts are flex-based and should reflow, but a few spots (parents
shown side-by-side, dropdown option row height) may feel tight.

Approach: scale first, then verify in the running app and nudge spacing only where it
actually breaks. No preemptive layout rework.

### 4. Testing

- **e2e (Playwright):** This is a visible/behavioral change. Update the most relevant
  existing spec to assert rendered sprite dimensions reflect the new tokens — e.g. the
  owned-Pokémon card sprite is 120px and a dropdown-option sprite is 56px.
- **unit (Vitest):** If warranted, a small test on `PokemonAvatar` that each token
  resolves to the correct px value.

## Out of scope

- Changing the sprite source/URLs or resolution.
- Any layout redesign beyond minimal spacing nudges needed to accommodate larger
  sprites.
- Introducing a broader design-token system beyond these three avatar sizes.
