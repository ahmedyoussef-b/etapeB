import Papa from 'papaparse';

export interface CSVParsingResult {
  headers: string[];
  rows: Record<string, any>[];
  errors: string[];
}

export class CSVParser {
  static parse(content: string): CSVParsingResult {
    const errors: string[] = [];

    const result = (Papa as any).parse(content, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    }) as Papa.ParseResult<any>;

    if (result.errors.length > 0) {
      errors.push(...result.errors.map(e => e.message));
    }

    return {
      headers: result.meta.fields || [],
      rows: result.data as Record<string, any>[],
      errors
    };
  }

  static parseToProcedures(content: string): any[] {
    const { rows, errors } = this.parse(content);

    if (errors.length > 0) {
      throw new Error(`Erreurs de parsing CSV: ${errors.join(', ')}`);
    }

    const procedures = new Map<string, any>();

    for (const row of rows) {
      const code = row['code'] || row['Code'] || `CSV-${Date.now()}`;

      if (!procedures.has(code)) {
        procedures.set(code, {
          title: row['title'] || row['Titre'] || `Procédure ${code}`,
          code: code,
          description: row['description'] || row['Description'] || '',
          category: row['category'] || row['Catégorie'] || 'Production',
          priority: row['priority'] || row['Priorité'] || 'Moyenne',
          status: row['status'] || row['Statut'] || 'draft',
          steps: []
        });
      }

      const procedure = procedures.get(code);
      if (row['step_title'] || row['Étape']) {
        procedure.steps.push({
          title: row['step_title'] || row['Étape'] || `Étape ${procedure.steps.length + 1}`,
          instructions: row['step_instructions'] || row['Instructions'] || '',
          type: row['step_type'] || row['Type'] || 'consigne',
          isRequired: true,
          order: procedure.steps.length
        });
      }
    }

    return Array.from(procedures.values());
  }
}
