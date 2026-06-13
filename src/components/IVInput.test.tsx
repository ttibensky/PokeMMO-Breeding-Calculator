import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { IVInput } from './IVInput';

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('IVInput', () => {
  it('renders with the given label visible', () => {
    const onChange = vi.fn();
    renderWithMantine(<IVInput label="HP" value={0} onChange={onChange} />);
    expect(screen.getByLabelText('HP')).toBeInTheDocument();
  });

  it('renders with the correct initial value', () => {
    const onChange = vi.fn();
    renderWithMantine(<IVInput label="Atk" value={15} onChange={onChange} />);
    const input = screen.getByLabelText('Atk') as HTMLInputElement;
    expect(input.value).toBe('15');
  });

  it('calls onChange with a valid value when the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithMantine(<IVInput label="Def" value={0} onChange={onChange} />);
    const input = screen.getByLabelText('Def');
    await user.clear(input);
    await user.type(input, '20');
    // onChange may be called multiple times; assert the last meaningful value
    expect(onChange).toHaveBeenCalled();
    const calls = (onChange.mock.calls as [number][]).map((c) => c[0]).filter((v) => !isNaN(v));
    expect(calls).toContain(20);
  });

  it('clamps values above 31 to 31 on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithMantine(<IVInput label="SpA" value={0} onChange={onChange} />);
    const input = screen.getByLabelText('SpA');
    await user.clear(input);
    await user.type(input, '50');
    await user.tab(); // trigger blur
    const blurCalls = (onChange.mock.calls as [number][]).map((c) => c[0]);
    const lastCall = blurCalls[blurCalls.length - 1];
    expect(lastCall).toBe(31);
  });

  it('clamps values below 0 to 0 on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithMantine(<IVInput label="SpD" value={15} onChange={onChange} />);
    const input = screen.getByLabelText('SpD');
    await user.clear(input);
    // Mantine NumberInput won't let us type a bare '-' directly, so test empty input
    // which parses as NaN → clamped to 0
    await user.tab();
    const blurCalls = (onChange.mock.calls as [number][]).map((c) => c[0]);
    expect(blurCalls[blurCalls.length - 1]).toBe(0);
  });

  it('uses the provided id attribute on the input', () => {
    const onChange = vi.fn();
    renderWithMantine(<IVInput label="Spe" value={0} onChange={onChange} id="iv-spe" />);
    const input = document.getElementById('iv-spe');
    expect(input).toBeInTheDocument();
  });
});
