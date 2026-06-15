import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBreedingStore } from '../../../store/index';
import { getSpeciesById } from '../../../data/index';
import { formatIVs } from '../ownedHelpers';
import { PokemonAvatar } from '../../../components/PokemonAvatar';
import { parseDelimited } from './parseCsv';
import { validateRows, type ValidateResult } from './validateRows';

interface BulkImportModalProps {
  opened: boolean;
  onClose: () => void;
}

const TEMPLATE = 'species,ivs,nature,ability,gender,shiny,alpha,eggMoves,notes';

export function BulkImportModal({ opened, onClose }: BulkImportModalProps) {
  const addOwnedPokemon = useBreedingStore((s) => s.addOwnedPokemon);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ValidateResult | null>(null);

  const reset = () => {
    setText('');
    setResult(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const runParse = (value: string) => {
    setText(value);
    setResult(value.trim() === '' ? null : validateRows(parseDelimited(value)));
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    file
      .text()
      .then((content) => runParse(content))
      .catch(() => setResult({ rows: [], unknownColumns: [], headerError: 'Could not read that file.' }));
  };

  const allValid =
    result !== null &&
    !result.headerError &&
    result.rows.length > 0 &&
    result.rows.every((r) => r.ok);

  const handleCommit = () => {
    if (!result || !allValid) return;
    let count = 0;
    for (const row of result.rows) {
      if (row.ok) {
        addOwnedPokemon(row.value);
        count++;
      }
    }
    notifications.show({ message: `Added ${count} Pokémon`, color: 'green' });
    handleClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Bulk add Pokémon" size="xl">
      <Stack>
        <Text size="sm" c="dimmed">
          Paste rows (CSV or tab-separated) or upload a file. A header row is required; only{' '}
          <code>species</code> (or <code>dexId</code>) is mandatory. Columns: {TEMPLATE}.
        </Text>

        <Textarea
          data-testid="bulk-import-textarea"
          aria-label="Bulk import data"
          autosize
          minRows={6}
          placeholder={TEMPLATE}
          value={text}
          onChange={(e) => runParse(e.currentTarget.value)}
        />

        <Group>
          <FileButton onChange={handleFile} accept=".csv,.tsv,.txt">
            {(props) => (
              <Button {...props} variant="default" data-testid="bulk-import-file">
                Upload file
              </Button>
            )}
          </FileButton>
        </Group>

        {result?.headerError && (
          <Alert color="red" data-testid="bulk-import-header-error">
            {result.headerError}
          </Alert>
        )}

        {result && result.unknownColumns.length > 0 && (
          <Alert color="yellow">Ignored unknown columns: {result.unknownColumns.join(', ')}</Alert>
        )}

        {result && !result.headerError && result.rows.length > 0 && (
          <Table striped withTableBorder data-testid="bulk-import-preview">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Pokémon</Table.Th>
                <Table.Th>Details</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.rows.map((row, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td>
                    {row.ok ? (
                      <Group gap="xs" wrap="nowrap">
                        <PokemonAvatar speciesId={row.value.speciesId} size="sm" />
                        <Text size="sm">{getSpeciesById(row.value.speciesId)?.name}</Text>
                      </Group>
                    ) : row.raw.join(' | ')}
                  </Table.Td>
                  <Table.Td>
                    {row.ok ? (
                      <Text size="xs">
                        {row.value.nature} · {row.value.gender} · {row.value.ability} ·{' '}
                        {formatIVs(row.value.ivs)}
                        {row.value.isShiny ? ' · shiny' : ''}
                        {row.value.isAlpha ? ' · alpha' : ''}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    {row.ok ? (
                      <Badge color="green">OK</Badge>
                    ) : (
                      <Stack gap={2} data-testid="bulk-import-row-error">
                        {row.errors.map((e, j) => (
                          <Badge key={j} color="red">
                            {e.field}: {e.message}
                          </Badge>
                        ))}
                        {row.suggestion && (
                          <Text size="xs" c="dimmed">
                            Did you mean {row.suggestion}?
                          </Text>
                        )}
                      </Stack>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            data-testid="bulk-import-commit"
            disabled={!allValid}
            onClick={handleCommit}
          >
            {allValid ? `Add ${result!.rows.length} Pokémon` : 'Add Pokémon'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
