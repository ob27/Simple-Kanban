import Papa from 'papaparse';
import type { KanbanCard, ColumnConfig } from '../types';

export interface ImportResult {
  cards: KanbanCard[];
  skippedRows: number;
  errors: string[];
}

export function parseCSV(file: File, columns: ColumnConfig[]): Promise<ImportResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const cards: KanbanCard[] = [];
        let skippedRows = 0;
        const errors: string[] = [];

        for (const row of results.data) {
          try {
            const title = String(row['Title'] ?? row['DPK Number'] ?? '').trim();
            const statusRaw = String(row['Status'] ?? '').trim();
            const pillValue = String(row['Pill'] ?? row['Pill Value'] ?? '').trim();

            if (!title || !statusRaw) { skippedRows++; continue; }

            // Match status to column label (case-insensitive, partial match)
            const col = columns.find(c =>
              c.label.toLowerCase().includes(statusRaw.toLowerCase()) ||
              statusRaw.toLowerCase().includes(c.label.toLowerCase().split(' ')[0])
            );
            if (!col) { skippedRows++; continue; }

            cards.push({
              id: crypto.randomUUID(),
              title,
              columnId: col.id,
              pillValue,
              order: cards.length,
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
