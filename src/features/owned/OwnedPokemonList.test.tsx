import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { OwnedPokemonList } from './OwnedPokemonList';
import { useBreedingStore, resetStore } from '../../store/index';

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function makeOwnedInput(overrides = {}) {
  return {
    speciesId: 1, // Bulbasaur
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    nature: 'Adamant',
    ability: 'Overgrow',
    isHiddenAbility: false,
    gender: 'male' as const,
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

describe('OwnedPokemonList', () => {
  describe('empty state', () => {
    it('shows the empty-state message when no pokemon are owned', () => {
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      expect(screen.getByText('No Pokémon yet')).toBeInTheDocument();
    });

    it('shows an Add button in the empty state that calls onAdd', () => {
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      const btn = screen.getByRole('button', { name: /add your first pokémon/i });
      fireEvent.click(btn);
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('with seeded pokemon', () => {
    it('renders a card for each owned pokemon with species name', () => {
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 })); // Bulbasaur
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 4 })); // Charmander
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
      expect(screen.getByText('Charmander')).toBeInTheDocument();
    });

    it('search field filters by species name', async () => {
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 })); // Bulbasaur
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 4 })); // Charmander
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);

      const searchInput = screen.getByRole('textbox', { name: /search pokémon/i });
      fireEvent.change(searchInput, { target: { value: 'Bulba' } });

      await waitFor(() => {
        expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
        expect(screen.queryByText('Charmander')).not.toBeInTheDocument();
      });
    });

    it('shows no-match message when search yields no results', async () => {
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);

      const searchInput = screen.getByRole('textbox', { name: /search pokémon/i });
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });

      await waitFor(() => {
        expect(screen.getByText(/no pokémon match your filters/i)).toBeInTheDocument();
      });
    });

    it('Edit action calls onEdit with the correct id', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);

      const editBtn = screen.getByRole('button', { name: /edit bulbasaur/i });
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledWith(id);
    });

    it('Duplicate action calls onDuplicate with the correct id', () => {
      const id = useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);

      const duplicateBtn = screen.getByRole('button', { name: /duplicate bulbasaur/i });
      fireEvent.click(duplicateBtn);
      expect(onDuplicate).toHaveBeenCalledWith(id);
    });

    it('Delete action opens confirm dialog and removes mon on confirm', async () => {
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ speciesId: 1 }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);

      const deleteBtn = screen.getByRole('button', { name: /delete bulbasaur/i });
      fireEvent.click(deleteBtn);

      // Confirm dialog should be visible
      await waitFor(() => {
        expect(screen.getByText(/remove pokémon/i, { selector: '[class*="modalTitle"], h2, [id*="modal-title"], *' })).toBeInTheDocument();
      });

      // Click the confirm remove button
      const confirmBtn = screen.getByRole('button', { name: /^remove$/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(useBreedingStore.getState().ownedPokemon).toHaveLength(0);
      });
    });

    it('Shiny badge is shown for shiny mon when shiny feature is enabled', () => {
      useBreedingStore.getState().updateFeatures({ shiny: true });
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ isShiny: true }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      expect(screen.getByText('Shiny')).toBeInTheDocument();
    });

    it('Shiny badge is NOT shown for non-shiny mon', () => {
      useBreedingStore.getState().updateFeatures({ shiny: true });
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ isShiny: false }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      expect(screen.queryByText('Shiny')).not.toBeInTheDocument();
    });

    it('Shiny badge is NOT shown when shiny feature is disabled, even if mon.isShiny is true', () => {
      // Feature is off by default
      useBreedingStore.getState().addOwnedPokemon(makeOwnedInput({ isShiny: true }));
      const onAdd = vi.fn();
      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      renderWithMantine(<OwnedPokemonList onAdd={onAdd} onEdit={onEdit} onDuplicate={onDuplicate} />);
      expect(screen.queryByText('Shiny')).not.toBeInTheDocument();
    });
  });
});
