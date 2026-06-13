import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PokemonAvatar } from './PokemonAvatar';

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('PokemonAvatar', () => {
  it('renders an img with alt equal to species name for a known id', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} />);
    const img = screen.getByAltText('Bulbasaur');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });

  it('renders an img for another known species (Charmander id=4)', () => {
    renderWithMantine(<PokemonAvatar speciesId={4} />);
    expect(screen.getByAltText('Charmander')).toBeInTheDocument();
  });

  it('does not show species name text when showName is false (default)', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} />);
    // The name text element should not be present since showName defaults to false
    expect(screen.queryByText('Bulbasaur')).not.toBeInTheDocument();
  });

  it('shows species name text when showName is true', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} showName />);
    expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
  });

  it('renders a fallback box with aria-label "Unknown Pokémon" for an unknown speciesId', () => {
    renderWithMantine(<PokemonAvatar speciesId={99999} />);
    // No img, but a fallback box
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Unknown Pokémon')).toBeInTheDocument();
  });

  it('after img onError falls back to a box with the species name as aria-label', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} />);
    const img = screen.getByAltText('Bulbasaur');
    // Simulate image load error
    fireEvent.error(img);
    // After error the img is replaced by a fallback box with the species name
    expect(screen.queryByAltText('Bulbasaur')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bulbasaur')).toBeInTheDocument();
  });

  it('applies the given size to img dimensions', () => {
    renderWithMantine(<PokemonAvatar speciesId={1} size={64} />);
    const img = screen.getByAltText('Bulbasaur') as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('64');
    expect(img.getAttribute('height')).toBe('64');
  });
});
