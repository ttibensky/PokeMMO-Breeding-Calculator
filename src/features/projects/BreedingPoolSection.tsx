import { useMemo, useState } from 'react';
import { Card, Title, Stack, Group, Text, Badge, Button, TextInput } from '@mantine/core';
import type { BreedingGoal, OwnedPokemon } from '../../store/types';
import type { Attribute } from '../../engine/types';
import { getSpeciesById, allSpecies } from '../../data/index';
import { computeCoverage, getCompatibleSpecies } from '../../engine/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { STAT_LABELS } from './projectHelpers';

interface BreedingPoolSectionProps {
  goal: BreedingGoal;
  ownedPokemon: OwnedPokemon[];
}

function attributeLabel(attr: Attribute): string {
  return attr.kind === 'iv' ? `${STAT_LABELS[attr.stat]} 31` : attr.nature;
}

export function BreedingPoolSection({ goal, ownedPokemon }: BreedingPoolSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const coverage = useMemo(
    () => computeCoverage(goal, ownedPokemon, getSpeciesById),
    [goal, ownedPokemon],
  );
  const pool = useMemo(
    () => getCompatibleSpecies(goal.speciesId, getSpeciesById, allSpecies),
    [goal.speciesId],
  );
  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pool.filter((s) => s.name.toLowerCase().includes(q)) : pool;
  }, [pool, search]);

  return (
    <Card withBorder radius="md" padding="md">
      <Title order={4} mb="sm">
        Breeding Pool
      </Title>

      <Stack gap="xs">
        {coverage.length === 0 && (
          <Text size="sm" c="dimmed">
            This goal has no target IVs or nature set.
          </Text>
        )}
        {coverage.map((cov) => (
          <Group key={attributeLabel(cov.attribute)} gap="xs" wrap="wrap">
            <Text size="sm" fw={600} w={70}>
              {attributeLabel(cov.attribute)}
            </Text>
            {cov.isGap ? (
              <Badge color="orange" variant="light">
                Gap — acquire a male/Ditto carrier
              </Badge>
            ) : (
              cov.carriers.map((mon) => (
                <PokemonAvatar key={mon.id} speciesId={mon.speciesId} size={24} showName />
              ))
            )}
          </Group>
        ))}
      </Stack>

      <Button variant="subtle" size="xs" mt="sm" onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▼' : '▶'} Compatible species ({pool.length})
      </Button>

      {expanded && (
        <Stack gap="xs" mt="xs">
          {pool.length === 0 ? (
            <Text size="sm" c="dimmed">
              This species cannot be bred (no compatible egg group).
            </Text>
          ) : (
            <>
              <Text size="xs" c="dimmed">
                Contributors should be male or Ditto — your female parent stays the target species.
              </Text>
              <TextInput
                placeholder="Search by species name…"
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                aria-label="Search compatible species"
                style={{ maxWidth: 320 }}
              />
              <Group gap="sm" wrap="wrap">
                {filteredPool.map((s) => (
                  <Group key={s.id} gap={4} wrap="nowrap">
                    <PokemonAvatar speciesId={s.id} size={28} showName />
                    {s.eggGroups.map((g) => (
                      <Badge key={g} size="xs" variant="outline" color="gray">
                        {g}
                      </Badge>
                    ))}
                  </Group>
                ))}
              </Group>
            </>
          )}
        </Stack>
      )}
    </Card>
  );
}
