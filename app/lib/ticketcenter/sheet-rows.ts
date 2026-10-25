// Row bookkeeping shared by sheets.ts and outreach-sheets.ts. Pure, so it can be
// tested without Google.

/** Rows are 1-based and row 1 is the header, so every data range starts at row 2. */
export const FIRST_DATA_ROW = 2;

/** A parsed record and the sheet row it was read from. */
export interface Located<T> {
  item: T;
  sheetRow: number;
}

/**
 * Parses the rows of a values.get that starts at FIRST_DATA_ROW, keeping each
 * record's real sheet row. The API returns an interior blank row as [] and the
 * parsers drop rows whose key cell is blank, so an index into the parsed list
 * is not a row number: the row is taken before anything is filtered out.
 */
export function locateRows<T>(rows: string[][], parse: (row: string[]) => T | null): Located<T>[] {
  return rows
    .map((row, i) => ({ item: parse(row), sheetRow: i + FIRST_DATA_ROW }))
    .filter((r): r is Located<T> => r.item !== null);
}

/** The key cell of a row about to be written no longer holds the record that was read there. */
export class RowMovedError extends Error {
  constructor(tab: string, key: string) {
    super(`The ${tab} sheet changed while saving "${key}". Reload and try again.`);
  }
}
