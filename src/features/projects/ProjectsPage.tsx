import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Title,
  Button,
  Group,
  Text,
  SimpleGrid,
  Card,
  Badge,
  Progress,
  Stack,
  ActionIcon,
  Tooltip,
  Center,
} from '@mantine/core';
import { useBreedingStore } from '../../store/index';
import { getSpeciesById } from '../../data/index';
import { estimateGoal } from '../../engine/index';
import { PokemonAvatar } from '../../components/PokemonAvatar';
import { GoalForm } from './GoalForm';
import {
  goalSummary,
  STATUS_COLOR,
  progressPercent,
  spentSoFar,
} from './projectHelpers';
import type { BreedingProject } from '../../store/types';

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: BreedingProject;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const settings = useBreedingStore((s) => s.settings);
  const estimate = estimateGoal(project.goal, settings, getSpeciesById);
  const percent = progressPercent(project, estimate.totalBreeds);
  const spent = spentSoFar(project);

  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      shadow="sm"
      data-testid="project-card"
      style={{ position: 'relative', cursor: 'pointer' }}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="xs" style={{ minWidth: 0 }}>
            <PokemonAvatar speciesId={project.goal.speciesId} size={36} />
            <Text
              component={Link}
              to={`/projects/${project.id}`}
              fw={600}
              size="sm"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {project.name}
              {/* Stretched-link overlay: expands this link's hit area to the whole card.
                  Its containing block is the relatively-positioned Card, so it is not
                  clipped by this link's overflow:hidden. */}
              <span
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, zIndex: 1 }}
              />
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
            <Tooltip label="Edit">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => onEdit(project.id)}
                aria-label={`Edit ${project.name}`}
              >
                ✏️
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => onDelete(project.id)}
                aria-label={`Delete ${project.name}`}
              >
                🗑️
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Text size="xs" c="dimmed">
          {goalSummary(project.goal)}
        </Text>

        <Group justify="space-between" align="center">
          <Badge
            color={STATUS_COLOR[project.status]}
            variant="light"
            size="sm"
          >
            {project.status}
          </Badge>
          <Text size="xs" c="dimmed">
            ${spent.toLocaleString()} / ~${estimate.cost.total.toLocaleString()}
          </Text>
        </Group>

        <Progress
          value={percent}
          size="xs"
          radius="xl"
          aria-label={`Progress: ${percent}%`}
        />
        <Text size="xs" c="dimmed" ta="right">
          {percent}% · {estimate.totalBreeds} breeds est.
        </Text>
      </Stack>
    </Card>
  );
}

export function ProjectsPage() {
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const projects = useBreedingStore((s) => s.projects);
  const removeProject = useBreedingStore((s) => s.removeProject);

  function handleNew() {
    setEditingId(undefined);
    setFormOpened(true);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setFormOpened(true);
  }

  function handleDelete(id: string) {
    const project = projects.find((p) => p.id === id);
    const name = project?.name ?? 'this project';
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      removeProject(id);
    }
  }

  function handleClose() {
    setFormOpened(false);
    setEditingId(undefined);
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={1}>Projects</Title>
        <Button onClick={handleNew}>New Project</Button>
      </Group>

      {projects.length === 0 ? (
        <Center mt="xl">
          <Stack align="center" gap="sm">
            <Text c="dimmed" size="lg">
              No breeding projects yet.
            </Text>
            <Text c="dimmed" size="sm">
              Create your first project to start tracking a breeding goal.
            </Text>
            <Button mt="xs" onClick={handleNew}>
              Create your first project
            </Button>
          </Stack>
        </Center>
      ) : (
        <SimpleGrid
          cols={{ base: 1, sm: 2, md: 3 }}
          spacing="md"
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </SimpleGrid>
      )}

      <GoalForm
        opened={formOpened}
        onClose={handleClose}
        editingId={editingId}
      />
    </>
  );
}
