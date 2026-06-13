# Edit Project Button on Project Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Edit" button to the project detail page that opens the existing `GoalForm` in edit mode, prefilled with the current project.

**Architecture:** Pure wiring task. `GoalForm` already supports edit mode via `editingId` and already calls `updateProject` on submit. `ProjectsPage` already drives this from its list. We replicate that wiring inside `ProjectDetailPage`: add `useState` for the modal, an "Edit" button in the existing action row, and a `<GoalForm>` render. No store, form, or list changes.

**Tech Stack:** React + TypeScript, Mantine UI (`@mantine/core`, `@mantine/form`), Zustand store, Playwright e2e.

---

## File Structure

- **Modify:** `src/features/projects/ProjectDetailPage.tsx` — add modal state, an "Edit" button in the action row, and render `GoalForm`.
- **Modify (test):** `e2e/projects.spec.ts` — add an e2e test that edits a project's name from the detail page.

No new files. `GoalForm` is already a named export (`export function GoalForm(...)`), so no export change is needed.

---

## Task 1: Wire the Edit button into the project detail page

**Files:**
- Modify: `src/features/projects/ProjectDetailPage.tsx`

Reference facts (verbatim from the codebase):

- `GoalForm` props (`src/features/projects/GoalForm.tsx:48-52`):
  ```typescript
  interface GoalFormProps {
    opened: boolean;
    onClose: () => void;
    editingId?: string;
  }
  ```
  Named export: `export function GoalForm({ opened, onClose, editingId }: GoalFormProps)`.

- `ProjectDetailPage.tsx` already imports `useState` (line 1: `import { useMemo, useState, useEffect } from 'react';`) and `Button`, `Group` from `@mantine/core` (lines 4-23).

- `project` is obtained at `ProjectDetailPage.tsx:472-476` as `BreedingProject | undefined`. By the action row it is already narrowed to defined (the row uses `project.status` / `project.id` directly).

- The action row to extend is at `ProjectDetailPage.tsx:553-571`:
  ```tsx
  <Group gap="xs" mb="md">
    {project.status !== 'done' && (
      <Button size="xs" color="green" variant="light" onClick={() => setProjectStatus(project.id, 'done')}>
        Mark Done
      </Button>
    )}
    {project.status !== 'abandoned' && (
      <Button size="xs" color="red" variant="light" onClick={() => setProjectStatus(project.id, 'abandoned')}>
        Abandon
      </Button>
    )}
    <Button
      size="xs"
      onClick={() => openReportModal(false)}
      variant="default"
    >
      Report Breed Result
    </Button>
  </Group>
  ```

- [ ] **Step 1: Add the import for `GoalForm`**

At the top of `ProjectDetailPage.tsx`, with the other local-feature imports, add:

```tsx
import { GoalForm } from './GoalForm';
```

- [ ] **Step 2: Add modal open/close state**

Inside the `ProjectDetailPage` component body, near the other `useState` declarations, add:

```tsx
const [editOpened, setEditOpened] = useState(false);
```

- [ ] **Step 3: Add the Edit button to the action row**

Modify the action `Group` at lines 553-571 to add an "Edit" button. The resulting `Group` should be:

```tsx
<Group gap="xs" mb="md">
  <Button size="xs" variant="light" onClick={() => setEditOpened(true)}>
    Edit
  </Button>
  {project.status !== 'done' && (
    <Button size="xs" color="green" variant="light" onClick={() => setProjectStatus(project.id, 'done')}>
      Mark Done
    </Button>
  )}
  {project.status !== 'abandoned' && (
    <Button size="xs" color="red" variant="light" onClick={() => setProjectStatus(project.id, 'abandoned')}>
      Abandon
    </Button>
  )}
  <Button
    size="xs"
    onClick={() => openReportModal(false)}
    variant="default"
  >
    Report Breed Result
  </Button>
</Group>
```

- [ ] **Step 4: Render `GoalForm` in edit mode**

Add the `GoalForm` near the end of the component's returned JSX, alongside the other modals (e.g. just before the closing wrapper, next to the report modal). `project` is defined at this point:

```tsx
<GoalForm
  opened={editOpened}
  onClose={() => setEditOpened(false)}
  editingId={project.id}
/>
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc -b && npx eslint .`
Expected: no errors. (If `useState` was somehow unused before — it is already imported and used — no import change needed.)

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/ProjectDetailPage.tsx
git commit -m "feat: add edit button to project detail page"
```

---

## Task 2: e2e test — edit a project's name from the detail page

**Files:**
- Modify: `e2e/projects.spec.ts`

Reference facts (verbatim from the codebase):

- Helpers already in the file (`e2e/projects.spec.ts:5-109`): `freshStart(page, hash?)`, `selectOption(page, inputName, optionText)`, and:
  ```typescript
  async function openGoalFormAndFill(
    page: Page,
    opts: {
      trigger: 'newProject' | 'emptyState';
      name: string;
      species: string;
      stats: string[]; // aria-labels of checkboxes
    },
  ) { /* opens form, fills name, picks species, checks stats */ }
  ```
- Create-mode submit button label is `Create Project`; edit-mode submit button label is `Save Changes` (`GoalForm.tsx:355-357`).
- Project name field label is `Project name` (`GoalForm.tsx:237`).
- Detail navigation pattern (`projects.spec.ts:246-248`): click the project name text, then assert the heading.
- Tests reach the app via `playwright.config.ts` `webServer` running `npm run preview`; `test:e2e` = `playwright test`.

- [ ] **Step 1: Add the failing test**

Append this test inside the existing top-level `test.describe`/file (after an existing test, at the same nesting level as the create test at line 115):

```typescript
test('edits a project name from the detail page', async ({ page }) => {
  await freshStart(page);

  // Create a project to edit
  await openGoalFormAndFill(page, {
    trigger: 'emptyState',
    name: 'Edit Me',
    species: 'Bulbasaur',
    stats: ['Target HP', 'Target Atk'],
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Create Project' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Open the project detail
  await page.getByText('Edit Me').click();
  await expect(page.getByRole('heading', { name: 'Edit Me' })).toBeVisible();

  // Open the edit form from the detail page
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edit Project' })).toBeVisible();

  // Change the name and save
  await page.getByLabel('Project name').fill('Edited Name');
  await page.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Detail page reflects the new name
  await expect(page.getByRole('heading', { name: 'Edited Name' })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx playwright test e2e/projects.spec.ts -g "edits a project name from the detail page"`
Expected: PASS. (Task 1 already implemented the button, so this should be green. If it fails, fix Task 1 wiring before proceeding.)

- [ ] **Step 3: Run the full projects e2e spec**

Run: `npx playwright test e2e/projects.spec.ts`
Expected: all tests PASS, including the new one.

- [ ] **Step 4: Commit**

```bash
git add e2e/projects.spec.ts
git commit -m "test: e2e for editing a project from the detail page"
```

---

## Task 3: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: PASS (no unit-level changes, should remain green).

- [ ] **Step 2: Run e2e tests**

Run: `npm run test:e2e`
Expected: PASS, including `edits a project name from the detail page`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint .`
Expected: no errors.

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-13-edit-project-detail-design.md`):
- "Add modal state" → Task 1 Step 2. ✓
- "Add Edit button in action row" → Task 1 Step 3. ✓
- "Render GoalForm in edit mode" → Task 1 Step 4. ✓
- "Add named export if missing" → not needed; `GoalForm` is already a named export (noted in File Structure). ✓
- "Store updates reactively, no nav/toast" → relies on existing `GoalForm`/Zustand behavior; asserted by Task 2's final heading check. ✓
- "Existing validation unchanged" → no form changes; nothing to do. ✓
- "e2e test: open detail, Edit, change name, save, assert" → Task 2. ✓
- "Scope guard: no store/form/list changes" → only `ProjectDetailPage.tsx` + `projects.spec.ts` modified. ✓

**Placeholder scan:** No TBD/TODO; all code blocks are concrete; all labels/selectors are verbatim from source.

**Type consistency:** `editOpened`/`setEditOpened` used consistently. `GoalForm` props (`opened`, `onClose`, `editingId`) match its interface. Submit labels (`Create Project`, `Save Changes`) and field label (`Project name`) match `GoalForm.tsx`.
