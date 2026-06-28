import Papa from 'papaparse';
import type { DPKCard } from '../types';
import { mapStatusToColumnId } from './statusMapping';

export interface ImportResult {
  cards: DPKCard[];
  skippedRows: number;
  errors: string[];
}

export function parseCSV(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const cards: DPKCard[] = [];
        let skippedRows = 0;
        const errors: string[] = [];

        for (const row of results.data) {
          try {
            const dpkRaw = String(row['DPK Number'] ?? '').trim();
            const statusRaw = String(row['Status'] ?? '').trim();

            if (!dpkRaw || !statusRaw) {
              skippedRows++;
              continue;
            }

            const columnId = mapStatusToColumnId(statusRaw);
            if (!columnId) {
              // Unrecognised status — skip silently
              skippedRows++;
              continue;
            }

            cards.push({
              id: crypto.randomUUID(),
              dpkNumber: dpkRaw.toUpperCase(),
              columnId,
            });
          } catch {
            skippedRows++;
          }
        }

        resolve({ cards, skippedRows, errors });
      },
      error(err) {
        resolve({ cards: [], skippedRows: 0, errors: [err.message] });
      },
    });
  });
}
