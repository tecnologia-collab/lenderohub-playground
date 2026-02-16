/**
 * Mass Beneficiary Import Service
 *
 * Handles CSV upload, validation, and batch creation of beneficiaries
 * through the Finco instrument API.
 */

import mongoose from 'mongoose';
import {
  MassBeneficiaryImport,
  IMassBeneficiaryImport,
  IMassBeneficiaryRow,
  MassBeneficiaryImportStatus,
  MassBeneficiaryRowStatus
} from '../../models/massBeneficiaryImport.model';
import { FincoClient } from '../../integrations/finco/client';
import { getBankIdFromClabe } from '../../utils/bankMapping';
import { UserBeneficiary } from '../../models/userBeneficiaries.model';

// ============================================================================
// CSV PARSING
// ============================================================================

interface ParsedCsvRow {
  nombre: string;
  alias: string;
  clabe: string;
  rfc: string;
  email: string;
}

/**
 * Parse a CSV buffer into rows.
 * Supports comma and semicolon delimiters. Handles quoted fields and BOM.
 */
function parseCsv(buffer: Buffer): ParsedCsvRow[] {
  let content = buffer.toString('utf-8');

  // Strip BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Detect delimiter from header line
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';

  // Parse header
  const headers = parseCsvLine(headerLine, delimiter).map(h => h.trim().toLowerCase());

  // Map column names (support Spanish and English)
  const nameIdx = headers.findIndex(h => h === 'nombre' || h === 'name');
  const aliasIdx = headers.findIndex(h => h === 'alias');
  const clabeIdx = headers.findIndex(h => h === 'clabe');
  const rfcIdx = headers.findIndex(h => h === 'rfc');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'correo');

  if (nameIdx === -1 || aliasIdx === -1 || clabeIdx === -1) {
    throw new Error(
      'CSV debe contener al menos las columnas: nombre, alias, clabe'
    );
  }

  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i], delimiter);
    rows.push({
      nombre: (fields[nameIdx] || '').trim(),
      alias: (fields[aliasIdx] || '').trim(),
      clabe: (fields[clabeIdx] || '').trim(),
      rfc: rfcIdx >= 0 ? (fields[rfcIdx] || '').trim() : '',
      email: emailIdx >= 0 ? (fields[emailIdx] || '').trim() : ''
    });
  }

  return rows;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ============================================================================
// VALIDATION
// ============================================================================

const CLABE_REGEX = /^\d{18}$/;
const RFC_REGEX = /^[A-Z&]{3,4}\d{6}[A-Z0-9]{3}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRow(
  row: ParsedCsvRow,
  rowNumber: number,
  seenClabes: Set<string>,
  existingClabes: Set<string>
): IMassBeneficiaryRow {
  const errors: string[] = [];

  // Required fields
  if (!row.nombre) {
    errors.push('nombre es requerido');
  }
  if (!row.alias) {
    errors.push('alias es requerido');
  }

  // CLABE validation
  if (!row.clabe) {
    errors.push('clabe es requerida');
  } else if (!CLABE_REGEX.test(row.clabe)) {
    errors.push('clabe debe ser exactamente 18 digitos');
  } else {
    // Check bank code is valid
    const bankInfo = getBankIdFromClabe(row.clabe);
    if (!bankInfo) {
      errors.push(`codigo de banco ${row.clabe.substring(0, 3)} no encontrado en catalogo`);
    }

    // Duplicate within file
    if (seenClabes.has(row.clabe)) {
      errors.push('clabe duplicada dentro del archivo');
    }

    // Duplicate in existing beneficiaries
    if (existingClabes.has(row.clabe)) {
      errors.push('clabe ya registrada como beneficiario');
    }
  }

  // Optional field validation
  if (row.rfc && !RFC_REGEX.test(row.rfc)) {
    errors.push('formato de RFC invalido (debe ser 10-13 caracteres alfanumericos)');
  }

  if (row.email && !EMAIL_REGEX.test(row.email)) {
    errors.push('formato de email invalido');
  }

  // Track CLABE even if there were other errors
  if (row.clabe) {
    seenClabes.add(row.clabe);
  }

  const isValid = errors.length === 0;

  return {
    rowNumber,
    name: row.nombre,
    alias: row.alias,
    clabeNumber: row.clabe,
    rfc: row.rfc,
    email: row.email,
    status: isValid ? MassBeneficiaryRowStatus.Valid : MassBeneficiaryRowStatus.Invalid,
    errorMessage: isValid ? undefined : errors.join('; ')
  };
}

// ============================================================================
// SERVICE
// ============================================================================

// Finco client instance (same pattern as beneficiaries.controller)
const fincoClient = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
  environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
});

/**
 * Sanitize text input (same pattern as beneficiaries.controller - HIGH-01)
 */
