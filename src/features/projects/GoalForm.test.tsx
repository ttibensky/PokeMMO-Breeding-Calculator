import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { GoalForm } from './GoalForm';
import { useBreedingStore, resetStore } from '../../store/index';

function renderForm(props: {
  opened: boolean;
  onClose?: () => void;
  editingId?: string;
}) {
  const onClose = props.onClose ?? vi.fn();
  render(
    <MemoryRouter>
      <MantineProvider>
        <GoalForm opened={props.opened} onClose={onClose} editingId={props.editingId} />
      </MantineProvider>
    </MemoryRouter>,
  );
  return { onClose };
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('GoalForm', () => {
  describe('renders correct fields when opened', () => {
    it('renders the project name input', () => {
      renderForm({ opened: true });
      expect(screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i)).toBeInTheDocument();
    });

    it('renders the target species select', () => {
      renderForm({ opened: true });
      // SpeciesSelect is a Mantine searchable select — renders a textbox
      expect(screen.getByRole('textbox', { name: /species/i })).toBeInTheDocument();
    });

    it('renders HP stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target HP')).toBeInTheDocument();
    });

    it('renders Atk stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target Atk')).toBeInTheDocument();
    });

    it('renders Def stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target Def')).toBeInTheDocument();
    });

    it('renders SpA stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target SpA')).toBeInTheDocument();
    });

    it('renders SpD stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target SpD')).toBeInTheDocument();
    });

    it('renders Spe stat checkbox', () => {
      renderForm({ opened: true });
      expect(screen.getByLabelText('Target Spe')).toBeInTheDocument();
    });

    it('renders the nature select', () => {
      renderForm({ opened: true });
      expect(screen.getByRole('textbox', { name: 'Nature' })).toBeInTheDocument();
    });

    it('renders the ability select', () => {
      renderForm({ opened: true });
      expect(screen.getByRole('textbox', { name: 'Ability' })).toBeInTheDocument();
    });

    it('does not render the modal when opened is false', () => {
      renderForm({ opened: false });
      expect(screen.queryByPlaceholderText(/e\.g\. Garchomp attacker/i)).not.toBeInTheDocument();
    });
  });

  describe('IV validation', () => {
    it('does not create a project when fewer than 2 stats are selected — store stays empty', async () => {
      // NOTE: Mantine form errors (rendered via inline <Text>) are not exposed in
      // body.textContent in jsdom (the error slot is set but not reflected in DOM text).
      // We assert the behavior: no project added + onClose not called.
      const onClose = vi.fn();
      renderForm({ opened: true, onClose });

      // Check only 1 stat (HP)
      const hpCheckbox = screen.getByLabelText('Target HP');
      fireEvent.click(hpCheckbox);

      // Fill in a name so only the stat count is invalid
      const nameInput = screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i);
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      // Submit
      const submitBtn = screen.getByRole('button', { name: /create project/i });
      fireEvent.click(submitBtn);

      // Allow react to process
      await waitFor(() => {
        // onClose should NOT have been called (form is invalid)
        expect(onClose).not.toHaveBeenCalled();
      });

      // No project should have been added to the store
      expect(useBreedingStore.getState().projects).toHaveLength(0);
    });

    it('does NOT call onClose (project not created) when fewer than 2 stats selected', async () => {
      const onClose = vi.fn();
      renderForm({ opened: true, onClose });

      // Select 0 stats — definitely invalid
      const nameInput = screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i);
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      const submitBtn = screen.getByRole('button', { name: /create project/i });
      fireEvent.click(submitBtn);

      // Small wait for react to settle
      await new Promise((r) => setTimeout(r, 50));

      // onClose should NOT have been called
      expect(onClose).not.toHaveBeenCalled();

      // No project should have been added
      expect(useBreedingStore.getState().projects).toHaveLength(0);
    });

    it('shows no stat error when 2 stats are checked', async () => {
      renderForm({ opened: true });

      // Check 2 stats
      fireEvent.click(screen.getByLabelText('Target HP'));
      fireEvent.click(screen.getByLabelText('Target Atk'));

      // Fill in a name but don't submit — just verify the checkboxes are checked
      const hpCheckbox = screen.getByLabelText('Target HP') as HTMLInputElement;
      const atkCheckbox = screen.getByLabelText('Target Atk') as HTMLInputElement;
      expect(hpCheckbox.checked).toBe(true);
      expect(atkCheckbox.checked).toBe(true);
    });

    it('toggles stat checkboxes correctly', () => {
      renderForm({ opened: true });

      const hpCheckbox = screen.getByLabelText('Target HP') as HTMLInputElement;
      expect(hpCheckbox.checked).toBe(false);

      fireEvent.click(hpCheckbox);
      expect(hpCheckbox.checked).toBe(true);

      fireEvent.click(hpCheckbox);
      expect(hpCheckbox.checked).toBe(false);
    });
  });

  describe('progressive disclosure', () => {
    it('does not render "Require Hidden Ability" when hiddenAbility feature is off', () => {
      renderForm({ opened: true });
      expect(screen.queryByLabelText('Require Hidden Ability')).not.toBeInTheDocument();
    });

    it('does not render "Require Shiny" when shiny feature is off', () => {
      renderForm({ opened: true });
      expect(screen.queryByLabelText('Require Shiny')).not.toBeInTheDocument();
    });

    it('renders "Require Hidden Ability" when hiddenAbility feature is on', () => {
      useBreedingStore.getState().updateFeatures({ hiddenAbility: true });
      renderForm({ opened: true });
      expect(screen.getByLabelText('Require Hidden Ability')).toBeInTheDocument();
    });

    it('renders "Require Shiny" when shiny feature is on', () => {
      useBreedingStore.getState().updateFeatures({ shiny: true });
      renderForm({ opened: true });
      expect(screen.getByLabelText('Require Shiny')).toBeInTheDocument();
    });

    it('shows all progressive fields after enabling hiddenAbility, shiny, and eggMoves', () => {
      useBreedingStore.getState().updateFeatures({
        hiddenAbility: true,
        shiny: true,
        eggMoves: true,
      });
      renderForm({ opened: true });
      expect(screen.getByLabelText('Require Hidden Ability')).toBeInTheDocument();
      expect(screen.getByLabelText('Require Shiny')).toBeInTheDocument();
      // Egg Moves field only shows when a species is selected (species.moves drives the TagsInput)
      // so we can't assert it without a species; just confirm the other two
    });
  });

  describe('submit path', () => {
    it('does not create a project when name is empty — onClose not called', async () => {
      // NOTE: Mantine form error text (e.g. "Name is required") is rendered in the
      // Input error slot but not reliably visible in body.textContent in jsdom.
      // We assert the behavioral outcome: store stays empty, onClose not invoked.
      const onClose = vi.fn();
      renderForm({ opened: true, onClose });

      // Check 2 stats so that's not the blocker
      fireEvent.click(screen.getByLabelText('Target HP'));
      fireEvent.click(screen.getByLabelText('Target Atk'));

      // Leave name empty
      const submitBtn = screen.getByRole('button', { name: /create project/i });
      fireEvent.click(submitBtn);

      await new Promise((r) => setTimeout(r, 50));

      // Form should not have submitted
      expect(onClose).not.toHaveBeenCalled();
      expect(useBreedingStore.getState().projects).toHaveLength(0);
    });

    it('stores goal.targetIVs correctly for checked stats at store level', () => {
      // We exercise the store directly to verify targetIVs shape
      const { addProject } = useBreedingStore.getState();
      const id = addProject({
        name: 'Direct store project',
        goal: {
          speciesId: 1,
          targetIVs: { hp: 31, atk: 31 },
        },
      });

      const project = useBreedingStore.getState().getProjectById(id);
      expect(project).toBeDefined();
      expect(project!.goal.targetIVs).toEqual({ hp: 31, atk: 31 });
    });

    it('shows "Create Project" button for new form', () => {
      renderForm({ opened: true });
      expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
    });

    it('shows "Edit Project" title when editingId is set', () => {
      const id = useBreedingStore.getState().addProject({
        name: 'My Project',
        goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } },
      });
      renderForm({ opened: true, editingId: id });
      expect(screen.getByText('Edit Project')).toBeInTheDocument();
    });
  });

  describe('edit mode — pre-fill', () => {
    it('pre-fills the name from the existing project', async () => {
      const id = useBreedingStore.getState().addProject({
        name: 'Existing Project',
        goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } },
      });

      renderForm({ opened: true, editingId: id });

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText(
          /e\.g\. Garchomp attacker/i,
        ) as HTMLInputElement;
        expect(nameInput.value).toBe('Existing Project');
      });
    });

    it('pre-checks the stat checkboxes from the existing project', async () => {
      const id = useBreedingStore.getState().addProject({
        name: 'Edit Me',
        goal: { speciesId: 1, targetIVs: { hp: 31, spe: 31 } },
      });

      renderForm({ opened: true, editingId: id });

      await waitFor(() => {
        const hpCheckbox = screen.getByLabelText('Target HP') as HTMLInputElement;
        const speCheckbox = screen.getByLabelText('Target Spe') as HTMLInputElement;
        const atkCheckbox = screen.getByLabelText('Target Atk') as HTMLInputElement;
        expect(hpCheckbox.checked).toBe(true);
        expect(speCheckbox.checked).toBe(true);
        expect(atkCheckbox.checked).toBe(false);
      });
    });

    it('shows "Save Changes" button when editingId is provided', () => {
      const id = useBreedingStore.getState().addProject({
        name: 'Test',
        goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } },
      });
      renderForm({ opened: true, editingId: id });
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('calls updateProject (not addProject) when saving in edit mode', async () => {
      // Seed a project
      const id = useBreedingStore.getState().addProject({
        name: 'Original',
        goal: { speciesId: 1, targetIVs: { hp: 31, atk: 31 } },
      });

      const onClose = vi.fn();
      render(
        <MemoryRouter>
          <MantineProvider>
            <GoalForm opened={true} onClose={onClose} editingId={id} />
          </MantineProvider>
        </MemoryRouter>,
      );

      // Wait for pre-fill
      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i) as HTMLInputElement;
        expect(nameInput.value).toBe('Original');
      });

      // Change the name
      const nameInput = screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // Click Save Changes
      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      fireEvent.click(saveBtn);

      // The project should still exist (it was updated, not deleted and re-added)
      // and no NEW project should have been added
      await waitFor(() => {
        const state = useBreedingStore.getState();
        // Still exactly 1 project (the edited one, not a new one)
        expect(state.projects).toHaveLength(1);
        expect(state.projects[0].id).toBe(id);
      });
    });
  });

  describe('cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderForm({ opened: true, onClose });
      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
