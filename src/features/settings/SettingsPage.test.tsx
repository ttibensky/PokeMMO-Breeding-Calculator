import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SettingsPage } from './SettingsPage';
import { useBreedingStore, resetStore, DEFAULT_SETTINGS } from '../../store';
import { buildExportBundle, serializeExport } from '../../store/io';
import type { OwnedPokemon } from '../../store/types';

function renderPage() {
  return render(
    <MantineProvider>
      <SettingsPage />
    </MantineProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------

describe('SettingsPage — render', () => {
  it('renders the Prices & Fees section heading', () => {
    renderPage();
    expect(screen.getByText('Prices & Fees')).toBeInTheDocument();
  });

  it('renders a power item price label (Power Weight (HP))', () => {
    renderPage();
    expect(screen.getByLabelText('Power Weight (HP)')).toBeInTheDocument();
  });

  it('renders the Everstone label in Breeding Items', () => {
    renderPage();
    expect(screen.getByText('Everstone')).toBeInTheDocument();
  });

  it('renders Gender fee labels', () => {
    renderPage();
    expect(screen.getByText('Gender fee (1:1 ratio)')).toBeInTheDocument();
    expect(screen.getByText('Gender fee (7:1 ratio)')).toBeInTheDocument();
  });

  it('renders the Feature Toggles section heading', () => {
    renderPage();
    expect(screen.getByText('Feature Toggles')).toBeInTheDocument();
  });

  it('renders the four feature switches', () => {
    renderPage();
    // Mantine Switch renders role="switch". The accessible name includes both
    // the label text and the description text.
    expect(screen.getByRole('switch', { name: /egg moves/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /hidden ability/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /shiny/i })).toBeInTheDocument();
    // "Alpha" switch: the Hidden Ability description also mentions "Alpha Pokémon",
    // so use a tighter anchor that matches "^Alpha" (start of accessible name).
    expect(screen.getByRole('switch', { name: /^Alpha Show Alpha/i })).toBeInTheDocument();
  });

  it('renders the Breeding Mechanics section heading', () => {
    renderPage();
    expect(screen.getByText('Breeding Mechanics (Advanced)')).toBeInTheDocument();
  });

  it('renders the Everstone mechanic switch labels', () => {
    renderPage();
    expect(
      screen.getByRole('switch', { name: /everstone is consumed each breed/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: /everstone guarantees nature pass/i }),
    ).toBeInTheDocument();
  });

  it('renders the Ability pass rate NumberInput', () => {
    renderPage();
    expect(screen.getByLabelText('Ability pass rate')).toBeInTheDocument();
  });

  it('renders the Reset to defaults button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PRICE EDIT
// Mantine NumberInput with prefix="$" and thousandSeparator="," manages its
// own internal state. fireEvent.change on the underlying text input fires
// Mantine's input handler which parses and validates the raw text. Integer
// values without formatting characters are reliably parsed and forwarded to
// the React onChange prop.
// ---------------------------------------------------------------------------

describe('SettingsPage — price edit', () => {
  it('updates powerWeight in the store when the Power Weight input changes', () => {
    renderPage();
    const input = screen.getByLabelText('Power Weight (HP)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12000' } });
    expect(useBreedingStore.getState().settings.prices.powerWeight).toBe(12000);
  });

  it('updating one price does not affect other prices', () => {
    renderPage();
    const input = screen.getByLabelText('Power Weight (HP)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    const { prices } = useBreedingStore.getState().settings;
    expect(prices.powerWeight).toBe(5000);
    expect(prices.everstone).toBe(DEFAULT_SETTINGS.prices.everstone);
    expect(prices.ditto).toBe(DEFAULT_SETTINGS.prices.ditto);
  });

  it('treats empty price input as 0 (handlePriceChange NaN guard)', () => {
    renderPage();
    const input = screen.getByLabelText('Power Weight (HP)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    // Mantine fires onChange('') which handlePriceChange converts to 0 via isNaN guard
    expect(useBreedingStore.getState().settings.prices.powerWeight).toBe(0);
  });

  it('can update the Everstone price', () => {
    renderPage();
    const input = screen.getByLabelText('Everstone') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20000' } });
    expect(useBreedingStore.getState().settings.prices.everstone).toBe(20000);
  });

  it('can update the Gender fee base price', () => {
    renderPage();
    const input = screen.getByLabelText('Gender fee (1:1 ratio)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8000' } });
    expect(useBreedingStore.getState().settings.prices.genderFeeBase).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// FEATURE TOGGLES
// ---------------------------------------------------------------------------

describe('SettingsPage — feature toggles', () => {
  it('toggles eggMoves from false to true', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.features.eggMoves).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /egg moves/i }));
    expect(useBreedingStore.getState().settings.features.eggMoves).toBe(true);
  });

  it('toggles hiddenAbility from false to true', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.features.hiddenAbility).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /hidden ability/i }));
    expect(useBreedingStore.getState().settings.features.hiddenAbility).toBe(true);
  });

  it('toggles shiny from false to true', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.features.shiny).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /shiny/i }));
    expect(useBreedingStore.getState().settings.features.shiny).toBe(true);
  });

  it('toggles alpha from false to true', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.features.alpha).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: /^Alpha Show Alpha/i }));
    expect(useBreedingStore.getState().settings.features.alpha).toBe(true);
  });

  it('toggling one feature does not affect the others', () => {
    renderPage();
    fireEvent.click(screen.getByRole('switch', { name: /egg moves/i }));
    const { features } = useBreedingStore.getState().settings;
    expect(features.eggMoves).toBe(true);
    expect(features.hiddenAbility).toBe(false);
    expect(features.shiny).toBe(false);
    expect(features.alpha).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ABILITY PASS RATE — percent↔fraction conversion
// The NumberInput displays the value with a "%" suffix appended.
// Mantine includes the suffix in input.value. Valid integer entries in [0,100]
// are forwarded to handlePercentChange, which divides by 100 and stores as
// a fraction.
// ---------------------------------------------------------------------------

describe('SettingsPage — ability pass rate', () => {
  it('displays the default abilityPassRate as "80%" in the input', () => {
    renderPage();
    const input = screen.getByLabelText('Ability pass rate') as HTMLInputElement;
    expect(input.value).toBe('80%');
  });

  it('stores 0.9 when user enters 90', () => {
    renderPage();
    const input = screen.getByLabelText('Ability pass rate') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '90' } });
    expect(useBreedingStore.getState().settings.mechanics.abilityPassRate).toBeCloseTo(0.9, 10);
  });

  it('stores 0 when user enters 0', () => {
    renderPage();
    const input = screen.getByLabelText('Ability pass rate') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(useBreedingStore.getState().settings.mechanics.abilityPassRate).toBe(0);
  });

  it('stores 0.5 when user enters 50', () => {
    renderPage();
    const input = screen.getByLabelText('Ability pass rate') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(useBreedingStore.getState().settings.mechanics.abilityPassRate).toBeCloseTo(0.5, 10);
  });
});

