import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Anchor,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  List,
  Modal,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Title,
  Paper,
  Box,
} from '@mantine/core';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { NATURES } from '../../data/natures';
import { buildPlan, validateManualPair } from '../../engine/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { IVInput } from '../../components/IVInput';
import {
  emptyIVs,
  formatIVs,
  allowedGenders,
  normalAbilities,
  hiddenAbility,
} from '../owned/ownedHelpers';
import {
  goalSummary,
  spentSoFar,
  progressPercent,
  STATUS_COLOR,
  STAT_LABELS,
  formatMoney,
  ITEM_LABELS,
  formatNatureLabel,
} from './projectHelpers';
import { BreedingPoolSection } from './BreedingPoolSection';
import type { Gender, IVs, StatKey, ItemKey } from '../../store/types';
import type { PairCandidate } from '../../engine/index';

// ─── Gender display ───────────────────────────────────────────────────────────

const GENDER_LABELS: Record<Gender, string> = {
  male: '♂ Male',
  female: '♀ Female',
  genderless: 'Genderless',
};

// ─── Status controls ──────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'abandoned', label: 'Abandoned' },
] as const;

// ─── Report-result modal state ────────────────────────────────────────────────

interface ReportModalState {
  opened: boolean;
  prefillParentAId: string | null;
  prefillParentBId: string | null;
  prefillCandidate: PairCandidate | null;
}

const CLOSED_MODAL: ReportModalState = {
  opened: false,
  prefillParentAId: null,
  prefillParentBId: null,
  prefillCandidate: null,
};

// ─── ReportResultModal ────────────────────────────────────────────────────────

interface ReportResultModalProps {
  state: ReportModalState;
  onClose: () => void;
  projectId: string;
  projectStatus: import('../../store/types').ProjectStatus;
  goal: import('../../store/types').BreedingGoal;
}

