import type { OwnedPokemon } from '../store/types';
import type { PokemonSpecies } from '../data/types';
import type { ValidationResult } from './types';

const DITTO_ID = 132;

function isDitto(speciesId: number): boolean {
  return speciesId === DITTO_ID;
}

function hasEggGroup(species: PokemonSpecies, group: string): boolean {
  return species.eggGroups.includes(group);
}

function sharedEggGroup(a: PokemonSpecies, b: PokemonSpecies): boolean {
  return a.eggGroups.some((g) => b.eggGroups.includes(g));
}

/**
 * Validate whether two OwnedPokémon can legally breed together.
 * Accumulates ALL violation reasons before returning.
 * Implements mechanics §1 and §8.
 */
export function validatePair(
  a: OwnedPokemon,
  b: OwnedPokemon,
  getSpecies: (id: number) => PokemonSpecies | undefined,
): ValidationResult {
  const reasons: string[] = [];

  const speciesA = getSpecies(a.speciesId);
  const speciesB = getSpecies(b.speciesId);

  if (!speciesA || !speciesB) {
    const missing = [!speciesA && `#${a.speciesId}`, !speciesB && `#${b.speciesId}`]
      .filter(Boolean)
      .join(', ');
    return { valid: false, reasons: [`Unknown species: ${missing}`] };
  }

  const aIsDitto = isDitto(a.speciesId);
  const bIsDitto = isDitto(b.speciesId);

  // No-eggs group: cannot breed at all
  if (hasEggGroup(speciesA, 'no-eggs')) {
    reasons.push(`${speciesA.name} is in the no-eggs group and cannot breed`);
  }
  if (hasEggGroup(speciesB, 'no-eggs')) {
    reasons.push(`${speciesB.name} is in the no-eggs group and cannot breed`);
  }

  // Two Dittos cannot breed
  if (aIsDitto && bIsDitto) {
    reasons.push('Two Ditto cannot breed with each other');
  }

  // Genderless non-Ditto can only breed with Ditto
  const aIsGenderless = speciesA.isGenderless && !aIsDitto;
  const bIsGenderless = speciesB.isGenderless && !bIsDitto;

  if (aIsGenderless && !bIsDitto) {
    reasons.push(`${speciesA.name} is genderless and can only breed with Ditto`);
  }
  if (bIsGenderless && !aIsDitto) {
    reasons.push(`${speciesB.name} is genderless and can only breed with Ditto`);
  }

  // Egg group check — Ditto bypasses egg-group matching
  if (!aIsDitto && !bIsDitto && !sharedEggGroup(speciesA, speciesB)) {
    reasons.push(
      `${speciesA.name} and ${speciesB.name} share no egg groups`,
    );
  }

  // Gender check — require opposite genders unless Ditto is involved
  if (!aIsDitto && !bIsDitto) {
    if (a.gender === b.gender) {
      reasons.push(
        `Both Pokémon are ${a.gender}; opposite genders required`,
      );
    } else if (a.gender === 'genderless' || b.gender === 'genderless') {
      // Genderless without Ditto already caught above; defensive only
      reasons.push('Genderless Pokémon can only breed with Ditto');
    }
  }

  // Shiny mismatch is an invalid pairing (§8)
  if (a.isShiny !== b.isShiny) {
    reasons.push('Shiny and non-shiny Pokémon cannot breed together');
  }

  // Determine female-role parent and offspring species.
  // Always computed (even for invalid pairs) so callers always receive these fields.
  let femaleRoleParentId: string | undefined;
  let offspringSpeciesId: number | undefined;

  if (aIsDitto && !bIsDitto) {
    // b is the non-Ditto; b's species determines the offspring
    femaleRoleParentId = b.id;
    offspringSpeciesId = b.speciesId;
  } else if (bIsDitto && !aIsDitto) {
    femaleRoleParentId = a.id;
    offspringSpeciesId = a.speciesId;
  } else {
    // Neither is Ditto — female parent determines species
    if (a.gender === 'female') {
      femaleRoleParentId = a.id;
      offspringSpeciesId = a.speciesId;
    } else if (b.gender === 'female') {
      femaleRoleParentId = b.id;
      offspringSpeciesId = b.speciesId;
    } else {
      // Both male or ambiguous — pick A deterministically
      femaleRoleParentId = a.id;
      offspringSpeciesId = a.speciesId;
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    offspringSpeciesId,
    femaleRoleParentId,
  };
}
