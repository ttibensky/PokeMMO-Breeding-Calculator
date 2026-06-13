# Sprite zoom / crop (remove transparent padding)

**Date:** 2026-06-13
**Status:** Approved, pending implementation plan

## Goal

Make the Pokémon in each sprite fill its frame by cropping the large transparent
margin around the artwork, without changing any layout footprint.

## Background

All sprites render through `src/components/PokemonAvatar.tsx`. The source assets are
PokeAPI 96×96 PNGs (`spriteUrl` = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`)
in which the creature occupies the center of the canvas with substantial transparent
padding on all sides. The `<img>` currently renders at the exact size-token px
(`sm`=56 / `md`=80 / `lg`=120) with no clipping, so that padding shows as empty space
(visible in the Owned, Projects, and Project-detail views).

The avatar already uses size tokens (`AVATAR_SIZES`) and `imageRendering: 'pixelated'`.

## Design

### 1. Mechanism: scale-and-clip

Wrap the `<img>` in a fixed-size box equal to the token px with `overflow: hidden`, and
scale the image up with CSS `transform: scale(SPRITE_ZOOM)` (centered, default
transform-origin). The enlarged transparent margins overflow the box and are clipped,
so the creature fills the frame.

- The wrapper box footprint stays exactly the token px → **no layout change**; only the
  visible content inside changes.
- The `<img>` keeps its `width={px}` / `height={px}` attributes; the zoom is purely the
  CSS transform. Existing dimension assertions remain valid.

### 2. Configuration: a single constant

Add a module-level constant in `PokemonAvatar.tsx`, next to `AVATAR_SIZES`:

```ts
const SPRITE_ZOOM = 1.4; // crops ~15% of transparent margin per edge
```

Tuning the crop = editing this one number; it applies uniformly to every sprite. `1.4`
is the chosen default: it removes most padding while staying safe against clipping
sprites that already fill more of their 96×96 frame (e.g. Charizard, legendaries).

### 3. Component structure (success-render branch)

```tsx
<Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
  {showName && <Text size="sm">{species.name}</Text>}
</Box>
```

The two fallback boxes (unknown species, image-load error) are unchanged — they are
solid color blocks with nothing to crop.

### 4. Testing

- **Unit (Vitest):** Existing img `width`/`height` attribute tests stay green (attributes
  unchanged). Add a test asserting the rendered img has inline style
  `transform: scale(1.4)` and that it is nested inside a wrapper element with
  `overflow: hidden`.
- **e2e (Playwright):** The existing owned-card 120px assertion still passes (footprint
  unchanged). Add a light assertion that the owned-card sprite img has a non-identity
  computed `transform` (i.e. not `none`).
- **Visual:** Capture real screenshots of the Owned / Projects / Project-detail views to
  confirm the crop looks right and no important sprite detail is clipped.

## Out of scope

- Changing sprite sources, resolution, or the size tokens.
- Per-component zoom overrides or a user-facing zoom setting (a single constant only).
- Per-sprite/individual crop tuning (the crop is one uniform factor).
