import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { OwnedPage } from './OwnedPage';
import { resetStore } from '../../store/index';

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('OwnedPage', () => {
  it('renders the "Owned Pokémon" title', () => {
    renderWithMantine(<OwnedPage />);
    expect(screen.getByRole('heading', { name: /owned pokémon/i })).toBeInTheDocument();
  });

  it('renders an Add Pokémon button', () => {
    renderWithMantine(<OwnedPage />);
    expect(screen.getByRole('button', { name: /add pokémon/i })).toBeInTheDocument();
  });

  it('clicking Add Pokémon opens the form modal with a Species field', async () => {
    renderWithMantine(<OwnedPage />);
    const addBtn = screen.getByRole('button', { name: /add pokémon/i });
    fireEvent.click(addBtn);
    await waitFor(() => {
      // Species select should appear in the modal
      expect(screen.getByText('Species')).toBeInTheDocument();
    });
  });

  it('shows the empty-state message initially with no pokemon', () => {
    renderWithMantine(<OwnedPage />);
    expect(screen.getByText('No Pokémon yet')).toBeInTheDocument();
  });
});
