import type { StateCreator } from 'zustand';
import type { OwnedPokemon } from './types';

export interface OwnedSlice {
  ownedPokemon: OwnedPokemon[];
  addOwnedPokemon: (input: Omit<OwnedPokemon, 'id' | 'createdAt'>) => string;
  updateOwnedPokemon: (id: string, patch: Partial<OwnedPokemon>) => void;
  removeOwnedPokemon: (id: string) => void;
  getOwnedById: (id: string) => OwnedPokemon | undefined;
}

export const createOwnedSlice: StateCreator<OwnedSlice> = (set, get) => ({
  ownedPokemon: [],

  addOwnedPokemon: (input) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const pokemon: OwnedPokemon = { ...input, id, createdAt };
    set((state) => ({ ownedPokemon: [...state.ownedPokemon, pokemon] }));
    return id;
  },

  updateOwnedPokemon: (id, patch) => {
    set((state) => ({
      ownedPokemon: state.ownedPokemon.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    }));
  },

  removeOwnedPokemon: (id) => {
    set((state) => ({
      ownedPokemon: state.ownedPokemon.filter((p) => p.id !== id),
    }));
  },

  getOwnedById: (id) => {
    return get().ownedPokemon.find((p) => p.id === id);
  },
});
