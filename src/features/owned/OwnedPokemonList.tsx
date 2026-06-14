import { useMemo, useState } from 'react';
import {
  TextInput,
  Card,
  Group,
  Text,
  Badge,
  Button,
  Stack,
  ActionIcon,
  Center,
  Modal,
  Select,
  Checkbox,
} from '@mantine/core';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { countPerfectIVs, formatIVs } from './ownedHelpers';
import {
  DEFAULT_CRITERIA,
  deriveFilterOptions,
  filterAndSortOwned,
} from './ownedFilters';
import type { OwnedFilterCriteria } from './ownedFilters';

const GENDER_SYMBOL: Record<string, string> = {
  male: '♂',
  female: '♀',
  genderless: '⚲',
};

interface OwnedPokemonListProps {
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function OwnedPokemonList({ onAdd, onEdit, onDuplicate }: OwnedPokemonListProps) {
  const ownedPokemon = useBreedingStore((s) => s.ownedPokemon);
  const removeOwnedPokemon = useBreedingStore((s) => s.removeOwnedPokemon);
  const features = useBreedingStore((s) => s.settings.features);
  const [criteria, setCriteria] = useState<OwnedFilterCriteria>(DEFAULT_CRITERIA);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filterOptions = useMemo(() => deriveFilterOptions(ownedPokemon), [ownedPokemon]);
  const filtered = filterAndSortOwned(ownedPokemon, criteria);

  const confirmingMon = confirmId ? ownedPokemon.find((m) => m.id === confirmId) : null;
  const confirmingName = confirmingMon
    ? (getSpeciesById(confirmingMon.speciesId)?.name ?? `#${confirmingMon.speciesId}`)
    : '';

  function handleConfirmDelete() {
    if (confirmId) {
      removeOwnedPokemon(confirmId);
      setConfirmId(null);
    }
  }

  if (ownedPokemon.length === 0) {
    return (
      <Center mt="xl">
        <Stack align="center" gap="md">
          <Text c="dimmed" ta="center">No Pokémon yet</Text>
          <Button onClick={onAdd} size="md">
            Add your first Pokémon
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <>
      <Modal
        opened={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title="Remove Pokémon"
        size="sm"
      >
        <Text size="sm" mb="md">
          Remove {confirmingName} from your collection? This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmId(null)}>Cancel</Button>
          <Button color="red" onClick={handleConfirmDelete}>Remove</Button>
        </Group>
      </Modal>

      <Stack gap="sm">
        <TextInput
          placeholder="Search by species name…"
          value={criteria.search}
          onChange={(e) => setCriteria((prev) => ({ ...prev, search: e.currentTarget.value }))}
          aria-label="Search Pokémon"
          style={{ maxWidth: 320 }}
        />

        <Group data-testid="owned-filter-bar" wrap="wrap" gap="sm">
          <Select
            aria-label="Filter by nature"
            placeholder="All natures"
            clearable
            value={criteria.nature}
            onChange={(v) => setCriteria((prev) => ({ ...prev, nature: v }))}
            data={filterOptions.natures}
          />
          <Select
            aria-label="Filter by ability"
            placeholder="All abilities"
            clearable
            value={criteria.ability}
            onChange={(v) => setCriteria((prev) => ({ ...prev, ability: v }))}
            data={filterOptions.abilities}
          />
          <Select
            aria-label="Filter by egg group"
            placeholder="All egg groups"
            clearable
            value={criteria.eggGroup}
            onChange={(v) => setCriteria((prev) => ({ ...prev, eggGroup: v }))}
            data={filterOptions.eggGroups}
          />
          <Select
            aria-label="Filter by gender"
            placeholder="All genders"
            clearable
            value={criteria.gender}
            onChange={(v) => setCriteria((prev) => ({ ...prev, gender: v as OwnedFilterCriteria['gender'] }))}
            data={filterOptions.genders.map((g) => ({
              value: g,
              label: g.charAt(0).toUpperCase() + g.slice(1),
            }))}
          />
          <Checkbox
            aria-label="Shiny only"
            label="Shiny only"
            checked={criteria.shinyOnly}
            onChange={(e) => setCriteria((prev) => ({ ...prev, shinyOnly: e.currentTarget.checked }))}
          />
          <Checkbox
            aria-label="Alpha only"
            label="Alpha only"
            checked={criteria.alphaOnly}
            onChange={(e) => setCriteria((prev) => ({ ...prev, alphaOnly: e.currentTarget.checked }))}
          />
          <Select
            aria-label="Sort by"
            value={criteria.sortKey}
            onChange={(v) => setCriteria((prev) => ({ ...prev, sortKey: (v ?? 'createdAt') as OwnedFilterCriteria['sortKey'] }))}
            data={[
              { value: 'createdAt', label: 'Date added' },
              { value: 'name', label: 'Species name' },
              { value: 'totalIVs', label: 'Total IVs' },
              { value: 'perfectIVs', label: 'Perfect IVs' },
            ]}
          />
          <ActionIcon
            aria-label="Sort direction"
            variant="subtle"
            onClick={() => setCriteria((prev) => ({ ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' }))}
          >
            {criteria.sortDir === 'asc' ? '↑' : '↓'}
          </ActionIcon>
        </Group>

        <Stack gap="xs">
          {filtered.length === 0 && (
            <Text c="dimmed" ta="center" mt="md">No Pokémon match your filters.</Text>
          )}
          {filtered.map((mon) => {
            const species = getSpeciesById(mon.speciesId);
            const name = species?.name ?? `#${mon.speciesId}`;
            const perfect = countPerfectIVs(mon.ivs);

            return (
              <Card key={mon.id} withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <PokemonAvatar speciesId={mon.speciesId} size="lg" />
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={600} size="sm">{name}</Text>
                        <Text size="sm" c="dimmed">{GENDER_SYMBOL[mon.gender]}</Text>
                        {mon.isShiny && features.shiny && (
                          <Badge size="xs" color="yellow">Shiny</Badge>
                        )}
                        {mon.isAlpha && features.alpha && (
                          <Badge size="xs" color="red">Alpha</Badge>
                        )}
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        <Text size="xs" c="dimmed">{formatIVs(mon.ivs)}</Text>
                        <Badge size="xs" variant="light" color="violet">
                          {perfect}×31
                        </Badge>
                      </Group>
                      <Group gap="xs" wrap="wrap">
                        <Text size="xs">{mon.nature}</Text>
                        <Text size="xs" c="dimmed">·</Text>
                        <Group gap={4}>
                          <Text size="xs">{mon.ability}</Text>
                          {mon.isHiddenAbility && (
                            <Badge size="xs" variant="dot" color="grape">Hidden</Badge>
                          )}
                        </Group>
                      </Group>
                    </Stack>
                  </Group>

                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Edit ${name}`}
                      onClick={() => onEdit(mon.id)}
                    >
                      ✏️
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Duplicate ${name}`}
                      onClick={() => onDuplicate(mon.id)}
                    >
                      ⧉
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${name}`}
                      onClick={() => setConfirmId(mon.id)}
                    >
                      🗑️
                    </ActionIcon>
                  </Group>
                </Group>
              </Card>
            );
          })}
        </Stack>
      </Stack>
    </>
  );
}