// ---------------------------------------------------------------------------
// NESTED IV SPLIT — sibling preservation
// The component spreads the existing sub-object before updating a single key,
// so changing "high" must not clobber "avg" or "low".
// ---------------------------------------------------------------------------

describe('SettingsPage — ivPassChanceOneItem nested update', () => {
  it('displays the default ivPassChanceOneItem.high value as "20%" in the input', () => {
    renderPage();
    // There are multiple "High" labels (one/two items sections). Get the first.
    const highInputs = screen.getAllByLabelText('High') as HTMLInputElement[];
    expect(highInputs[0].value).toBe('20%');
  });

  it('updating the high sub-field stores 0.3 while avg stays 0.6 and low stays 0.2', () => {
    renderPage();
    const highInputs = screen.getAllByLabelText('High') as HTMLInputElement[];
    // First "High" input is ivPassChanceOneItem.high
    fireEvent.change(highInputs[0], { target: { value: '30' } });
    const { ivPassChanceOneItem } = useBreedingStore.getState().settings.mechanics;
    expect(ivPassChanceOneItem.high).toBeCloseTo(0.3, 10);
    // Siblings must be preserved (not clobbered)
    expect(ivPassChanceOneItem.avg).toBeCloseTo(0.6, 10);
    expect(ivPassChanceOneItem.low).toBeCloseTo(0.2, 10);
  });

  it('updating avg sub-field preserves high and low', () => {
    renderPage();
    const avgInputs = screen.getAllByLabelText('Avg') as HTMLInputElement[];
    fireEvent.change(avgInputs[0], { target: { value: '50' } });
    const { ivPassChanceOneItem } = useBreedingStore.getState().settings.mechanics;
    expect(ivPassChanceOneItem.avg).toBeCloseTo(0.5, 10);
    expect(ivPassChanceOneItem.high).toBeCloseTo(0.2, 10);
    expect(ivPassChanceOneItem.low).toBeCloseTo(0.2, 10);
  });

  it('updating ivPassChanceTwoItems high does not affect ivPassChanceOneItem', () => {
    renderPage();
    const highInputs = screen.getAllByLabelText('High') as HTMLInputElement[];
    // Second "High" input is ivPassChanceTwoItems.high
    fireEvent.change(highInputs[1], { target: { value: '20' } });
    const { mechanics } = useBreedingStore.getState().settings;
    expect(mechanics.ivPassChanceTwoItems.high).toBeCloseTo(0.2, 10);
    // ivPassChanceOneItem must remain untouched
    expect(mechanics.ivPassChanceOneItem.high).toBeCloseTo(0.2, 10);
    expect(mechanics.ivPassChanceOneItem.avg).toBeCloseTo(0.6, 10);
    expect(mechanics.ivPassChanceOneItem.low).toBeCloseTo(0.2, 10);
  });
});

