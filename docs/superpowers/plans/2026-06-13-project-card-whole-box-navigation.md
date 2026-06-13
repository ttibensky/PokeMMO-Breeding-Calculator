# Project Card Whole-Box Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make clicking anywhere on a project card navigate to the project detail view (`/projects/:id`), while the edit and delete icons keep their existing behavior and do not navigate.

**Architecture:** Stretched-link pattern. The existing title `<Link>` keeps its text content but gets an absolutely-positioned overlay child (`<span>`) that fills the whole card (the card becomes the positioning context). The edit/delete icon group is raised above the overlay with `z-index`, so the icons stay independently clickable with no `stopPropagation`. The overlay is a descendant of the same anchor as the title, so existing title-click tests keep working unchanged.

**Tech Stack:** React 18, react-router-dom 6 (hash routing), Mantine 7 (inline `style` props — no CSS Modules/Tailwind), Playwright e2e.

---

## Background / current state

`ProjectCard` lives in `src/features/projects/ProjectsPage.tsx:30–120`. Today only the title is a link:

```tsx
<Card withBorder radius="md" padding="md" shadow="sm">
  <Stack gap="xs">
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Group gap="xs" style={{ minWidth: 0 }}>
        <PokemonAvatar speciesId={project.goal.speciesId} size={36} />
        <Text
          component={Link}
          to={`/projects/${project.id}`}
          fw={600}
          size="sm"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </Text>
      </Group>
      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Tooltip label="Edit">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => onEdit(project.id)}
            aria-label={`Edit ${project.name}`}
          >
            ✏️
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={() => onDelete(project.id)}
            aria-label={`Delete ${project.name}`}
          >
            🗑️
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
    {/* ...goal summary, badge, cost, progress — unchanged... */}
  </Stack>
</Card>
```

Relevant facts:
- The title is **already** styled as plain text (`textDecoration: 'none'`, `color: 'inherit'`), so no visual restyle is needed — it already does not look like a link. The work is purely making the whole box clickable.
- Edit/Delete are `ActionIcon` buttons with `aria-label={`Edit ${name}`}` / `aria-label={`Delete ${name}`}`. Tests target them via `getByRole('button', { name: '...' })`.
- Routing: list = `#/projects`, detail = `#/projects/:id` (hash routing; `baseURL` in `playwright.config.ts` is `http://localhost:4173/PokeMMO-Breeding-Calculator/`).
- No `data-testid` exists anywhere yet; the codebase selects by role/aria-label/text. We add one `data-testid` to the card to enable a reliable "click the body, not the title" test — a justified testability hook.
- eslint config has no `jsx-a11y` plugin, and the title `<Link>` keeps its text content, so there is no empty-anchor lint risk.

### Why the overlay isn't clipped by the title's `overflow: hidden`

