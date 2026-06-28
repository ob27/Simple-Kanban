import React, { useRef } from 'react';
import { Button, notification } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { DPKCard } from '../types';
import { parseCSV } from '../utils/csvImport';

interface Props {
  onImport: (cards: DPKCard[]) => void;
}

export function CsvImportButton({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const result = await parseCSV(file);

    if (result.errors.length > 0) {
      notification.warning({
        message: 'Some rows could not be imported',
        description: result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? `\n…and ${result.errors.length - 5} more` : ''),
        duration: 8,
      });
    }

    if (result.cards.length === 0) {
      notification.error({
        message: 'Import failed',
        description: 'No valid cards found in the CSV. Check that columns are named "DPK Number" and "Status".',
      });
      return;
    }

    onImport(result.cards);
    notification.success({
      message: `Imported ${result.cards.length} cards`,
      description: result.skippedRows > 0 ? `${result.skippedRows} rows skipped.` : undefined,
      duration: 4,
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <Button
        icon={<UploadOutlined />}
        size="large"
        onClick={() => inputRef.current?.click()}
        style={{ fontSize: 16 }}
      >
        Import CSV
      </Button>
    </>
  );
}
