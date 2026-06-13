import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Button,
  Group,
  Select,
  Checkbox,
  Stack,
  TextInput,
  SimpleGrid,
  Text,
  TagsInput,
  Paper,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { NATURES } from '../../data/natures';
import { SpeciesSelect } from '../../components/SpeciesSelect';
import { allowedGenders, normalAbilities } from '../owned/ownedHelpers';
import { estimateGoal } from '../../engine/index';
import { goalSummary, formatNatureLabel } from './projectHelpers';
import type { StatKey, Gender } from '../../store/types';
import type { BreedingGoal } from '../../store/types';

const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_LABELS: Record<StatKey, string> = {
  hp:  'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

interface FormValues {
  name: string;
  speciesId: number | null;
  targetStats: StatKey[];
  nature: string | null;
  ability: string | null;
  gender: string | null; // 'male' | 'female' | null (null = Any)
  requireHiddenAbility: boolean;
  requireShiny: boolean;
  eggMoves: string[];
}

interface GoalFormProps {
  opened: boolean;
  onClose: () => void;
  editingId?: string;
}

function buildInitialValues(): FormValues {
  return {
    name: '',
    speciesId: null,
    targetStats: [],
    nature: null,
    ability: null,
    gender: null,
    requireHiddenAbility: false,
    requireShiny: false,
    eggMoves: [],
  };
}

export function GoalForm({ opened, onClose, editingId }: GoalFormProps) {
  const addProject = useBreedingStore((s) => s.addProject);
  const updateProject = useBreedingStore((s) => s.updateProject);
  const getProjectById = useBreedingStore((s) => s.getProjectById);
  const settings = useBreedingStore((s) => s.settings);
  const features = settings.features;

  const form = useForm<FormValues>({
    initialValues: buildInitialValues(),
    validate: {
      name: (val) => (val.trim().length === 0 ? 'Name is required' : null),
      speciesId: (val) => (val === null ? 'Species is required' : null),
      targetStats: (val) =>
        val.length < 2 || val.length > 6
          ? 'Select between 2 and 6 stats'
          : null,
    },
  });

  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (!opened) return;
    setNameManuallyEdited(false);
    if (editingId) {
      const existing = getProjectById(editingId);
      if (existing) {
        const g = existing.goal;
        const stats = (Object.keys(g.targetIVs) as StatKey[]).filter(
          (s) => g.targetIVs[s] === 31
        );
        form.setValues({
          name: existing.name,
          speciesId: g.speciesId,
          targetStats: stats,
          nature: g.nature ?? null,
          ability: g.ability ?? null,
          gender: g.gender ?? null,
          requireHiddenAbility: g.requireHiddenAbility ?? false,
          requireShiny: g.requireShiny ?? false,
          eggMoves: g.eggMoves ?? [],
        });
        return;
      }
    }
    form.setValues(buildInitialValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingId]);

  const species = form.values.speciesId !== null
    ? getSpeciesById(form.values.speciesId)
    : undefined;

  const normalAbilityNames = species ? normalAbilities(species) : [];
  const abilityOptions = normalAbilityNames.map((name) => ({ value: name, label: name }));

  const genderOptions = useMemo(() => {
    if (!species || species.isGenderless) return [];
    const allowed = allowedGenders(species);
    const options = [{ value: '', label: 'Any' }];
    if (allowed.includes('male')) options.push({ value: 'male', label: '♂ Male' });
    if (allowed.includes('female')) options.push({ value: 'female', label: '♀ Female' });
    return options;
  }, [species]);

  const eggMovesOptions = species ? species.moves : [];

  function handleSpeciesChange(id: number) {
    const newSpecies = getSpeciesById(id);
    form.setValues({
      ...form.values,
      speciesId: id,
      ability: null,
      gender: null,
      eggMoves: [],
      requireHiddenAbility: false,
      name: nameManuallyEdited
        ? form.values.name
        : (newSpecies?.name ?? form.values.name),
    });
  }

  function toggleStat(stat: StatKey) {
    const current = form.values.targetStats;
    const next = current.includes(stat)
      ? current.filter((s) => s !== stat)
      : [...current, stat];
    form.setFieldValue('targetStats', next);
  }

  // Build a partial goal for preview (may be incomplete if not all required fields set)
  const previewGoal: BreedingGoal | null = useMemo(() => {
    if (form.values.speciesId === null || form.values.targetStats.length < 2) return null;
    const targetIVs: Partial<Record<StatKey, 31>> = {};
    for (const s of form.values.targetStats) {
      targetIVs[s] = 31;
    }
    return {
      speciesId: form.values.speciesId,
      targetIVs,
      nature: form.values.nature ?? undefined,
      ability: form.values.ability ?? undefined,
      gender: (form.values.gender || undefined) as Gender | undefined,
      requireHiddenAbility: features.hiddenAbility ? form.values.requireHiddenAbility : undefined,
      requireShiny: features.shiny ? form.values.requireShiny : undefined,
      eggMoves: features.eggMoves && form.values.eggMoves.length > 0
        ? form.values.eggMoves
        : undefined,
    };
  }, [form.values, features]);

  const estimate = useMemo(() => {
    if (!previewGoal) return null;
    try {
      return estimateGoal(previewGoal, settings, getSpeciesById);
    } catch {
      return null;
    }
  }, [previewGoal, settings]);

  function handleSubmit(values: FormValues) {
    if (values.speciesId === null) return;

    const targetIVs: Partial<Record<StatKey, 31>> = {};
    for (const s of values.targetStats) {
      targetIVs[s] = 31;
    }

    const goal: BreedingGoal = {
      speciesId: values.speciesId,
      targetIVs,
      nature: values.nature ?? undefined,
      ability: values.ability ?? undefined,
      gender: (values.gender || undefined) as Gender | undefined,
      requireHiddenAbility: features.hiddenAbility ? values.requireHiddenAbility : undefined,
      requireShiny: features.shiny ? values.requireShiny : undefined,
      eggMoves: features.eggMoves && values.eggMoves.length > 0
        ? values.eggMoves
        : undefined,
    };

    if (editingId) {
      updateProject(editingId, { name: values.name.trim(), goal });
    } else {
      addProject({ name: values.name.trim(), goal });
    }
    onClose();
  }

  const statError = form.errors.targetStats as string | undefined;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingId ? 'Edit Project' : 'New Project'}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <SpeciesSelect
            value={form.values.speciesId}
            onChange={handleSpeciesChange}
            label="Target species"
            required
            error={form.errors.speciesId as string | undefined}
          />

          <TextInput
            label="Project name"
            required
            placeholder="e.g. Garchomp attacker"
            {...form.getInputProps('name')}
            onChange={(event) => {
              setNameManuallyEdited(true);
              form.setFieldValue('name', event.currentTarget.value);
            }}
          />

          {/* Target stats — checkboxes */}
          <div>
            <Text size="sm" fw={500} mb={4}>
              Target IVs (select 2–6){' '}
              {statError && (
                <Text component="span" size="sm" c="red">
                  — {statError}
                </Text>
              )}
            </Text>
            <SimpleGrid cols={6} spacing="xs">
              {STAT_KEYS.map((stat) => (
                <Checkbox
                  key={stat}
                  label={STAT_LABELS[stat]}
                  checked={form.values.targetStats.includes(stat)}
                  onChange={() => toggleStat(stat)}
                  aria-label={`Target ${STAT_LABELS[stat]}`}
                />
              ))}
            </SimpleGrid>
          </div>

          <Select
            label="Nature (optional)"
            placeholder="Any nature"
            data={NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) }))}
            value={form.values.nature}
            onChange={(val) => form.setFieldValue('nature', val)}
            searchable
            clearable
            aria-label="Nature"
          />

          <Select
            label="Ability (optional)"
            placeholder="Any ability"
            data={abilityOptions.length > 0 ? abilityOptions : []}
            value={form.values.ability}
            onChange={(val) => form.setFieldValue('ability', val)}
            clearable
            disabled={abilityOptions.length === 0}
            aria-label="Ability"
          />

          {/* Gender — only for non-genderless species with more than one option */}
          {genderOptions.length > 1 && (
            <Select
              label="Target gender (optional)"
              data={genderOptions}
              value={form.values.gender ?? ''}
              onChange={(val) => form.setFieldValue('gender', val || null)}
              aria-label="Target gender"
            />
          )}

          {/* Progressive disclosure */}
          {features.hiddenAbility && (
            <Checkbox
              label="Require Hidden Ability"
              checked={form.values.requireHiddenAbility}
              onChange={(e) =>
                form.setFieldValue('requireHiddenAbility', e.currentTarget.checked)
              }
            />
          )}

          {features.shiny && (
            <Checkbox
              label="Require Shiny"
              checked={form.values.requireShiny}
              onChange={(e) =>
                form.setFieldValue('requireShiny', e.currentTarget.checked)
              }
            />
          )}

          {features.eggMoves && eggMovesOptions.length > 0 && (
            <TagsInput
              label="Egg Moves (optional)"
              data={eggMovesOptions}
              value={form.values.eggMoves}
              onChange={(val) => form.setFieldValue('eggMoves', val)}
              aria-label="Egg Moves"
            />
          )}

          {/* Live preview */}
          {previewGoal && estimate && (
            <Paper withBorder p="xs" radius="sm">
              <Text size="xs" c="dimmed" mb={2}>
                Preview
              </Text>
              <Text size="sm" fw={500}>
                {goalSummary(previewGoal)}
              </Text>
              <Text size="xs" c="dimmed">
                ~{estimate.totalBreeds} breeds · est. $
                {estimate.cost.total.toLocaleString()} total
              </Text>
            </Paper>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit">
              {editingId ? 'Save Changes' : 'Create Project'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