The overlay `<span>` is absolutely positioned. Its containing block is the nearest **positioned** ancestor — the `Card` (we give it `position: relative`), not the title `<Link>` (which is `position: static`). A box only clips abspos descendants whose containing block is itself or one of its descendants; since the span's containing block (`Card`) is an *ancestor* of the `<Link>`, the `<Link>`'s `overflow: hidden` does not clip the span. The span therefore fills the whole card. (This is the same behavior Bootstrap's `.stretched-link` relies on.)

### Stacking

`Card` gets `position: relative` with no `z-index`, so it does **not** form a stacking context. The overlay span (`zIndex: 1`) and the icon group (`zIndex: 2`) resolve in the same (root) stacking context: overlay paints above the card's `z-auto` content (badge/cost/progress + title text), and the icons paint above the overlay. Each card's overlay is geometrically confined to its own card (`inset: 0` of its own `Card`), so overlays never cover sibling cards.

### Testing approach

This change is observable behavior (navigation), so **e2e (Playwright) only** — there is no pure unit to assert. We extend `e2e/projects.spec.ts`:
1. Clicking the card body (not the title/icons) navigates to `#/projects/:id`.
2. Clicking the edit icon opens the edit modal and stays on `#/projects` (no navigation).
3. Clicking the delete icon (existing test 7) stays on `#/projects` (add an explicit URL assertion).

Existing title-click tests (lines 204, 301) need **no change**: clicking the title now hits the overlay span, which is a descendant of the same `<Link>`, so Playwright's actionability check passes and navigation still fires.

**Run note:** the Playwright `webServer` runs `npm run preview`, which serves the last `vite build` output. Always `npm run build` before `npm run test:e2e` so e2e runs against current code.

---

## File Structure

- **Modify:** `src/features/projects/ProjectsPage.tsx` — `ProjectCard` only (card `style` + `data-testid`, overlay `<span>` inside the title `<Link>`, `z-index` on the icon group). ~6 lines changed/added.
- **Modify (tests):** `e2e/projects.spec.ts` — add two tests, add one assertion to the existing delete test.

No other files change. Routes, the edit modal (`GoalForm`), delete confirmation, `ProjectDetailPage`, and the Owned Pokémon list are untouched.

---

### Task 1: Whole-card navigation (TDD)

**Files:**
- Test: `e2e/projects.spec.ts`
- Modify: `src/features/projects/ProjectsPage.tsx:43-90` (the `ProjectCard` `return`)

- [ ] **Step 1: Write the failing e2e test**

Add this test inside the `test.describe('Projects feature', ...)` block in `e2e/projects.spec.ts` (e.g. right after test 1, before the validation test):

```ts
// ── Whole-card navigation ────────────────────────────────────────────────────
test('clicking anywhere on the card (not just the title) opens the project detail', async ({ page }) => {
  await freshStart(page);

  await openGoalFormAndFill(page, {
    trigger: 'emptyState',
    name: 'Click Anywhere',
    species: 'Bulbasaur',
    stats: ['Target HP', 'Target Atk'],
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Click the card body. The click lands at the card's center (the badge/cost row),
  // away from the title and the edit/delete icons — proving the whole box is clickable.
  await page.getByTestId('project-card').click();

  // Navigated to the detail view (#/projects/<id>)
  await expect(page.getByRole('heading', { name: 'Click Anywhere' })).toBeVisible();
  await expect(page).toHaveURL(/#\/projects\/.+/);
});
```

- [ ] **Step 2: Build, then run the test to verify it fails**

Run:
```bash
npm run build && npx playwright test e2e/projects.spec.ts -g "clicking anywhere on the card"
```
Expected: FAIL. `page.getByTestId('project-card')` finds nothing (no `data-testid` yet) → the click times out / element not found.

- [ ] **Step 3: Implement the stretched-link changes in `ProjectCard`**

In `src/features/projects/ProjectsPage.tsx`, make exactly these three edits to `ProjectCard`'s JSX:

**(a) Card opening tag** — add `data-testid` and `style`:

```tsx
<Card
  withBorder
  radius="md"
  padding="md"
  shadow="sm"
  data-testid="project-card"
  style={{ position: 'relative', cursor: 'pointer' }}
>
```

**(b) Title `<Link>`** — add the overlay `<span>` as the last child (keep everything else identical):

```tsx
<Text
  component={Link}
  to={`/projects/${project.id}`}
  fw={600}
  size="sm"
  style={{
    textDecoration: 'none',
    color: 'inherit',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }}
>
  {project.name}
  {/* Stretched-link overlay: expands this link's hit area to the whole card.
      Its containing block is the relatively-positioned Card, so it is not
      clipped by this link's overflow:hidden. */}
  <span
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
  />
</Text>
```

**(c) Icon group** — raise it above the overlay so the icons stay clickable:

```tsx
<Group
  gap={4}
  wrap="nowrap"
  style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}
>
```

Leave the goal-summary text, status badge, cost text, and progress bar exactly as they are.

- [ ] **Step 4: Build, then run the test to verify it passes**

Run:
```bash
npm run build && npx playwright test e2e/projects.spec.ts -g "clicking anywhere on the card"
```
Expected: PASS — clicking the card body navigates to the detail view and the heading "Click Anywhere" is visible.

- [ ] **Step 5: Run the full projects spec to confirm no regressions**

Run:
```bash
npm run build && npx playwright test e2e/projects.spec.ts
```
Expected: PASS for all tests, including the existing title-click tests (`full breed report...` and `abandoning a project...`) which click the title and still navigate via the overlay.

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/ProjectsPage.tsx e2e/projects.spec.ts
git commit -m "feat: make whole project card navigate to detail view"
```

---

### Task 2: Icon guards — confirm edit/delete do not navigate

**Files:**
- Test: `e2e/projects.spec.ts`

- [ ] **Step 1: Add the edit-icon no-navigation test**

Add this test inside the `test.describe('Projects feature', ...)` block:

```ts
// ── Edit icon does not navigate ──────────────────────────────────────────────
test('clicking the edit icon opens the edit modal without navigating to the detail', async ({ page }) => {
  await freshStart(page);

  await openGoalFormAndFill(page, {
    trigger: 'emptyState',
    name: 'Edit No Nav',
    species: 'Bulbasaur',
    stats: ['Target HP', 'Target Atk'],
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Click the edit icon — opens the GoalForm modal, must NOT navigate.
  await page.getByRole('button', { name: 'Edit Edit No Nav' }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  // Still on the list URL (#/projects), not the detail view (#/projects/<id>).
  await expect(page).toHaveURL(/#\/projects$/);
});
```

- [ ] **Step 2: Add a no-navigation assertion to the existing delete test**

In test 7 (`deletes a project after confirming the window.confirm dialog`), after the existing post-delete assertions (the `await expect(page.getByText('No breeding projects yet.')).toBeVisible();` block near line 363), append:

```ts
  // Delete acted in place — never navigated to a detail view.
  await expect(page).toHaveURL(/#\/projects$/);
```

- [ ] **Step 3: Build, then run both tests to verify they pass**

Run:
```bash
npm run build && npx playwright test e2e/projects.spec.ts -g "edit icon|deletes a project"
```
Expected: PASS for both. (They pass immediately because Task 1's `z-index: 2` on the icon group already keeps the icons above the overlay; these tests lock that behavior in as regression guards.)

- [ ] **Step 4: Commit**

```bash
git add e2e/projects.spec.ts
git commit -m "test: guard project card edit/delete icons against navigation"
```

---

### Task 3: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS (exit 0, no errors).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (no errors).

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: PASS (unchanged — no unit logic touched; this confirms no incidental breakage).

- [ ] **Step 4: Build + full e2e suite**

Run: `npm run build && npm run test:e2e`
Expected: PASS for the entire Playwright suite (all specs, not just projects).

- [ ] **Step 5: Confirm the working tree is clean and committed**

Run: `git status`
Expected: clean — all changes from Tasks 1–2 committed; nothing untracked except expected build artifacts.

---

## Self-Review

- **Spec coverage:**
  - "Click anywhere on the card navigates to detail" → Task 1 (impl + test). ✓
  - "Edit/delete icons do not navigate" → Task 1 impl (`z-index`) + Task 2 tests. ✓
  - "Title no longer styled as a separate link" → already plain text (`textDecoration: 'none'`, `color: 'inherit'`); no change needed — noted in Background. ✓
  - "Hover affordance" → `cursor: 'pointer'` on the card (Step 3a). ✓
  - Out-of-scope items (routes, edit modal, delete confirm, detail page, Owned list) → untouched. ✓
  - Testing = e2e (behavioral) → Tasks 1–2; verification gate → Task 3. ✓
- **Placeholder scan:** none — all steps contain concrete code and exact commands.
- **Type/selector consistency:** `data-testid="project-card"` is defined in Step 3a and used by `getByTestId('project-card')` in Task 1 Step 1. Edit aria-label `Edit ${project.name}` → test selector `Edit Edit No Nav`. URL regexes: list `/#\/projects$/`, detail `/#\/projects\/.+/`. Consistent throughout.