// ---------------------------------------------------------------------------
// MECHANIC SWITCHES
// ---------------------------------------------------------------------------

describe('SettingsPage — mechanic switches', () => {
  it('toggles everstoneConsumed (default true → false)', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.mechanics.everstoneConsumed).toBe(true);
    fireEvent.click(
      screen.getByRole('switch', { name: /everstone is consumed each breed/i }),
    );
    expect(useBreedingStore.getState().settings.mechanics.everstoneConsumed).toBe(false);
  });

  it('toggles everstoneGuaranteed (default true → false)', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.mechanics.everstoneGuaranteed).toBe(true);
    fireEvent.click(
      screen.getByRole('switch', { name: /everstone guarantees nature pass/i }),
    );
    expect(useBreedingStore.getState().settings.mechanics.everstoneGuaranteed).toBe(false);
  });

  it('toggles regionalFormsSupported (default false → true)', () => {
    renderPage();
    expect(useBreedingStore.getState().settings.mechanics.regionalFormsSupported).toBe(false);
    fireEvent.click(
      screen.getByRole('switch', { name: /regional forms supported/i }),
    );
    expect(useBreedingStore.getState().settings.mechanics.regionalFormsSupported).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RESET TO DEFAULTS
// ---------------------------------------------------------------------------

describe('SettingsPage — reset to defaults', () => {
  it('resets settings to DEFAULT_SETTINGS when confirm returns true', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    // Mutate settings to ensure something changed
    useBreedingStore.getState().updatePrices({ powerWeight: 99999 });
    useBreedingStore.getState().updateFeatures({ shiny: true });
    useBreedingStore.getState().updateMechanics({ abilityPassRate: 0.5 });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(useBreedingStore.getState().settings).toEqual(DEFAULT_SETTINGS);

    vi.restoreAllMocks();
  });

  it('leaves mutated settings unchanged when confirm returns false', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    useBreedingStore.getState().updatePrices({ powerWeight: 77777 });
    useBreedingStore.getState().updateFeatures({ alpha: true });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    const { settings } = useBreedingStore.getState();
    expect(settings.prices.powerWeight).toBe(77777);
    expect(settings.features.alpha).toBe(true);

    vi.restoreAllMocks();
  });

  it('calls window.confirm with a descriptive message', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0][0]).toContain('Reset');

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// DATA SECTION — export / import UI
// ---------------------------------------------------------------------------

function makeTestMon(overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    id: 'settings-test-mon',
    speciesId: 25,
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    nature: 'Timid',
    ability: 'Static',
    isHiddenAbility: false,
    gender: 'female',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    createdAt: '2026-06-13T00:00:00.000Z',
    ...overrides,
  };
}

