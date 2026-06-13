import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { useBreedingStore } from '../../store';
import { ITEM_LABELS } from '../projects/projectHelpers';
import type { PriceKey } from '../../store/types';

const POWER_ITEM_KEYS: PriceKey[] = [
  'powerWeight',
  'powerBracer',
  'powerBelt',
  'powerLens',
  'powerBand',
  'powerAnklet',
];

const BREEDING_ITEM_KEYS: PriceKey[] = ['everstone', 'ditto'];

const FEE_LABELS: Partial<Record<PriceKey, string>> = {
  genderFeeBase: 'Gender fee (1:1 ratio)',
  genderFeeMax: 'Gender fee (7:1 ratio)',
  abilityPill: 'Ability Pill',
};

const FEE_KEYS: PriceKey[] = ['genderFeeBase', 'genderFeeMax', 'abilityPill'];

function getPriceLabel(key: PriceKey): string {
  if (key in ITEM_LABELS) return ITEM_LABELS[key as keyof typeof ITEM_LABELS];
  return FEE_LABELS[key] ?? key;
}

export function SettingsPage() {
  const settings = useBreedingStore((s) => s.settings);
  const updatePrices = useBreedingStore((s) => s.updatePrices);
  const updateFeatures = useBreedingStore((s) => s.updateFeatures);
  const updateMechanics = useBreedingStore((s) => s.updateMechanics);
  const resetSettings = useBreedingStore((s) => s.resetSettings);

  function handlePriceChange(key: PriceKey, val: string | number) {
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    updatePrices({ [key]: isNaN(n) ? 0 : Math.max(0, Math.round(n)) });
  }

  function handlePercentChange(
    field: 'abilityPassRate',
    val: string | number,
  ): void;
  function handlePercentChange(
    field: 'ivPassChanceOneItem' | 'ivPassChanceTwoItems',
    val: string | number,
    sub: 'high' | 'avg' | 'low',
  ): void;
  function handlePercentChange(
    field: 'abilityPassRate' | 'ivPassChanceOneItem' | 'ivPassChanceTwoItems',
    val: string | number,
    sub?: 'high' | 'avg' | 'low',
  ): void {
    const pct = typeof val === 'number' ? val : parseFloat(String(val));
    const fraction = isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct)) / 100;

    if (field === 'abilityPassRate') {
      updateMechanics({ abilityPassRate: fraction });
    } else if (sub) {
      updateMechanics({
        [field]: { ...settings.mechanics[field], [sub]: fraction },
      });
    }
  }

  function handleReset() {
    if (window.confirm('Reset all settings to defaults?')) {
      resetSettings();
    }
  }

  return (
    <Stack gap="xl">
      <Title order={1}>Settings</Title>

      {/* Prices & Fees */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={3}>Prices &amp; Fees</Title>

          <Title order={5} c="dimmed">
            Power Items
          </Title>
          <Group grow align="flex-start">
            {POWER_ITEM_KEYS.map((key) => (
              <NumberInput
                key={key}
                label={getPriceLabel(key)}
                value={settings.prices[key]}
                onChange={(val) => handlePriceChange(key, val)}
                min={0}
                allowDecimal={false}
                prefix="$"
                thousandSeparator=","
                clampBehavior="strict"
              />
            ))}
          </Group>

          <Title order={5} c="dimmed">
            Breeding Items
          </Title>
          <Group align="flex-start">
            {BREEDING_ITEM_KEYS.map((key) => (
              <NumberInput
                key={key}
                label={getPriceLabel(key)}
                value={settings.prices[key]}
                onChange={(val) => handlePriceChange(key, val)}
                min={0}
                allowDecimal={false}
                prefix="$"
                thousandSeparator=","
                clampBehavior="strict"
                style={{ flex: 1, maxWidth: 220 }}
              />
            ))}
          </Group>

          <Title order={5} c="dimmed">
            Fees
          </Title>
          <Group align="flex-start">
            {FEE_KEYS.map((key) => (
              <NumberInput
                key={key}
                label={getPriceLabel(key)}
                value={settings.prices[key]}
                onChange={(val) => handlePriceChange(key, val)}
                min={0}
                allowDecimal={false}
                prefix="$"
                thousandSeparator=","
                clampBehavior="strict"
                style={{ flex: 1, maxWidth: 220 }}
              />
            ))}
          </Group>
        </Stack>
      </Card>

      {/* Feature Toggles */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={3}>Feature Toggles</Title>
          <Text c="dimmed" size="sm">
            Enable or disable optional game features tracked in your projects.
          </Text>

          <Switch
            label="Egg Moves"
            description="Show egg-move fields and include egg moves in goals."
            checked={settings.features.eggMoves}
            onChange={(e) =>
              updateFeatures({ eggMoves: e.currentTarget.checked })
            }
          />
          <Switch
            label="Hidden Ability"
            description="Show Hidden Ability options (sourced from Alpha Pokémon)."
            checked={settings.features.hiddenAbility}
            onChange={(e) =>
              updateFeatures({ hiddenAbility: e.currentTarget.checked })
            }
          />
          <Switch
            label="Shiny"
            description="Show shiny fields; shiny×shiny breeding only."
            checked={settings.features.shiny}
            onChange={(e) =>
              updateFeatures({ shiny: e.currentTarget.checked })
            }
          />
          <Switch
            label="Alpha"
            description="Show Alpha fields."
            checked={settings.features.alpha}
            onChange={(e) =>
              updateFeatures({ alpha: e.currentTarget.checked })
            }
          />
        </Stack>
      </Card>

      {/* Mechanic Constants */}
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Title order={3}>Breeding Mechanics (Advanced)</Title>
          <Alert color="violet" variant="light">
            These values are uncertain and come from community research. They
            are editable so you can correct them if in-game testing reveals
            different behaviour. Sensible defaults are sourced from{' '}
            <em>docs/breeding-mechanics.md</em>.
          </Alert>

          <Switch
            label="Everstone is consumed each breed"
            description="The Everstone holder is destroyed after each breed. [verify in-game]"
            checked={settings.mechanics.everstoneConsumed}
            onChange={(e) =>
              updateMechanics({ everstoneConsumed: e.currentTarget.checked })
            }
          />

          <Switch
            label="Everstone guarantees nature pass"
            description="A single Everstone guarantees the nature passes (vs 50%). [verify in-game]"
            checked={settings.mechanics.everstoneGuaranteed}
            onChange={(e) =>
              updateMechanics({ everstoneGuaranteed: e.currentTarget.checked })
            }
          />

          <NumberInput
            label="Ability pass rate"
            description="Chance the female-role parent's ability passes (~80%). [verify in-game]"
            value={Math.round(settings.mechanics.abilityPassRate * 100)}
            onChange={(val) => handlePercentChange('abilityPassRate', val)}
            min={0}
            max={100}
            suffix="%"
            allowDecimal={false}
            clampBehavior="strict"
            style={{ maxWidth: 220 }}
          />

          <Stack gap="xs">
            <Text fw={500} size="sm">
              IV pass chance — one Power Item
            </Text>
            <Text c="dimmed" size="xs">
              Should sum to 100%. [verify in-game]
            </Text>
            <Group align="flex-start">
              {(['high', 'avg', 'low'] as const).map((sub) => (
                <NumberInput
                  key={sub}
                  label={sub.charAt(0).toUpperCase() + sub.slice(1)}
                  value={Math.round(
                    settings.mechanics.ivPassChanceOneItem[sub] * 100,
                  )}
                  onChange={(val) =>
                    handlePercentChange('ivPassChanceOneItem', val, sub)
                  }
                  min={0}
                  max={100}
                  suffix="%"
                  allowDecimal={false}
                  clampBehavior="strict"
                  style={{ flex: 1, maxWidth: 160 }}
                />
              ))}
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text fw={500} size="sm">
              IV pass chance — two Power Items
            </Text>
            <Text c="dimmed" size="xs">
              Should sum to 100%. [verify in-game]
            </Text>
            <Group align="flex-start">
              {(['high', 'avg', 'low'] as const).map((sub) => (
                <NumberInput
                  key={sub}
                  label={sub.charAt(0).toUpperCase() + sub.slice(1)}
                  value={Math.round(
                    settings.mechanics.ivPassChanceTwoItems[sub] * 100,
                  )}
                  onChange={(val) =>
                    handlePercentChange('ivPassChanceTwoItems', val, sub)
                  }
                  min={0}
                  max={100}
                  suffix="%"
                  allowDecimal={false}
                  clampBehavior="strict"
                  style={{ flex: 1, maxWidth: 160 }}
                />
              ))}
            </Group>
          </Stack>

          <Switch
            label="Regional forms supported"
            description="Model regional-form inheritance (under-documented in PokeMMO). [verify in-game]"
            checked={settings.mechanics.regionalFormsSupported}
            onChange={(e) =>
              updateMechanics({
                regionalFormsSupported: e.currentTarget.checked,
              })
            }
          />
        </Stack>
      </Card>

      {/* Reset */}
      <Group>
        <Button color="red" variant="outline" onClick={handleReset}>
          Reset to defaults
        </Button>
      </Group>
    </Stack>
  );
}
