# Goal form: explicit "Any" option for nature & ability

**Date:** 2026-06-13
**Status:** Approved design

## Problem

In the breeding goal form (`src/features/projects/GoalForm.tsx`), the **nature** and
**ability** dropdowns are optional. When nothing is selected they show an "Any nature" /
"Any ability" placeholder, and a small clear (✕) button resets them. But there is no
explicit "Any" item *inside* the dropdown list. Once a user picks a concrete value, the
only way back to "any" is the ✕ button — which is easy to miss. Users expect to be able to
re-select "any/nothing" directly from the open list.

## Scope

- **In scope:** the nature and ability `<Select>` controls in `GoalForm.tsx` only.
- **Out of scope:** the owned Pokémon form (a caught Pokémon always has a concrete
  nature/ability, so "any" is not meaningful there), the store types, and the breeding
  engine.

## Design

1. Prepend an explicit **"Any nature"** / **"Any ability"** item to the top of each
   dropdown's option list.
2. Mantine's `Select` keys options by string value and represents "no selection" as
   `null`. The "Any" item therefore needs a stable, non-empty sentinel value
   (`'__ANY__'`). Selecting it maps back to `null` in form state; an incoming
   `null`/`undefined` value continues to render the existing "Any nature"/"Any ability"
   placeholder. The visible state when nothing is picked is unchanged — the new list item
   only adds a way to *re-pick* "any" from inside the open list.
3. **Keep** the existing `clearable` ✕ button. Both the ✕ and the "Any" list item reset to
   "any".
4. Submission is untouched: the existing `null → undefined` mapping
   (`GoalForm.tsx:169-170`) already handles the "any" case.

### Data flow

```
Select onChange(value):
  value === '__ANY__'  → setFieldValue(field, null)
  otherwise            → setFieldValue(field, value)
```

Everything downstream already keys off "is the goal's nature/ability set or not":

- `engine/planner.ts:158-159` — `if (goal.nature && mon.nature !== goal.nature) return false`
  (and the ability equivalent) treats a missing value as "matches anything".
- `engine/cost.ts:125-129` — Ability Pill cost estimate is gated on `goal.ability` being set.

No engine or type changes are required.

### Sentinel safety

`'__ANY__'` cannot collide with a real option: it is not among the 25 entries in
`NATURES` (`src/data/natures.ts`) and is not a valid ability name. This will be confirmed
during implementation.

## Testing

This is observable UI behavior → **e2e (Playwright)** test in `/e2e/`. Extend the most
relevant existing goal-form spec rather than adding a new file:

- Select a concrete nature, then select "Any nature" from the list; assert the goal
  reverts to the "any" state (placeholder shown / value cleared).
- Same for ability.

## Success criteria

- The nature and ability dropdowns each show an "Any …" item at the top of the list.
- Selecting that item returns the field to the "any" state (placeholder visible, value
  effectively `undefined` on submission).
- The ✕ clear button still works.
- e2e test covers re-selecting "any" for both fields; `test:unit`, `test:e2e`,
  `tsc -b`, and `eslint .` all pass.
