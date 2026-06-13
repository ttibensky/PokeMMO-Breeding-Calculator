import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { getSpeciesById } from '../data/index';

interface PokemonAvatarProps {
  speciesId: number;
  size?: number;
  showName?: boolean;
}

export function PokemonAvatar({ speciesId, size = 40, showName = false }: PokemonAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const species = getSpeciesById(speciesId);

  if (!species) {
    return (
      <Box
        style={{
          width: size,
          height: size,
          backgroundColor: 'var(--mantine-color-gray-2)',
          borderRadius: 4,
          display: 'inline-block',
        }}
        aria-label="Unknown Pokémon"
      />
    );
  }

  return (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {imgError ? (
        <Box
          style={{
            width: size,
            height: size,
            backgroundColor: 'var(--mantine-color-gray-2)',
            borderRadius: 4,
            flexShrink: 0,
          }}
          aria-label={species.name}
        />
      ) : (
        <img
          src={species.spriteUrl}
          alt={species.name}
          width={size}
          height={size}
          loading="lazy"
          style={{ imageRendering: 'pixelated', flexShrink: 0 }}
          onError={() => setImgError(true)}
        />
      )}
      {showName && <Text size="sm">{species.name}</Text>}
    </Box>
  );
}