function ReportResultModal({
  state,
  onClose,
  projectId,
  projectStatus,
  goal,
}: ReportResultModalProps) {
  const ownedPokemon = useBreedingStore((s) => s.ownedPokemon);
  const settings = useBreedingStore((s) => s.settings);
  const addOwnedPokemon = useBreedingStore((s) => s.addOwnedPokemon);
  const removeOwnedPokemon = useBreedingStore((s) => s.removeOwnedPokemon);
  const addBreedStepResult = useBreedingStore((s) => s.addBreedStepResult);
  const setProjectStatus = useBreedingStore((s) => s.setProjectStatus);

  const [parentAId, setParentAId] = useState<string | null>(null);
  const [parentBId, setParentBId] = useState<string | null>(null);

  // Baby fields
  const [babyIVs, setBabyIVs] = useState<IVs>(emptyIVs());
  const [babyNature, setBabyNature] = useState<string>(NATURES[0]);
  const [babyAbility, setBabyAbility] = useState<string>('');
  const [babyIsHiddenAbility, setBabyIsHiddenAbility] = useState(false);
  const [babyGender, setBabyGender] = useState<Gender>('male');
  const [babyIsShiny, setBabyIsShiny] = useState(false);
  const [babyIsAlpha, setBabyIsAlpha] = useState(false);
  const [babyEggMoves, setBabyEggMoves] = useState<string[]>([]);

  // Pre-fill from recommendation when modal opens
  useEffect(() => {
    if (!state.opened) return;

    const prefillA = state.prefillParentAId ?? null;
    const prefillB = state.prefillParentBId ?? null;
    setParentAId(prefillA);
    setParentBId(prefillB);

    // Reset baby fields
    setBabyIsShiny(false);
    setBabyIsAlpha(false);
    setBabyEggMoves([]);

    // Pre-fill baby based on candidate if available
    const cand = state.prefillCandidate;
    if (cand) {
      const ivs = emptyIVs();
      for (const stat of cand.guaranteedTargetStats) {
        ivs[stat] = 31;
      }
      setBabyIVs(ivs);
      if (cand.prediction.nature?.value) {
        setBabyNature(cand.prediction.nature.value);
      } else {
        setBabyNature(NATURES[0]);
      }
      // ability pre-fill handled after we know the species
      if (cand.forcedGender) {
        setBabyGender(cand.forcedGender);
      }
    } else {
      setBabyIVs(emptyIVs());
      setBabyNature(NATURES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.opened]);

  // Validation (recalculated whenever parents change)
  const validation = useMemo(() => {
    if (!parentAId || !parentBId || parentAId === parentBId) return null;
    return validateManualPair(parentAId, parentBId, ownedPokemon, goal, settings, getSpeciesById);
  }, [parentAId, parentBId, ownedPokemon, goal, settings]);

  const candidate = validation?.candidate ?? null;
  const isValid = validation?.validation.valid ?? false;

  // Offspring species
  const offspringSpeciesId =
    candidate?.prediction.offspringSpeciesId ??
    validation?.validation.offspringSpeciesId ??
    null;
  const offspringSpecies = offspringSpeciesId != null ? getSpeciesById(offspringSpeciesId) : undefined;

  // Pre-fill ability when offspring species becomes known
  useEffect(() => {
    if (!offspringSpecies) return;
    const cand = state.prefillCandidate ?? candidate;
    const predAbility = cand?.prediction.ability?.value;
    if (predAbility) {
      setBabyAbility(predAbility);
      setBabyIsHiddenAbility(cand?.prediction.ability?.isHidden ?? false);
    } else {
      const firstNormal = normalAbilities(offspringSpecies)[0] ?? '';
      setBabyAbility(firstNormal);
      setBabyIsHiddenAbility(false);
    }

    // Pre-fill gender from allowed genders
    const allowed = allowedGenders(offspringSpecies);
    if (candidate?.forcedGender && allowed.includes(candidate.forcedGender)) {
      setBabyGender(candidate.forcedGender);
    } else if (!allowed.includes(babyGender)) {
      setBabyGender(allowed[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offspringSpeciesId]);

  // Ability options for baby
  const babyAbilityOptions = useMemo(() => {
    if (!offspringSpecies) return [];
    const normals = normalAbilities(offspringSpecies).map((n) => ({ value: n, label: n }));
    const ha = hiddenAbility(offspringSpecies);
    const haOpt =
      settings.features.hiddenAbility && ha ? [{ value: ha, label: `${ha} (Hidden)` }] : [];
    return [...normals, ...haOpt];
  }, [offspringSpecies, settings.features.hiddenAbility]);

  const babyGenderOptions = useMemo(() => {
    if (!offspringSpecies) return [{ value: 'male' as Gender, label: '♂ Male' }];
    return allowedGenders(offspringSpecies).map((g) => ({ value: g, label: GENDER_LABELS[g] }));
  }, [offspringSpecies]);

  const babyEggMovesOptions = offspringSpecies ? offspringSpecies.moves : [];

  function handleAbilityChange(val: string | null) {
    if (!val) return;
    const ha = offspringSpecies ? hiddenAbility(offspringSpecies) : undefined;
    setBabyAbility(val);
    setBabyIsHiddenAbility(ha === val);
  }

  // Parent select options
  const parentOptions = ownedPokemon.map((p) => {
    const sp = getSpeciesById(p.speciesId);
    const name = sp?.name ?? `#${p.speciesId}`;
    const label = `${name} — ${formatIVs(p.ivs)} — ${GENDER_LABELS[p.gender]}`;
    return { value: p.id, label };
  });

  const canSubmit =
    isValid &&
    parentAId !== null &&
    parentBId !== null &&
    parentAId !== parentBId &&
    offspringSpeciesId != null;

  function handleSubmit() {
    if (!canSubmit || !candidate || offspringSpeciesId == null || !parentAId || !parentBId) return;

    // 1. Create child FIRST (before consuming parents)
    const childId = addOwnedPokemon({
      speciesId: offspringSpeciesId,
      ivs: babyIVs,
      nature: babyNature,
      ability: babyAbility,
      isHiddenAbility: settings.features.hiddenAbility ? babyIsHiddenAbility : false,
      gender: babyGender,
      isShiny: settings.features.shiny ? babyIsShiny : false,
      isAlpha: settings.features.alpha ? babyIsAlpha : false,
      eggMoves: settings.features.eggMoves ? babyEggMoves : [],
    });

    // 2. Record the breed step (references the child id just created)
    addBreedStepResult(projectId, {
      parentAId,
      parentBId,
      heldItems: candidate.items as { a?: ItemKey; b?: ItemKey },
      forcedGender: candidate.forcedGender,
      resultPokemonId: childId,
      costSpent: candidate.estimatedStepCost,
    });

    // 3. Consume parents (after child + step are recorded)
    removeOwnedPokemon(parentAId);
    removeOwnedPokemon(parentBId);

    // 4. Promote status from planning → in-progress
    if (projectStatus === 'planning') {
      setProjectStatus(projectId, 'in-progress');
    }

    // 5. Close modal — plan recomputes reactively
    onClose();
  }

  const showSamePairWarning = parentAId !== null && parentAId === parentBId;

  return (
    <Modal
      opened={state.opened}
      onClose={onClose}
      title="Report Breed Result"
      size="lg"
    >
      <Stack gap="sm">
        {/* Parent selects */}
        <Select
          label="Parent A"
          data={parentOptions}
          value={parentAId}
          onChange={setParentAId}
          searchable
          placeholder="Select parent A"
          aria-label="Parent A"
        />
        <Select
          label="Parent B"
          data={parentOptions}
          value={parentBId}
          onChange={setParentBId}
          searchable
          placeholder="Select parent B"
          aria-label="Parent B"
        />

        {showSamePairWarning && (
          <Alert color="red" title="Invalid">
            Parent A and Parent B must be different.
          </Alert>
        )}

        {/* Validation feedback */}
        {parentAId && parentBId && !showSamePairWarning && validation && (
          <>
            {!isValid && (
              <Alert color="red" title="Incompatible pair">
                <List size="sm">
                  {validation.validation.reasons.map((r, i) => (
                    <List.Item key={i}>{r}</List.Item>
                  ))}
                </List>
              </Alert>
            )}
            {isValid && candidate && (
              <Paper withBorder p="xs" radius="sm" bg="var(--mantine-color-green-0)">
                <Text size="xs" fw={600} c="green" mb={4}>
                  Valid pair
                </Text>
                <Group gap="xs" wrap="wrap">
                  {candidate.items.a && (
                    <Badge variant="outline" size="sm">
                      A: {ITEM_LABELS[candidate.items.a]}
                    </Badge>
                  )}
                  {candidate.items.b && (
                    <Badge variant="outline" size="sm">
                      B: {ITEM_LABELS[candidate.items.b]}
                    </Badge>
                  )}
                  {candidate.forcedGender && (
                    <Badge variant="outline" size="sm" color="grape">
                      Child gender: {GENDER_LABELS[candidate.forcedGender]}
                    </Badge>
                  )}
                  <Badge variant="outline" size="sm" color="teal">
                    Est. cost: {formatMoney(candidate.estimatedStepCost)}
                  </Badge>
                </Group>
                {candidate.guaranteedTargetStats.length > 0 && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Guaranteed 31s:{' '}
                    {candidate.guaranteedTargetStats.map((s) => STAT_LABELS[s]).join(', ')}
                  </Text>
                )}
              </Paper>
            )}
          </>
        )}

        {/* Baby entry — only show when pair is valid and offspring species is known */}
        {isValid && offspringSpecies && (
          <>
            <Divider label="Baby Pokémon (your actual result)" labelPosition="center" />

            {/* Species read-only */}
            <Group gap="xs" align="center">
              <PokemonAvatar speciesId={offspringSpecies.id} size="md" showName />
              <Text size="xs" c="dimmed">(species is fixed by the pairing)</Text>
            </Group>

            {/* IVs */}
            <SimpleGrid cols={3} spacing="xs">
              {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as StatKey[]).map((stat) => (
                <IVInput
                  key={stat}
                  id={`baby-iv-${stat}`}
                  label={STAT_LABELS[stat]}
                  value={babyIVs[stat]}
                  onChange={(v) => setBabyIVs((prev) => ({ ...prev, [stat]: v }))}
                />
              ))}
            </SimpleGrid>

            {/* Nature */}
            <Select
              label="Nature"
              data={NATURES.map((n) => ({ value: n, label: formatNatureLabel(n) }))}
              value={babyNature}
              onChange={(val) => val && setBabyNature(val)}
              searchable
              aria-label="Baby nature"
            />

            {/* Ability */}
            <Select
              label="Ability"
              data={babyAbilityOptions}
              value={babyAbility}
              onChange={handleAbilityChange}
              disabled={babyAbilityOptions.length === 0}
              aria-label="Baby ability"
            />

            {/* Gender */}
            <Select
              label="Gender"
              data={babyGenderOptions}
              value={babyGender}
              onChange={(val) => val && setBabyGender(val as Gender)}
              aria-label="Baby gender"
            />

            {/* Progressive disclosure */}
            {settings.features.shiny && (
              <Checkbox
                label="Shiny"
                checked={babyIsShiny}
                onChange={(e) => setBabyIsShiny(e.currentTarget.checked)}
              />
            )}
            {settings.features.alpha && (
              <Checkbox
                label="Alpha"
                checked={babyIsAlpha}
                onChange={(e) => setBabyIsAlpha(e.currentTarget.checked)}
              />
            )}
            {settings.features.eggMoves && babyEggMovesOptions.length > 0 && (
              <TagsInput
                label="Egg Moves (inherited)"
                data={babyEggMovesOptions}
                value={babyEggMoves}
                onChange={setBabyEggMoves}
                aria-label="Baby egg moves"
              />
            )}
          </>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            title={!canSubmit ? 'Select a valid pair first' : undefined}
          >
            Submit Result
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Store selectors
  const getProjectById = useBreedingStore((s) => s.getProjectById);
  const setProjectStatus = useBreedingStore((s) => s.setProjectStatus);
  const getOwnedById = useBreedingStore((s) => s.getOwnedById);
  const ownedPokemon = useBreedingStore((s) => s.ownedPokemon);
  const settings = useBreedingStore((s) => s.settings);
  const projects = useBreedingStore((s) => s.projects);

  // Derive project from reactive projects list (so it updates after status changes etc.)
  const project = useMemo(
    () => (id ? getProjectById(id) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, projects],
  );

  // Modal state
  const [modalState, setModalState] = useState<ReportModalState>(CLOSED_MODAL);

  // Compute plan reactively
  const plan = useMemo(
    () => (project ? buildPlan(ownedPokemon, project.goal, settings, getSpeciesById) : null),
    [ownedPokemon, project, settings],
  );

  if (!project || !plan) {
    return (
      <>
        <Text c="dimmed">Project not found.</Text>
        <Anchor component={Link} to="/projects" mt="sm" display="block">
          ← Back to Projects
        </Anchor>
      </>
    );
  }

  const species = getSpeciesById(project.goal.speciesId);
  const spent = spentSoFar(project);
  const totalBreeds = plan.estimate.totalBreeds;
  const percent = progressPercent(project, totalBreeds);
  const delta = spent - plan.estimate.cost.total;

  function openReportModal(prefillFromRecommendation = false) {
    const rec = prefillFromRecommendation && plan?.recommendation ? plan.recommendation : null;
    setModalState({
      opened: true,
      prefillParentAId: rec?.pair.parentAId ?? null,
      prefillParentBId: rec?.pair.parentBId ?? null,
      prefillCandidate: rec?.pair ?? null,
    });
  }

  function closeModal() {
    setModalState(CLOSED_MODAL);
  }

  // ── Cumulative cost for progress timeline
  let cumulative = 0;

  return (
    <>
      {/* ── Header ── */}
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Anchor component={Link} to="/projects" size="sm">
          ← Back to Projects
        </Anchor>
        <Select
          size="xs"
          data={STATUS_OPTIONS}
          value={project.status}
          onChange={(val) => val && setProjectStatus(project.id, val as import('../../store/types').ProjectStatus)}
          aria-label="Project status"
          style={{ minWidth: 140 }}
        />
      </Group>

      <Group gap="sm" mb="xs" align="flex-start" wrap="wrap">
        {species && <PokemonAvatar speciesId={species.id} size="lg" />}
        <Box style={{ flex: 1 }}>
          <Group gap="xs" align="center" wrap="wrap">
            <Title order={2}>{project.name}</Title>
            <Badge color={STATUS_COLOR[project.status]} variant="light">
              {project.status}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {goalSummary(project.goal)}
          </Text>
        </Box>
      </Group>

      <Group gap="xs" mb="md">
        {project.status !== 'done' && (
          <Button size="xs" color="green" variant="light" onClick={() => setProjectStatus(project.id, 'done')}>
            Mark Done
          </Button>
        )}
        {project.status !== 'abandoned' && (
          <Button size="xs" color="red" variant="light" onClick={() => setProjectStatus(project.id, 'abandoned')}>
            Abandon
          </Button>
        )}
        <Button
          size="xs"
          onClick={() => openReportModal(false)}
          variant="default"
        >
          Report Breed Result
        </Button>
      </Group>

      <Stack gap="md">
        {/* ── 2. Goal achieved banner ── */}
        {plan.done && plan.matchingPokemonId && (() => {
          const match = getOwnedById(plan.matchingPokemonId);
          return (
            <Alert color="green" title="Goal achieved!">
              <Group gap="sm" align="center">
                {match && <PokemonAvatar speciesId={match.speciesId} size="md" showName />}
                {match && (
                  <Text size="sm">
                    {formatIVs(match.ivs)} · {match.nature} · {GENDER_LABELS[match.gender]}
                  </Text>
                )}
              </Group>
              {project.status !== 'done' && (
                <Text size="xs" c="dimmed" mt={4}>
                  Consider marking this project as "Done".
                </Text>
              )}
            </Alert>
          );
        })()}

        {/* ── 3. Recommendation card ── */}
        {!plan.done && (
          <Card withBorder radius="md" padding="md">
            <Title order={4} mb="sm">
              Next Recommended Breed
            </Title>
            {plan.recommendation ? (() => {
              const rec = plan.recommendation;
              const parentA = getOwnedById(rec.pair.parentAId);
              const parentB = getOwnedById(rec.pair.parentBId);
              const offSp = getSpeciesById(rec.pair.prediction.offspringSpeciesId);
              return (
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                    {/* Parent A */}
                    <Paper withBorder p="sm" radius="sm">
                      <Text size="xs" fw={600} c="dimmed" mb={4}>Parent A</Text>
                      {parentA ? (
                        <>
                          <Group gap="xs">
                            <PokemonAvatar speciesId={parentA.speciesId} size="md" showName />
                          </Group>
                          <Text size="xs" c="dimmed">{formatIVs(parentA.ivs)}</Text>
                          <Text size="xs" c="dimmed">
                            {parentA.nature} · {GENDER_LABELS[parentA.gender]}
                            {parentA.isHiddenAbility ? ' · HA' : ''}
                          </Text>
                          {rec.pair.items.a && (
                            <Badge size="xs" variant="dot" mt={4}>
                              {ITEM_LABELS[rec.pair.items.a]}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Text size="xs" c="dimmed">Unknown</Text>
                      )}
                    </Paper>

                    {/* Parent B */}
                    <Paper withBorder p="sm" radius="sm">
                      <Text size="xs" fw={600} c="dimmed" mb={4}>Parent B</Text>
                      {parentB ? (
                        <>
                          <Group gap="xs">
                            <PokemonAvatar speciesId={parentB.speciesId} size="md" showName />
                          </Group>
                          <Text size="xs" c="dimmed">{formatIVs(parentB.ivs)}</Text>
                          <Text size="xs" c="dimmed">
                            {parentB.nature} · {GENDER_LABELS[parentB.gender]}
                            {parentB.isHiddenAbility ? ' · HA' : ''}
                          </Text>
                          {rec.pair.items.b && (
                            <Badge size="xs" variant="dot" mt={4}>
                              {ITEM_LABELS[rec.pair.items.b]}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Text size="xs" c="dimmed">Unknown</Text>
                      )}
                    </Paper>
                  </SimpleGrid>

                  {/* Breed details */}
                  <Group gap="xs" wrap="wrap">
                    {rec.pair.forcedGender && (
                      <Badge size="sm" color="grape" variant="light">
                        Force child: {GENDER_LABELS[rec.pair.forcedGender]}
                      </Badge>
                    )}
                    {rec.pair.guaranteedTargetStats.map((s) => (
                      <Badge key={s} size="sm" color="teal" variant="light">
                        31 {STAT_LABELS[s]} guaranteed
                      </Badge>
                    ))}
                    <Badge size="sm" color="violet" variant="light">
                      Est. {formatMoney(rec.pair.estimatedStepCost)}
                    </Badge>
                  </Group>

                  {/* Offspring preview */}
                  {offSp && (
                    <Group gap="xs" align="center">
                      <Text size="xs" fw={500}>Predicted offspring:</Text>
                      <PokemonAvatar speciesId={offSp.id} size="sm" showName />
                      {rec.pair.prediction.nature && (
                        <Text size="xs" c="dimmed">
                          {(rec.pair.prediction.nature.chance * 100).toFixed(0)}% {rec.pair.prediction.nature.value}
                        </Text>
                      )}
                      {rec.pair.prediction.ability && (
                        <Text size="xs" c="dimmed">
                          {(rec.pair.prediction.ability.chance * 100).toFixed(0)}% {rec.pair.prediction.ability.value}
                          {rec.pair.prediction.ability.isHidden ? ' (HA)' : ''}
                        </Text>
                      )}
                    </Group>
                  )}

                  {/* Alternatives */}
                  {(rec.alternativesForA.length > 0 || rec.alternativesForB.length > 0) && (
                    <Box>
                      <Text size="xs" fw={500} mb={4}>Alternatives</Text>
                      {rec.alternativesForA.length > 0 && (
                        <Group gap={4} mb={2}>
                          <Text size="xs" c="dimmed">For A:</Text>
                          {rec.alternativesForA.map((altId) => {
                            const alt = getOwnedById(altId);
                            return alt ? (
                              <PokemonAvatar key={altId} speciesId={alt.speciesId} size="sm" />
                            ) : null;
                          })}
                        </Group>
                      )}
                      {rec.alternativesForB.length > 0 && (
                        <Group gap={4}>
                          <Text size="xs" c="dimmed">For B:</Text>
                          {rec.alternativesForB.map((altId) => {
                            const alt = getOwnedById(altId);
                            return alt ? (
                              <PokemonAvatar key={altId} speciesId={alt.speciesId} size="sm" />
                            ) : null;
                          })}
                        </Group>
                      )}
                    </Box>
                  )}

                  {/* Warnings */}
                  {rec.warnings.length > 0 && (
                    <Alert color="yellow" title="Notes" variant="light">
                      <List size="xs">
                        {rec.warnings.map((w, i) => (
                          <List.Item key={i}>{w}</List.Item>
                        ))}
                      </List>
                    </Alert>
                  )}

                  <Button onClick={() => openReportModal(true)}>
                    Report this breed
                  </Button>
                </Stack>
              );
            })() : (
              <Alert color="blue" title="No recommendation available" variant="light">
                <Text size="sm">
                  Not enough compatible Pokémon to form a productive pair. Check the{' '}
                  <Text component="span" fw={600}>Gaps</Text> section below to see what you still need.
                </Text>
              </Alert>
            )}
          </Card>
        )}

        <BreedingPoolSection goal={project.goal} ownedPokemon={ownedPokemon} />

        {/* ── 4. Estimate & cost card ── */}
        <Card withBorder radius="md" padding="md">
          <Title order={4} mb="sm">
            Cost Estimate
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="sm">
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Total breeds (est.)</Text>
              <Text fw={600}>{plan.estimate.totalBreeds}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Base mons needed</Text>
              <Text fw={600}>{plan.estimate.baseMonsNeeded}</Text>
            </Stack>
          </SimpleGrid>

          <Divider mb="sm" />

          <Stack gap={4} mb="sm">
            {(
              [
                ['Power items', plan.estimate.cost.powerItems],
                ['Everstone', plan.estimate.cost.everstone],
                ['Gender fees', plan.estimate.cost.genderFees],
                ['Ditto', plan.estimate.cost.ditto],
                ['Ability pill', plan.estimate.cost.abilityPill],
              ] as [string, number][]
            ).map(([label, val]) => (
              <Group key={label} justify="space-between">
                <Text size="sm" c="dimmed">{label}</Text>
                <Text size="sm">{formatMoney(val)}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={700}>Estimated total</Text>
              <Text size="sm" fw={700}>{formatMoney(plan.estimate.cost.total)}</Text>
            </Group>
          </Stack>

          {/* Spent vs estimate */}
          <Paper withBorder p="xs" radius="sm" mb="sm">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">Spent so far</Text>
              <Text size="xs" fw={600}>{formatMoney(spent)}</Text>
            </Group>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">Estimate</Text>
              <Text size="xs">{formatMoney(plan.estimate.cost.total)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Delta</Text>
              <Text size="xs" fw={600} c={delta > 0 ? 'red' : 'green'}>
                {delta >= 0 ? '+' : ''}{formatMoney(delta)}
              </Text>
            </Group>
            <Progress
              value={Math.min(100, plan.estimate.cost.total > 0 ? (spent / plan.estimate.cost.total) * 100 : 0)}
              size="xs"
              mt={6}
              aria-label={`Spend progress: ${percent}%`}
            />
          </Paper>

          {plan.estimate.assumptions.length > 0 && (
            <>
              <Text size="xs" c="dimmed" fw={500} mb={2}>Assumptions</Text>
              <List size="xs" c="dimmed">
                {plan.estimate.assumptions.map((a, i) => (
                  <List.Item key={i}>{a}</List.Item>
                ))}
              </List>
            </>
          )}
        </Card>

        {/* ── 5. Gaps card ── */}
        <Card withBorder radius="md" padding="md">
          <Title order={4} mb="sm">
            Gaps — Pokémon You Still Need
          </Title>
          {plan.gaps.length === 0 ? (
            <Alert color="green" variant="light">
              No gaps — you have carriers for every target attribute.
            </Alert>
          ) : (
            <List size="sm" spacing="xs">
              {plan.gaps.map((gap, i) => (
                <List.Item key={i}>{gap.description}</List.Item>
              ))}
            </List>
          )}
        </Card>

        {/* ── 6. Progress timeline ── */}
        <Card withBorder radius="md" padding="md">
          <Title order={4} mb="sm">
            Progress Timeline (oldest → newest)
          </Title>
          {project.progress.length === 0 ? (
            <Text size="sm" c="dimmed">No breeds reported yet.</Text>
          ) : (
            <Stack gap="sm">
              {project.progress.map((step, idx) => {
                cumulative += step.costSpent;
                const child = getOwnedById(step.resultPokemonId);
                return (
                  <Paper key={step.id} withBorder p="sm" radius="sm">
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Group gap="xs" align="center">
                        <Text size="xs" c="dimmed" fw={500}>#{idx + 1}</Text>
                        {child ? (
                          <>
                            <PokemonAvatar speciesId={child.speciesId} size="md" showName />
                            <Text size="xs" c="dimmed">{formatIVs(child.ivs)}</Text>
                            <Text size="xs" c="dimmed">
                              {child.nature} · {GENDER_LABELS[child.gender]}
                            </Text>
                          </>
                        ) : (
                          <Text size="xs" c="dimmed" fs="italic">consumed</Text>
                        )}
                      </Group>
                      <Stack gap={0} align="flex-end">
                        <Text size="xs" fw={600}>{formatMoney(step.costSpent)}</Text>
                        <Text size="xs" c="dimmed">cumul. {formatMoney(cumulative)}</Text>
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Card>
      </Stack>

      {/* ── 7. Report-result modal ── */}
      <ReportResultModal
        state={modalState}
        onClose={closeModal}
        projectId={project.id}
        projectStatus={project.status}
        goal={project.goal}
      />
    </>
  );
}
