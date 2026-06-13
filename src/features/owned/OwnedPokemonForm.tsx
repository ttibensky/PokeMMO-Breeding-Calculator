import { useEffect } from 'react';
import {
  Modal,
  Button,
  Group,
  Select,
  SegmentedControl,
  Checkbox,
  Textarea,
  Stack,
  SimpleGrid,
  TagsInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { NATURES } from '../../data/natures';
import { SpeciesSelect } from '../../components/SpeciesSelect';
import { IVInput } from '../../components/IVInput';
import {
  emptyIVs,
  allowedGenders,
  normalAbilities,
  hiddenAbility,
} from './ownedHelpers';
import type { Gender, IVs } from '../../store/types';

interface FormValues {
  speciesId: number | null;
  ivs: IVs;
  nature: string;
  ability: string;
  isHiddenAbility: boolean;
  gender: Gender;
  isShiny: boolean;
  isAlpha: boolean;
  eggMoves: string[];
  notes: string;
}

interface OwnedPokemonFormProps {
  opened: boolean;
  onClose: () => void;
  editingId?: string;
  duplicateFromId?: string;
}

const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  genderless: 'Genderless',
};

const STAT_LABELS: { key: keyof IVs; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

function buildInitialValues(): FormValues {
  return {
    speciesId: null,
    ivs: emptyIVs(),
    nature: NATURES[0],
    ability: '',
    isHiddenAbility: false,
    gender: 'male',
    isShiny: false,
    isAlpha: false,
    eggMoves: [],
    notes: '',
  };
}

export function OwnedPokemonForm({ opened, onClose, editingId, duplicateFromId }: OwnedPokemonFormProps) {
  const addOwnedPokemon = useBreedingStore((s) => s.addOwnedPokemon);
  const updateOwnedPokemon = useBreedingStore((s) => s.updateOwnedPokemon);
  const getOwnedById = useBreedingStore((s) => s.getOwnedById);
  const features = useBreedingStore((s) => s.settings.features);

  const form = useForm<FormValues>({
    initialValues: buildInitialValues(),
    validate: {
      speciesId: (val) => (val === null ? 'Species is required' : null),
    },
  });

  // Pre-fill when editing
  useEffect(() => {
    if (!opened) return;
    const sourceId = editingId ?? duplicateFromId;
    if (sourceId) {
      const existing = getOwnedById(sourceId);
      if (existing) {
        form.setValues({
          speciesId: existing.speciesId,
          ivs: { ...existing.ivs },
          nature: existing.nature,
          ability: existing.ability,
          isHiddenAbility: existing.isHiddenAbility,
          gender: existing.gender,
          isShiny: existing.isShiny,
          isAlpha: existing.isAlpha,
          eggMoves: [...existing.eggMoves],
          notes: existing.notes ?? '',
        });
        return;
      }
    }
    form.setValues(buildInitialValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, editingId, duplicateFromId]);

  const species = form.values.speciesId !== null ? getSpeciesById(form.values.speciesId) : undefined;

  const normalAbilityNames = species ? normalAbilities(species) : [];
  const haAbilityName = species ? hiddenAbility(species) : undefined;
  const abilityOptions = [
    ...normalAbilityNames.map((name) => ({ value: name, label: name })),
    ...(features.hiddenAbility && haAbilityName
      ? [{ value: haAbilityName, label: `${haAbilityName} (Hidden)` }]
      : []),
  ];

  const genderOptions = species
    ? allowedGenders(species).map((g) => ({ value: g, label: GENDER_LABELS[g] }))
    : [{ value: 'male', label: 'Male' }];

  const eggMovesOptions = species ? species.moves : [];

  function handleSpeciesChange(id: number) {
    const newSpecies = getSpeciesById(id);
    if (!newSpecies) {
      form.setFieldValue('speciesId', id);
      return;
    }
    const firstNormal = normalAbilities(newSpecies)[0] ?? '';
    const firstGender = allowedGenders(newSpecies)[0];
    form.setValues({
      ...form.values,
      speciesId: id,
      ability: firstNormal,
      isHiddenAbility: false,
      gender: firstGender,
      eggMoves: [],
    });
  }

  function handleAbilityChange(val: string | null) {
    if (!val) return;
    const isHA = haAbilityName === val;
    form.setValues({
      ...form.values,
      ability: val,
      isHiddenAbility: isHA,
    });
  }

  function handleSubmit(values: FormValues) {
    if (values.speciesId === null) return;

    const payload = {
      speciesId: values.speciesId,
      ivs: values.ivs,
      nature: values.nature,
      ability: values.ability,
      isHiddenAbility: features.hiddenAbility ? values.isHiddenAbility : false,
      gender: values.gender,
      isShiny: features.shiny ? values.isShiny : false,
      isAlpha: features.alpha ? values.isAlpha : false,
      eggMoves: features.eggMoves ? values.eggMoves : [],
      notes: values.notes || undefined,
    };

    if (editingId) {
      updateOwnedPokemon(editingId, payload);
    } else {
      addOwnedPokemon(payload);
    }
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingId ? 'Edit Pokémon' : duplicateFromId ? 'Duplicate Pokémon' : 'Add Pokémon'}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <SpeciesSelect
            value={form.values.speciesId}
            onChange={handleSpeciesChange}
            label="Species"
            required
            error={form.errors.speciesId as string | undefined}
          />

          <SimpleGrid cols={3} spacing="xs">
            {STAT_LABELS.map(({ key, label }) => (
              <IVInput
                key={key}
                id={`iv-${key}`}
                label={label}
                value={form.values.ivs[key]}
                onChange={(v) => form.setFieldValue(`ivs.${key}`, v)}
              />
            ))}
          </SimpleGrid>

          <Select
            label="Nature"
            data={NATURES.map((n) => ({ value: n, label: n }))}
            value={form.values.nature}
            onChange={(val) => val && form.setFieldValue('nature', val)}
            searchable
            aria-label="Nature"
          />

          <Select
            label="Ability"
            data={abilityOptions.length > 0 ? abilityOptions : [{ value: '', label: 'Select a species first' }]}
            value={form.values.ability}
            onChange={handleAbilityChange}
            disabled={abilityOptions.length === 0}
            aria-label="Ability"
          />

          <SegmentedControl
            data={genderOptions}
            value={form.values.gender}
            onChange={(val) => form.setFieldValue('gender', val as Gender)}
            aria-label="Gender"
          />

          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={form.values.notes}
            onChange={(e) => form.setFieldValue('notes', e.currentTarget.value)}
            autosize
            minRows={2}
          />

          {features.shiny && (
            <Checkbox
              label="Shiny"
              checked={form.values.isShiny}
              onChange={(e) => form.setFieldValue('isShiny', e.currentTarget.checked)}
            />
          )}

          {features.alpha && (
            <Checkbox
              label="Alpha"
              checked={form.values.isAlpha}
              onChange={(e) => form.setFieldValue('isAlpha', e.currentTarget.checked)}
            />
          )}

          {features.eggMoves && eggMovesOptions.length > 0 && (
            <TagsInput
              label="Egg Moves"
              data={eggMovesOptions}
              value={form.values.eggMoves}
              onChange={(val) => form.setFieldValue('eggMoves', val)}
              aria-label="Egg Moves"
            />
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit">
              {editingId ? 'Save Changes' : 'Add Pokémon'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
