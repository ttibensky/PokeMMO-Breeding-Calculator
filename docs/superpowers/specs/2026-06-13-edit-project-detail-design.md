# Edit Project button on project detail

**Date:** 2026-06-13

## Goal

Let users edit a project's name and breeding goal directly from the project
detail page, reusing the existing edit flow rather than building a new one.

## Background

The edit infrastructure already exists:

- `GoalForm` (`src/features/projects/GoalForm.tsx`) supports an edit mode via an
  `editingId` prop. In edit mode it prefills every field from the existing
  project and calls `store.updateProject(id, { name, goal })` on submit.
- The project list view (`src/features/projects/ProjectsPage.tsx` →
  `ProjectCard`) already drives this exact flow from a pencil `ActionIcon`.

The detail page (`src/features/projects/ProjectDetailPage.tsx`) has no way to
trigger an edit. This change wires the existing flow into the detail page.

## Changes

All changes are in `ProjectDetailPage.tsx`, except possibly a named export on
`GoalForm`.

1. Add local state to control the modal, e.g. `const [editing, setEditing] =
   useState(false)`.
2. Add an **"Edit"** `Button` to the existing action button row, alongside
   "Mark Done", "Abandon", and "Report Breed Result". Style to match that row
   (`size="xs"`, `variant="light"`, neutral color). Clicking it opens the modal.
3. Render `GoalForm` in edit mode for the current project, matching how
   `ProjectsPage` mounts it:
   `<GoalForm editingId={project.id} opened={editing} onClose={() => setEditing(false)} />`
   (Use whatever prop names `GoalForm` actually exposes for open/close.)
4. If `GoalForm` is not currently exported for reuse, add a named export. No
   logic change to the form.

## Data flow

Edit button → opens `GoalForm` in edit mode (prefilled from `project`) → user
edits and saves → `GoalForm` calls `updateProject` → Zustand store updates →
detail page re-renders reactively with the new values → modal closes.

No navigation and no toast on save, matching the existing list-view behavior.

## Error handling

No new error handling. `GoalForm`'s existing validation applies unchanged:

- `name` required (not empty)
- `speciesId` required (not null)
- `targetStats` between 2 and 6 selected

## Testing

This is a user-facing behavioral change → end-to-end test with Playwright.
Extend the most relevant existing projects spec rather than adding a new file.

Scenario: open a project's detail page, click **Edit**, change the project
name, save, and assert the detail page reflects the new name.

## Scope guard

- No changes to the Zustand store (`updateProject` already exists and is used).
- No changes to `GoalForm`'s fields, validation, or submit logic (beyond
  possibly adding an export).
- No changes to the list view.
- No new fields and no new validation.
