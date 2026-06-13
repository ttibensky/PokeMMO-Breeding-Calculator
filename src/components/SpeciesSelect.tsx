import { Select } from '@mantine/core';
import { allSpecies, getSpeciesById } from '../data/index';
import { PokemonAvatar } from './PokemonAvatar';

interface SpeciesSelectProps {
  value: number | null;
  onChange: (id: number) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

const SPECIES_DATA = allSpecies.map((s) => ({
  value: String(s.id),
  label: s.name,
}));

export function SpeciesSelect({ value, onChange, label = 'Species', required = false, error }: SpeciesSelectProps) {
  return (
    <Select
      label={label}
      required={required}
      error={error}
      data={SPECIES_DATA}
      value={value !== null ? String(value) : null}
      onChange={(val) => {
        if (val !== null) {
          onChange(parseInt(val, 10));
        }
      }}
      searchable
      limit={50}
      renderOption={({ option }) => {
        const id = parseInt(option.value, 10);
        const species = getSpeciesById(id);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {species && <PokemonAvatar speciesId={id} size="sm" />}
            <span>{option.label}</span>
          </div>
        );
      }}
      aria-label={label}
    />
  );
}
