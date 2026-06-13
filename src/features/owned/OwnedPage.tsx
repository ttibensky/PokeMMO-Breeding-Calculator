import { useState, useEffect, useRef } from 'react';
import { Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OwnedPokemonList } from './OwnedPokemonList';
import { OwnedPokemonForm } from './OwnedPokemonForm';

export function OwnedPage() {
  const [formOpened, setFormOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [duplicateFromId, setDuplicateFromId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnToRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      returnToRef.current = searchParams.get('returnTo');
      setEditingId(undefined);
      setFormOpened(true);
    }
  }, [searchParams]);

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

  function handleClose(didSubmit?: boolean) {
    const wasAdd = editingId === undefined;
    setFormOpened(false);
    setEditingId(undefined);
    setDuplicateFromId(undefined);

    if (didSubmit && wasAdd) {
      notifications.show({ message: 'Pokémon added', color: 'green' });
    }

    const returnTo = returnToRef.current;
    returnToRef.current = null;
    if (returnTo) {
      navigate(returnTo, { replace: true });
    } else if (searchParams.get('add')) {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <>
      <Title order={1} mb="md">Owned Pokémon</Title>

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
