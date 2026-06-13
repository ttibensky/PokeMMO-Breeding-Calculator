import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';
import { useBreedingStore, resetStore } from '../../store/index';
import { goalSummary } from './projectHelpers';
import type { BreedingGoal } from '../../store/types';

function renderPage() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <ProjectsPage />
      </MantineProvider>
    </MemoryRouter>,
  );
}

function seedProject(name: string, goal?: Partial<BreedingGoal>) {
  return useBreedingStore.getState().addProject({
    name,
    goal: {
      speciesId: 1, // Bulbasaur
      targetIVs: { hp: 31, atk: 31 },
      ...goal,
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('ProjectsPage', () => {
  describe('empty state', () => {
    it('renders the "Projects" heading', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument();
    });

    it('shows empty state message when no projects exist', () => {
      renderPage();
      expect(screen.getByText(/no breeding projects yet/i)).toBeInTheDocument();
    });

    it('shows a CTA button in the empty state', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument();
    });

    it('shows a "New Project" button in the header', () => {
      renderPage();
      expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
    });
  });

  describe('with seeded projects', () => {
    it('renders a card for each seeded project', () => {
      seedProject('HP-Atk Bulbasaur');
      seedProject('Spe Charmander');
      renderPage();

      expect(screen.getByText('HP-Atk Bulbasaur')).toBeInTheDocument();
      expect(screen.getByText('Spe Charmander')).toBeInTheDocument();
    });

    it('shows the goalSummary in the card', () => {
      seedProject('Bulba Project', { targetIVs: { hp: 31, atk: 31 } });
      renderPage();

      const goal: BreedingGoal = { speciesId: 1, targetIVs: { hp: 31, atk: 31 } };
      const summary = goalSummary(goal);
      expect(screen.getByText(summary)).toBeInTheDocument();
    });

    it('shows a status badge on the card', () => {
      seedProject('My Project');
      renderPage();

      // Default status is 'planning'
      expect(screen.getByText('planning')).toBeInTheDocument();
    });

    it('renders a progress indicator (Progress component) for each project', () => {
      seedProject('Progress Test');
      renderPage();

      // Progress component has aria-label "Progress: X%"
      const progressEl = screen.getByRole('progressbar');
      expect(progressEl).toBeInTheDocument();
    });

    it('does NOT show the empty-state message when projects exist', () => {
      seedProject('Some Project');
      renderPage();

      expect(screen.queryByText(/no breeding projects yet/i)).not.toBeInTheDocument();
    });
  });

  describe('clicking "New Project"', () => {
    it('opens the GoalForm modal (name input becomes visible)', async () => {
      renderPage();

      const newProjectBtn = screen.getByRole('button', { name: /new project/i });
      fireEvent.click(newProjectBtn);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i),
        ).toBeInTheDocument();
      });
    });

    it('clicking the empty-state CTA also opens the form', async () => {
      renderPage();

      const ctaBtn = screen.getByRole('button', { name: /create your first project/i });
      fireEvent.click(ctaBtn);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/e\.g\. Garchomp attacker/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('delete', () => {
    it('removes a project from the store when the delete button is clicked and confirmed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      seedProject('Delete Me');
      renderPage();

      expect(useBreedingStore.getState().projects).toHaveLength(1);

      const deleteBtn = screen.getByRole('button', { name: /delete delete me/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(useBreedingStore.getState().projects).toHaveLength(0);
      });

      confirmSpy.mockRestore();
    });

    it('does NOT remove a project when confirm returns false', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      seedProject('Keep Me');
      renderPage();

      const deleteBtn = screen.getByRole('button', { name: /delete keep me/i });
      fireEvent.click(deleteBtn);

      // Store should still have the project
      expect(useBreedingStore.getState().projects).toHaveLength(1);

      confirmSpy.mockRestore();
    });

    it('passes the project name to the confirm dialog', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      seedProject('Named Project');
      renderPage();

      const deleteBtn = screen.getByRole('button', { name: /delete named project/i });
      fireEvent.click(deleteBtn);

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Named Project'));

      confirmSpy.mockRestore();
    });
  });

  describe('edit', () => {
    it('renders an edit button for each project', () => {
      seedProject('Editable Project');
      renderPage();

      expect(
        screen.getByRole('button', { name: /edit editable project/i }),
      ).toBeInTheDocument();
    });

    it('clicking edit opens the form with "Edit Project" title', async () => {
      seedProject('Edit Test');
      renderPage();

      const editBtn = screen.getByRole('button', { name: /edit edit test/i });
      fireEvent.click(editBtn);

      await waitFor(() => {
        expect(screen.getByText('Edit Project')).toBeInTheDocument();
      });
    });
  });
});