function sanitizeText(input: string): string {
  return input.replace(/[<>"']/g, '').trim().substring(0, 100);
}

class MassBeneficiaryService {

  /**
   * Upload and validate a CSV file.
   * Parses rows, validates each one, stores the import record with validation results.
   */
  async uploadAndValidate(
    file: Buffer,
    fileName: string,
    costCentreId: string,
    corporateClientId: string,
    userId: string
  ): Promise<IMassBeneficiaryImport> {
    // 1. Parse CSV
    const parsedRows = parseCsv(file);
    if (parsedRows.length === 0) {
      throw new Error('El archivo CSV no contiene filas de datos');
    }

    if (parsedRows.length > 500) {
      throw new Error('El archivo CSV excede el limite de 500 filas');
    }

    // 2. Fetch existing beneficiary CLABEs from Finco
    const existingClabes = await this.getExistingClabes();

    // 3. Validate each row
    const seenClabes = new Set<string>();
    const validatedRows: IMassBeneficiaryRow[] = parsedRows.map((row, index) =>
      validateRow(row, index + 1, seenClabes, existingClabes)
    );

    const validRows = validatedRows.filter(r => r.status === MassBeneficiaryRowStatus.Valid).length;
    const invalidRows = validatedRows.filter(r => r.status === MassBeneficiaryRowStatus.Invalid).length;

    // 4. Create import record
    const importRecord = await MassBeneficiaryImport.create({
      corporateClientId: new mongoose.Types.ObjectId(corporateClientId),
      costCentreId: new mongoose.Types.ObjectId(costCentreId),
      userId: new mongoose.Types.ObjectId(userId),
      status: MassBeneficiaryImportStatus.PendingReview,
      fileName,
      totalRows: validatedRows.length,
      validRows,
      invalidRows,
      successCount: 0,
      failCount: 0,
      rows: validatedRows
    });

    return importRecord;
  }

  /**
   * Confirm an import: change status to processing, create beneficiaries for valid rows.
   */
  async confirm(importId: string, userId: string): Promise<IMassBeneficiaryImport> {
    const importRecord = await MassBeneficiaryImport.findById(importId);

    if (!importRecord) {
      throw new Error('Import no encontrado');
    }

    if (importRecord.userId.toString() !== userId) {
      throw new Error('No tienes permiso para confirmar este import');
    }

    if (importRecord.status !== MassBeneficiaryImportStatus.PendingReview) {
      throw new Error(`Import no puede ser confirmado en estado: ${importRecord.status}`);
    }

    if (importRecord.validRows === 0) {
      throw new Error('No hay filas validas para procesar');
    }

    // Update status to processing
    importRecord.status = MassBeneficiaryImportStatus.Processing;
    await importRecord.save();

    // Process each valid row
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < importRecord.rows.length; i++) {
      const row = importRecord.rows[i];

      if (row.status !== MassBeneficiaryRowStatus.Valid) {
        continue;
      }

      try {
        const bankInfo = getBankIdFromClabe(row.clabeNumber);
        if (!bankInfo) {
          throw new Error(`Codigo de banco ${row.clabeNumber.substring(0, 3)} no encontrado`);
        }

        const sanitizedName = sanitizeText(row.name).substring(0, 100);
        const sanitizedAlias = sanitizeText(row.alias).substring(0, 50);

        const requestBody = {
          alias: sanitizedAlias,
          beneficiary_name: sanitizedName,
          clabe: row.clabeNumber,
          rfc: row.rfc || 'ND',
          destination_bank_id: bankInfo.bankId
        };

        const instrument = await fincoClient.createInstrument(requestBody);

        // Register user-beneficiary mapping (same pattern as beneficiaries.controller)
        if (instrument?.id) {
          try {
            await UserBeneficiary.findOneAndUpdate(
              { user: userId, instrumentId: instrument.id },
              { user: userId, instrumentId: instrument.id },
              { upsert: true, new: true }
            );
          } catch (mapError: any) {
            console.warn(
              `Warning: No se pudo registrar mapping para instrumento ${instrument.id}:`,
              mapError?.message || mapError
            );
          }
        }

        row.status = MassBeneficiaryRowStatus.Created;
        row.beneficiaryId = instrument?.id ? new mongoose.Types.ObjectId(instrument.id) : undefined;
        successCount++;
      } catch (error: any) {
        row.status = MassBeneficiaryRowStatus.Failed;
        row.errorMessage = error?.message || 'Error desconocido al crear beneficiario';
        failCount++;
      }
    }

    // Update counts and final status
    importRecord.successCount = successCount;
    importRecord.failCount = failCount;

    if (failCount === 0) {
      importRecord.status = MassBeneficiaryImportStatus.Completed;
    } else if (successCount === 0) {
      importRecord.status = MassBeneficiaryImportStatus.Failed;
    } else {
      importRecord.status = MassBeneficiaryImportStatus.PartiallyCompleted;
    }

    await importRecord.save();
    return importRecord;
  }

  /**
   * Get a single import by ID.
   */
  async getById(importId: string): Promise<IMassBeneficiaryImport | null> {
    return MassBeneficiaryImport.findById(importId);
  }

  /**
   * List all imports for a cost centre, with pagination.
   */
  async getAll(
    costCentreId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    items: IMassBeneficiaryImport[];
    total: number;
    page: number;
    pages: number;
  }> {
    const skip = (page - 1) * limit;
    const filter = { costCentreId: new mongoose.Types.ObjectId(costCentreId) };

    const [items, total] = await Promise.all([
      MassBeneficiaryImport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MassBeneficiaryImport.countDocuments(filter)
    ]);

    return {
      items: items as IMassBeneficiaryImport[],
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  /**
   * Fetch all existing beneficiary CLABEs from Finco.
   */
  private async getExistingClabes(): Promise<Set<string>> {
    try {
      const response = await fincoClient.getInstruments();
      const instruments: any[] = response.data || [];
      const clabes = new Set<string>();

      for (const instrument of instruments) {
        const clabe = instrument.instrumentDetail?.clabeNumber;
        if (clabe) {
          clabes.add(clabe);
        }
      }

      return clabes;
    } catch (error: any) {
      console.warn('Warning: No se pudieron obtener beneficiarios existentes:', error?.message);
      return new Set<string>();
    }
  }
}

export default new MassBeneficiaryService();
export { MassBeneficiaryService };
