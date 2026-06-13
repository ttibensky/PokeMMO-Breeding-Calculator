import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div>Child content</div>;
}

function renderWithBoundary(shouldThrow: boolean) {
  return render(
    <MantineProvider>
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Normal rendering (no error)
// ---------------------------------------------------------------------------

describe('ErrorBoundary — no error', () => {
  it('renders children when no error is thrown', () => {
    renderWithBoundary(false);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('does not render the fallback when no error is thrown', () => {
    renderWithBoundary(false);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error fallback
// ---------------------------------------------------------------------------

describe('ErrorBoundary — error fallback', () => {
  it('renders "Something went wrong" heading when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithBoundary(true);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('renders a Reload button when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithBoundary(true);
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('renders the thrown error message in the fallback', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithBoundary(true);
    expect(screen.getByText('Test render error')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('does not render the children when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithBoundary(true);
    expect(screen.queryByText('Child content')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('logs the error via console.error with [ErrorBoundary] prefix', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithBoundary(true);
    const calls = consoleSpy.mock.calls.flat();
    // The boundary logs '[ErrorBoundary]' as first arg
    const loggedBoundaryError = calls.some(
      (arg) => typeof arg === 'string' && arg.includes('[ErrorBoundary]'),
    );
    expect(loggedBoundaryError).toBe(true);
    consoleSpy.mockRestore();
  });
});
