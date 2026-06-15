/** Canonical column headers for the bulk-import template (also the textarea placeholder). */
export const TEMPLATE_HEADER = 'species,ivs,nature,ability,gender,shiny,alpha,eggMoves,notes';

/** A self-documenting example row whose values all pass validation. */
const TEMPLATE_EXAMPLE_ROW = 'Bulbasaur,31/31/31/31/31/31,Modest,Overgrow,male,false,false,,';

/** Builds the downloadable CSV template: header + one example row, trailing newline. */
export function buildTemplateCsv(): string {
  return `${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE_ROW}\n`;
}
