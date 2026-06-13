# Nature dropdown stat-change labels — design

## Goal

Each nature `<Select>` option shows its stat effect appended to the nature name,
so the user can see what a nature does without leaving the dropdown:

- Effect natures: `Adamant +Atk −SpA`, `Modest +SpA −Atk`, `Jolly +Spe −SpA`
- Neutral natures (Hardy, Docile, Serious, Bashful, Quirky): `Hardy neutral`

The label format is **plain** (no parentheses), the boost uses `+` and the drop
uses the U+2212 minus sign `−` to visually pair with `+`.

## Existing building blocks (reused, not duplicated)

- `src/data/natures.ts`
  - `NATURES`: string array of the 25 nature names.
  - `NATURE_EFFECT`: `Record<string, { up: StatKey | null; down: StatKey | null }>`.
    Neutral natures have both `up` and `down` as `null`.
- `STAT_LABELS`: `Record<StatKey, string>` mapping `hp→'HP', atk→'Atk',
  def→'Def', spa→'SpA', spd→'SpD', spe→'Spe'`. Currently defined in
  `src/features/projects/projectHelpers.ts` and (duplicated) in
  `src/features/projects/GoalForm.tsx`.

## Change

### 1. Shared formatter

Add a single helper:

```ts
formatNatureLabel(nature: string): string
```

- For an effect nature: `` `${nature} +${STAT_LABELS[up]} −${STAT_LABELS[down]}` ``
  → `Adamant +Atk −SpA`.
- For a neutral nature (`up`/`down` null): `` `${nature} neutral` `` → `Hardy neutral`.

It reuses the existing `NATURE_EFFECT` and `STAT_LABELS` — no new copy of stat
labels is introduced. The helper lives in one shared module that all call sites
can import (the implementation plan picks the exact location; `projectHelpers.ts`
already owns `STAT_LABELS`, so it is the natural home). If reusing the existing
`STAT_LABELS` is trivially blocked by import direction, consolidate to the single
existing copy rather than adding a third; do not otherwise refactor the
pre-existing duplication.

### 2. Apply to all three dropdowns

Each dropdown currently builds options as
`NATURES.map((n) => ({ value: n, label: n }))`. Change `label` to
`formatNatureLabel(n)` in:

1. `src/features/projects/GoalForm.tsx` — goal nature select.
2. `src/features/projects/ProjectDetailPage.tsx` — baby nature select.
3. The OwnedPokemon nature picker (owned feature).

**`value` stays the bare nature name** in every case. Stored data, form state,
and any code/tests selecting by value are unaffected — only the visible option
text and the selected-value display change.

## Testing

- **Unit** (`formatNatureLabel`):
  - An effect nature → `Adamant` produces `"Adamant +Atk −SpA"`.
  - A neutral nature → `Hardy` produces `"Hardy neutral"`.
- **E2E**: existing specs select natures by `value`, so they keep passing.
  Add/adjust one assertion that a rendered option's visible label includes its
  stat changes (e.g. an option labeled `Adamant +Atk −SpA`).

## Out of scope

- Sorting or grouping natures by stat.
- Colors/icons for the up/down stats.
- Refactoring the pre-existing `STAT_LABELS` duplication beyond what reuse of the
  formatter trivially requires.
