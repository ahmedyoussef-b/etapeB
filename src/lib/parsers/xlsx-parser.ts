import * as XLSX from 'xlsx';

export interface XLSXParsingResult {
  sheets: string[];
  data: Record<string, any[][]>;
  errors: string[];
}

export class XLSXParser {
  static parse(buffer: ArrayBuffer): XLSXParsingResult {
    const errors: string[] = [];
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const data: Record<string, any[][]> = {};
    const sheets = workbook.SheetNames;

    for (const sheetName of sheets) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        data[sheetName] = jsonData;
      } catch (error) {
        errors.push(`Erreur parsing feuille ${sheetName}: ${error}`);
      }
    }

    return { sheets, data, errors };
  }

  static parseToProcedures(buffer: ArrayBuffer): any[] {
    const { data, errors } = this.parse(buffer);

    if (errors.length > 0) {
      throw new Error(`Erreurs de parsing Excel: ${errors.join(', ')}`);
    }

    const sheetName = Object.keys(data)[0];
    if (!sheetName) {
      throw new Error('Aucune feuille trouvée dans le fichier Excel');
    }

    const rows = data[sheetName] as any[];
    const procedures = new Map<string, any>();

    for (const row of rows) {
      const code = row['code'] || row['Code'] || `XLSX-${Date.now()}`;

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
