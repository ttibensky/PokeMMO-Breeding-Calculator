import { useState } from 'react';
import { Box, Text } from '@mantine/core';
import { getSpeciesById } from '../data/index';

const AVATAR_SIZES = { sm: 56, md: 80, lg: 120 } as const;
type AvatarSize = keyof typeof AVATAR_SIZES;

interface PokemonAvatarProps {
  speciesId: number;
  size?: AvatarSize;
  showName?: boolean;
}

export function PokemonAvatar({ speciesId, size = 'md', showName = false }: PokemonAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const species = getSpeciesById(speciesId);
  const px = AVATAR_SIZES[size];

  if (!species) {
    return (
      <Box
        style={{
          width: px,
          height: px,
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
            width: px,
            height: px,
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
          width={px}
          height={px}
          loading="lazy"
          style={{ imageRendering: 'pixelated', flexShrink: 0 }}
          onError={() => setImgError(true)}
        />
      )}
      {showName && <Text size="sm">{species.name}</Text>}
    </Box>
  );
}
