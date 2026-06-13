import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SpeciesSelect } from './SpeciesSelect';

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('SpeciesSelect', () => {
  it('renders with the default "Species" label', () => {
    const onChange = vi.fn();
    renderWithMantine(<SpeciesSelect value={null} onChange={onChange} />);
    expect(screen.getByText('Species')).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    const onChange = vi.fn();
    renderWithMantine(<SpeciesSelect value={null} onChange={onChange} label="Choose a Pokémon" />);
    expect(screen.getByText('Choose a Pokémon')).toBeInTheDocument();
  });

  it('displays an error message when error prop is provided', () => {
    const onChange = vi.fn();
    renderWithMantine(
      <SpeciesSelect value={null} onChange={onChange} error="Species is required" />
    );
    expect(screen.getByText('Species is required')).toBeInTheDocument();
  });

  it('renders a searchable input with aria-haspopup="listbox"', () => {
    const onChange = vi.fn();
    renderWithMantine(<SpeciesSelect value={null} onChange={onChange} />);
    // Mantine Select renders a textbox input with aria-haspopup="listbox"
    const input = screen.getByRole('textbox', { name: 'Species' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('displays the selected species name when a value is provided', () => {
    const onChange = vi.fn();
    // Species id 1 = Bulbasaur
    renderWithMantine(<SpeciesSelect value={1} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Species' }) as HTMLInputElement;
    expect(input.value).toBe('Bulbasaur');
  });

  it('clears the displayed value when value is null', () => {
    const onChange = vi.fn();
    renderWithMantine(<SpeciesSelect value={null} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Species' }) as HTMLInputElement;
    expect(input.value).toBe('');
  });
});
