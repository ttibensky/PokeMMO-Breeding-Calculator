import { useState } from 'react';
import { Title, Button, Group } from '@mantine/core';
import { OwnedPokemonList } from './OwnedPokemonList';
import { OwnedPokemonForm } from './OwnedPokemonForm';

export function OwnedPage() {
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [duplicateFromId, setDuplicateFromId] = useState<string | undefined>(undefined);

  function handleAdd() {
    setEditingId(undefined);
    setDuplicateFromId(undefined);
    setFormOpened(true);
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setDuplicateFromId(undefined);
    setFormOpened(true);
  }

  function handleDuplicate(id: string) {
    setEditingId(undefined);
    setDuplicateFromId(id);
    setFormOpened(true);
  }

  function handleClose() {
    setFormOpened(false);
    setEditingId(undefined);
    setDuplicateFromId(undefined);
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={1}>Owned Pokémon</Title>
        <Button onClick={handleAdd}>Add Pokémon</Button>
      </Group>

      <OwnedPokemonList onAdd={handleAdd} onEdit={handleEdit} onDuplicate={handleDuplicate} />

      <OwnedPokemonForm
        opened={formOpened}
        onClose={handleClose}
        editingId={editingId}
        duplicateFromId={duplicateFromId}
      />
    </>
  );
}
