import { useState } from 'react';
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
} from '@mantine/core';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { countPerfectIVs, formatIVs } from './ownedHelpers';

const GENDER_SYMBOL: Record<string, string> = {
  male: '♂',
  female: '♀',
  genderless: '⚲',
};

interface OwnedPokemonListProps {
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export function OwnedPokemonList({ onAdd, onEdit }: OwnedPokemonListProps) {
  const ownedPokemon = useBreedingStore((s) => s.ownedPokemon);
  const removeOwnedPokemon = useBreedingStore((s) => s.removeOwnedPokemon);
  const features = useBreedingStore((s) => s.settings.features);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = ownedPokemon.filter((mon) => {
    if (!search) return true;
    const species = getSpeciesById(mon.speciesId);
    if (!species) return false;
    return species.name.toLowerCase().includes(search.toLowerCase());
  });

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
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          aria-label="Search Pokémon"
          style={{ maxWidth: 320 }}
        />

        <Stack gap="xs">
          {filtered.length === 0 && (
            <Text c="dimmed" ta="center" mt="md">No Pokémon match your search.</Text>
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
