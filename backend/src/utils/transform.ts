/** Converts SQL row (snake_case) to Firestore-like doc (camelCase) */
export function rowToDoc<T extends Record<string, unknown>>(row: Record<string, unknown>): T & { id: string } {
  const doc: Record<string, unknown> = { id: String(row.id) };
  const sensitive = new Set(['password_hash', 'passwordHash', 'user_id']);

  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || sensitive.has(key)) continue;
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    if (value instanceof Date) {
      doc[camel] = { toDate: () => value, seconds: Math.floor(value.getTime() / 1000) };
    } else if (typeof value === 'string' && (key.endsWith('_ids') || key === 'children' || key === 'options' || key === 'selected_options' || key === 'read_receipts' || key === 'audit_history' || key === 'inspector' || key === 'subinspectors' || key === 'absences' || key === 'absent_today_list' || key === 'special_schedule' || key === 'overtime' || key === 'sectors' || key === 'chefia_ids')) {
      try {
        doc[camel] = JSON.parse(value);
      } catch {
        doc[camel] = value;
      }
    } else {
      doc[camel] = value;
    }
  }

  return doc as T & { id: string };
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function docToRow(data: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue;
    const snake = camelToSnake(key);
    if (value && typeof value === 'object' && 'toDate' in (value as object)) {
      row[snake] = (value as { toDate: () => Date }).toDate();
    } else if (Array.isArray(value) || (value && typeof value === 'object' && !(value instanceof Date))) {
      row[snake] = JSON.stringify(value);
    } else {
      row[snake] = value;
    }
  }
  return row;
}
