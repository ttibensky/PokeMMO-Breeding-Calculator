# Eliminate `act(...)` Warnings in Unit Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all React `act(...)` warnings from `npm run test:unit` output without losing the warning's diagnostic value, while keeping all 547 tests green.

**Architecture:** The warnings come solely from `src/features/settings/SettingsPage.test.tsx`, where Mantine's `useMantineColorScheme()` hook and the `SegmentedControl` measurement effect perform async `setState` after `render()`'s `act` scope closes. Fix: make the `renderPage` helper async and flush pending effects with `await act(async () => {})` inside an `act` scope before tests query; update the 41 call sites to `await renderPage()`. No production code changes, no `console.error` suppression — the warning stays active everywhere else.

**Tech Stack:** Vitest 3, @testing-library/react 16, @mantine/core 7.17, React 18, TypeScript.

---

### Task 1: Capture the baseline (confirm the warning exists and tests pass)

**Files:**
- None modified — this is a measurement step.

- [ ] **Step 1: Run the target test file and capture warning + pass state**

Run:
```bash
npm run test:unit -- src/features/settings/SettingsPage.test.tsx 2>&1 | tee /tmp/act-baseline.txt
```
Expected: output contains multiple lines `Warning: An update to @mantine/core/SegmentedControl inside a test was not wrapped in act(...)`, AND the file passes (`41 passed`).

- [ ] **Step 2: Count the baseline warnings**

Run:
```bash
grep -c "was not wrapped in act" /tmp/act-baseline.txt
```
Expected: a number ≥ 1 (the warnings we will eliminate). Record it.

---

### Task 2: Make `renderPage` async and flush post-mount effects

**Files:**
- Modify: `src/features/settings/SettingsPage.test.tsx` (import line ~2; `renderPage` helper lines ~9-14; 41 `renderPage()` call sites)

- [ ] **Step 1: Add `act` to the Testing Library import**

The file currently imports from `@testing-library/react` without `act` (the import includes `fireEvent`, `render`, `screen`). Add `act` to that named import. After the edit the import reads:

```ts
import { act, fireEvent, render, screen } from '@testing-library/react';
```

(Preserve any other names already in that import — only add `act`, keep alphabetical/existing order as the file uses it. If `waitFor` or others are present, keep them.)

- [ ] **Step 2: Make `renderPage` async and flush effects**

Replace the existing helper:

```ts
function renderPage() {
  return render(
    <MantineProvider>
      <SettingsPage />
    </MantineProvider>,
  );
}
```

with:

```ts
async function renderPage() {
  const result = render(
    <MantineProvider>
      <SettingsPage />
    </MantineProvider>,
  );
  // Flush Mantine's post-mount colorScheme/SegmentedControl state updates
  // inside act so React doesn't warn about updates outside act().
  await act(async () => {});
  return result;
}
```

- [ ] **Step 3: Await every `renderPage()` call site**

Every `it(...)` block calls `renderPage()` synchronously. Change each occurrence to `await renderPage()`. There are 41 call sites.

- If a call site destructures the return value, keep the destructuring:
  `const { container } = renderPage();` → `const { container } = await renderPage();`
- If it is a bare statement, `renderPage();` → `await renderPage();`
- Ensure each enclosing `it(...)` / `test(...)` callback is `async`. Most may already be; for any that are not, change `it('...', () => {` to `it('...', async () => {`.

Apply with a careful find-and-replace of `renderPage()` → `await renderPage()` across the file, then verify no double-`await` (`await await`) was introduced and that no occurrence inside a non-callback context was wrongly touched.

- [ ] **Step 4: Typecheck the file compiles**

Run:
```bash
npx tsc -b
```
Expected: exits 0, no errors. (Catches any `await` used in a non-async function — fix by making that callback `async`.)

- [ ] **Step 5: Run the target test file — warnings gone, tests pass**

Run:
```bash
npm run test:unit -- src/features/settings/SettingsPage.test.tsx 2>&1 | tee /tmp/act-after.txt
grep -c "was not wrapped in act" /tmp/act-after.txt || echo "0 warnings"
```
Expected: the grep prints `0` (or "0 warnings"), AND the file reports `41 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.test.tsx
git commit -m "test: flush Mantine post-mount effects to remove act() warnings"
```

---

### Task 3: Full-suite verification gate

**Files:**
- None modified — verification only.

- [ ] **Step 1: Run the full unit suite, assert zero act warnings**

Run:
```bash
npm run test:unit 2>&1 | tee /tmp/act-full.txt
grep -c "was not wrapped in act" /tmp/act-full.txt || echo "0 warnings"
```
Expected: grep prints `0`, AND summary shows `Test Files 27 passed (27)` and `Tests 547 passed (547)`.

- [ ] **Step 2: Typecheck and lint**

Run:
```bash
npx tsc -b && npx eslint .
```
Expected: both exit 0 with no errors.

- [ ] **Step 3: Confirm no production or unrelated test files changed**

Run:
```bash
git diff --name-only HEAD~1
```
Expected: only `src/features/settings/SettingsPage.test.tsx` (the spec/plan docs were committed earlier). If anything else appears, investigate before proceeding.
