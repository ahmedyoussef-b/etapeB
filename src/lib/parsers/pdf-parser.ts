import { PDFParse } from 'pdf-parse';

export class PDFParser {
  static async parse(buffer: Buffer | Uint8Array): Promise<string> {
    try {
      const data = Buffer.isBuffer(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : buffer;
      const parser = new PDFParse(data);
      const result = await parser.getText();
      return typeof result === 'string' ? result : result.text;
    } catch (error) {
      throw new Error(`Erreur parsing PDF: ${error}`);
    }
  }

  static async parseToProcedures(buffer: Buffer): Promise<any[]> {
    const text = await this.parse(buffer);

    const lines = text.split('\n').filter(line => line.trim().length > 0);

    const procedures: any[] = [];
    let currentProcedure: any = null;
    let currentStep: any = null;
    let stepCounter = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.toUpperCase().includes('PROCÉDURE') ||
          (trimmed.length > 10 && trimmed === trimmed.toUpperCase())) {
        if (currentProcedure) {
          procedures.push(currentProcedure);
        }
        currentProcedure = {
          title: trimmed,
          code: `PDF-${Date.now()}-${procedures.length + 1}`,
          description: '',
          category: 'Production',
          priority: 'Moyenne',
          status: 'draft',
          steps: []
        };
        stepCounter = 0;
        continue;
      }

      if (currentProcedure && (trimmed.match(/^Étape \d+/) || trimmed.match(/^Step \d+/))) {
        if (currentStep) {
          currentProcedure.steps.push(currentStep);
        }
        currentStep = {
          title: trimmed,
          instructions: '',
          type: 'consigne',
          isRequired: true,
          order: stepCounter++
        };
        continue;
      }

      if (currentProcedure && currentStep) {
        currentStep.instructions += (currentStep.instructions ? '\n' : '') + trimmed;
      } else if (currentProcedure && currentProcedure.steps.length === 0) {
        currentProcedure.description += (currentProcedure.description ? '\n' : '') + trimmed;
      }
    }

    if (currentProcedure) {
      if (currentStep) {
        currentProcedure.steps.push(currentStep);
      }
      procedures.push(currentProcedure);
    }

    return procedures;
  }
}
