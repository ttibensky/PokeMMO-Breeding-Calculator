import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { AppLayout } from './AppLayout';
import { theme } from '../theme';

function renderWithProviders() {
  return render(
    <MantineProvider theme={theme} forceColorScheme="light">
      <MemoryRouter initialEntries={['/owned']}>
        <AppLayout />
      </MemoryRouter>
    </MantineProvider>
  );
}

test('renders app title', () => {
  renderWithProviders();
  expect(screen.getByText('PokeMMO Breeding Calculator')).toBeInTheDocument();
});

test('renders navigation links', () => {
  renderWithProviders();
  expect(screen.getByText('Owned')).toBeInTheDocument();
  expect(screen.getByText('Projects')).toBeInTheDocument();
  expect(screen.getByText('Settings')).toBeInTheDocument();
});
