import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { NotFound } from './NotFound';

function renderNotFound() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <NotFound />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('renders the "Page not found" heading', () => {
    renderNotFound();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders the descriptive text', () => {
    renderNotFound();
    expect(
      screen.getByText('The page you are looking for does not exist.'),
    ).toBeInTheDocument();
  });

  it('renders a link/button that goes to the /owned route', () => {
    renderNotFound();
    const link = screen.getByRole('link', { name: /go to owned/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/owned');
  });

  it('renders the "Go to Owned Pokémon" button text', () => {
    renderNotFound();
    expect(screen.getByText(/go to owned pokémon/i)).toBeInTheDocument();
  });
});