function makeExportJson(mon?: OwnedPokemon): string {
  const bundle = buildExportBundle(
    {
      ownedPokemon: mon ? [mon] : [],
      projects: [],
      settings: DEFAULT_SETTINGS,
    },
    '2026-06-13T00:00:00.000Z',
  );
  return serializeExport(bundle);
}

describe('SettingsPage — Data section render', () => {
  it('renders the "Export data" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /export data/i })).toBeInTheDocument();
  });

  it('renders the file input for import', () => {
    renderPage();
    expect(screen.getByLabelText(/import data from json file/i)).toBeInTheDocument();
  });

  it('renders the Data section heading', () => {
    renderPage();
    expect(screen.getByText('Data (export / import)')).toBeInTheDocument();
  });
});

describe('SettingsPage — import flow: valid JSON', () => {
  it('shows success Alert and updates the store after importing a valid file', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mon = makeTestMon();
    const json = makeExportJson(mon);

    // Create a File and polyfill .text() since jsdom may not implement it
    const file = new File([json], 'backup.json', { type: 'application/json' });
    file.text = () => Promise.resolve(json);

    renderPage();

    const input = screen.getByLabelText(/import data from json file/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/import successful/i)).toBeInTheDocument();
    });

    expect(useBreedingStore.getState().ownedPokemon).toEqual([mon]);

    vi.restoreAllMocks();
  });

  it('shows imported count in the success message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mon = makeTestMon();
    const json = makeExportJson(mon);
    const file = new File([json], 'backup.json', { type: 'application/json' });
    file.text = () => Promise.resolve(json);

    renderPage();

    const input = screen.getByLabelText(/import data from json file/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/imported 1 pokémon and 0 projects/i)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});

describe('SettingsPage — import flow: invalid JSON', () => {
  it('shows error Alert for invalid JSON without updating the store', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const badJson = 'this is not valid json{{{';
    const file = new File([badJson], 'bad.json', { type: 'application/json' });
    file.text = () => Promise.resolve(badJson);

    renderPage();

    const input = screen.getByLabelText(/import data from json file/i);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/import failed/i)).toBeInTheDocument();
    });

    // Store should remain unchanged (empty)
    expect(useBreedingStore.getState().ownedPokemon).toEqual([]);

    vi.restoreAllMocks();
  });
});

describe('SettingsPage — import flow: confirm=false', () => {
  it('aborts import and leaves store unchanged when user cancels confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const mon = makeTestMon();
    const json = makeExportJson(mon);
    const file = new File([json], 'backup.json', { type: 'application/json' });
    file.text = () => Promise.resolve(json);

    renderPage();

    const input = screen.getByLabelText(/import data from json file/i);
    fireEvent.change(input, { target: { files: [file] } });

    // Give async operations a chance to run (they shouldn't since confirm=false bails early)
    await new Promise((r) => setTimeout(r, 50));

    // No success or error alert
    expect(screen.queryByText(/import successful/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/import failed/i)).not.toBeInTheDocument();

    // Store unchanged
    expect(useBreedingStore.getState().ownedPokemon).toEqual([]);

    vi.restoreAllMocks();
  });
});
