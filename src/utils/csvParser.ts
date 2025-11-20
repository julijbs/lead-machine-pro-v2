/**
 * Converte CSV para JSON
 * Suporta campos entre aspas e escape de aspas duplas
 */
export function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV deve conter cabeçalho e pelo menos uma linha de dados');
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    if (values.length !== headers.length) {
      console.warn(`Linha ${i + 1} tem ${values.length} campos, esperado ${headers.length}. Pulando...`);
      continue;
    }

    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });

    data.push(obj);
  }

  return data;
}

/**
 * Parse uma linha CSV respeitando campos entre aspas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote ("")
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Detecta se o texto é CSV ou JSON
 */
export function detectFormat(text: string): 'csv' | 'json' | 'unknown' {
  const trimmed = text.trim();

  // Check if it's JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      return 'unknown';
    }
  }

  // Check if it's CSV (has comma-separated values with headers)
  const lines = trimmed.split('\n');
  if (lines.length >= 2) {
    const firstLine = lines[0];
    if (firstLine.includes(',') || firstLine.includes('"')) {
      return 'csv';
    }
  }

  return 'unknown';
}
