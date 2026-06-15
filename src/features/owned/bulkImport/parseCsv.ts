export function detectDelimiter(text: string): '\t' | ',' {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

/**
 * Parse delimited text (comma or tab, auto-detected) into rows of cells.
 * Supports RFC-4180 style quoting: double-quoted fields may contain the
 * delimiter, and `""` is an escaped quote. Fully blank lines are dropped.
 */
export function parseDelimited(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      pushField();
    } else if (ch === '\r') {
      // ignore; handled by the following \n
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
