import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type {
  LegacyAudienceSourceClassification,
  LegacyAudienceSourceInventoryFile,
  LegacyAudienceSourceInventoryManifest,
} from '../../../contracts/src/audience-reconciliation/index.ts';
import { legacyAudienceSourceInventoryManifestSchema } from '../../../contracts/src/audience-reconciliation/index.ts';

export type LegacyAudienceInventoryRoot = {
  label: string;
  directory: string;
};

type WorkbookSheet = {
  name: string;
  columns: string[];
  rowCount: number;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

const CANDIDATE_EXTENSIONS = new Set(['.csv', '.tsv', '.xlsx', '.xls']);
const CANDIDATE_NAME_PATTERN =
  /one.?time|onetime|rabbi|scheller|sheller|audience|contact|subscriber|subscribed|unsubscribed|whatsapp|email|legacy|activation|crm|lead|school|family|followers/i;
const MAX_XLSX_METADATA_BYTES = 50 * 1024 * 1024;

export async function createLegacyAudienceSourceInventory(input: {
  roots: LegacyAudienceInventoryRoot[];
  generatedBy: string;
  now?: Date;
}): Promise<LegacyAudienceSourceInventoryManifest> {
  const files: LegacyAudienceSourceInventoryFile[] = [];
  const seenByHash = new Map<string, string>();
  for (const root of input.roots) {
    for (const filePath of await listCandidateFiles(root.directory)) {
      const file = await inventoryFile({ root, filePath, seenByHash });
      files.push(file);
    }
  }

  const generatedAt = (input.now ?? new Date()).toISOString();
  const withoutHash = {
    inventory_key: stableKey('legacy_source_inventory', [
      generatedAt,
      input.generatedBy,
      ...files.map((file) => file.sha256).sort(),
    ]),
    generated_at: generatedAt,
    generated_by: input.generatedBy,
    source_roots: input.roots.map((root) => root.label),
    files: files.sort((left, right) => left.file_ref.localeCompare(right.file_ref)),
    summary: summarizeInventory(files),
    manifest_sha256: '0'.repeat(64),
    raw_values_included: false as const,
    production_side_effects: false as const,
  };
  const manifestSha256 = sha256(canonicalJson({ ...withoutHash, manifest_sha256: undefined }));
  return legacyAudienceSourceInventoryManifestSchema.parse({
    ...withoutHash,
    manifest_sha256: manifestSha256,
  });
}

async function listCandidateFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!CANDIDATE_EXTENSIONS.has(extension) || !CANDIDATE_NAME_PATTERN.test(entry.name)) {
      continue;
    }
    files.push(path.join(directory, entry.name));
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function inventoryFile(input: {
  root: LegacyAudienceInventoryRoot;
  filePath: string;
  seenByHash: Map<string, string>;
}): Promise<LegacyAudienceSourceInventoryFile> {
  const fileName = path.basename(input.filePath);
  const extension = path.extname(fileName).toLowerCase();
  const fileStat = await stat(input.filePath);
  const shouldReadWholeFile = extension === '.xlsx' && fileStat.size <= MAX_XLSX_METADATA_BYTES;
  const buffer = shouldReadWholeFile ? await readFile(input.filePath) : null;
  const fileSha256 = buffer ? sha256(buffer) : await sha256File(input.filePath);
  const duplicateOfSha256 = input.seenByHash.has(fileSha256) ? fileSha256 : null;
  if (!input.seenByHash.has(fileSha256)) {
    input.seenByHash.set(fileSha256, fileName);
  }

  const warnings: string[] = [];
  let sheets: WorkbookSheet[] = [];
  if (extension === '.csv' || extension === '.tsv') {
    sheets = [
      await parseDelimitedMetadataFromFile(input.filePath, extension === '.tsv' ? '\t' : ','),
    ];
  } else if (extension === '.xlsx') {
    if (!buffer) {
      warnings.push('xlsx_too_large_for_metadata_parse');
    } else {
      try {
        sheets = parseXlsxMetadata(buffer);
        warnings.push('xlsx_parser_metadata_only');
      } catch (error) {
        warnings.push(
          `xlsx_metadata_unreadable:${error instanceof Error ? error.message : 'error'}`,
        );
      }
    }
  } else if (extension === '.xls') {
    warnings.push('legacy_xls_binary_unsupported_metadata_only');
  }

  const sheetNames = sheets.map((sheet) => sheet.name);
  const columnNamesBySheet = Object.fromEntries(
    sheets.map((sheet) => [sheet.name, sheet.columns.slice(0, 200)]),
  );
  const rowCountsBySheet = Object.fromEntries(sheets.map((sheet) => [sheet.name, sheet.rowCount]));
  const allColumns = sheets.flatMap((sheet) => sheet.columns);
  const classification = classifySource({
    fileName,
    extension,
    columns: allColumns,
    duplicateOfSha256,
  });
  warnings.push(...sourceWarnings({ extension, columns: allColumns, classification }));

  return {
    file_ref: stableKey('legacy_source_file', [input.root.label, fileName, fileSha256]),
    source_root_label: input.root.label,
    file_name: fileName,
    extension: extension || 'none',
    byte_size: fileStat.size,
    last_modified: fileStat.mtime.toISOString(),
    sha256: fileSha256,
    duplicate_of_sha256: duplicateOfSha256,
    classification: classification.classification,
    classification_reasons: classification.reasons,
    sheet_names: sheetNames,
    column_names_by_sheet: columnNamesBySheet,
    row_counts_by_sheet: rowCountsBySheet,
    warnings: Array.from(new Set(warnings)).sort(),
    raw_values_included: false,
  };
}

async function parseDelimitedMetadataFromFile(
  filePath: string,
  delimiter: ',' | '\t',
): Promise<WorkbookSheet> {
  let header: string[] | null = null;
  let headerCells: string[] = [];
  let cell = '';
  let quoted = false;
  let pendingQuotedCellClose = false;
  let rowHasValue = false;
  let dataRowCount = 0;

  const appendValue = (value: string) => {
    if (header === null) cell += value;
    if (value.trim() !== '') rowHasValue = true;
  };
  const finishCell = () => {
    if (header === null) headerCells.push(cell);
    cell = '';
  };
  const finishRow = () => {
    finishCell();
    if (header === null) {
      header = headerCells;
    } else if (rowHasValue) {
      dataRowCount += 1;
    }
    headerCells = [];
    rowHasValue = false;
  };

  for await (const chunk of createReadStream(filePath, { encoding: 'utf8' })) {
    let index = 0;
    while (index < chunk.length) {
      const char = chunk[index] ?? '';
      const next = chunk[index + 1];
      if (pendingQuotedCellClose) {
        if (char === '"') {
          appendValue('"');
          pendingQuotedCellClose = false;
          index += 1;
          continue;
        }
        pendingQuotedCellClose = false;
        quoted = false;
      }

      if (quoted) {
        if (char === '"' && next === undefined) {
          pendingQuotedCellClose = true;
          index += 1;
        } else if (char === '"' && next === '"') {
          appendValue('"');
          index += 2;
        } else if (char === '"') {
          quoted = false;
          index += 1;
        } else {
          appendValue(char);
          index += 1;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
        index += 1;
        continue;
      }
      if (char === delimiter) {
        finishCell();
      } else if (char === '\n') {
        finishRow();
      } else if (char !== '\r') {
        appendValue(char);
      }
      index += 1;
    }
  }
  if (pendingQuotedCellClose) quoted = false;
  if (cell !== '' || headerCells.length > 0 || rowHasValue || header === null) {
    finishRow();
  }

  return {
    name: delimiter === '\t' ? 'tsv' : 'csv',
    columns: (header ?? []).map(normalizeColumnName).filter(Boolean).slice(0, 200),
    rowCount: dataRowCount,
  };
}

function parseXlsxMetadata(buffer: Buffer): WorkbookSheet[] {
  const entries = readZipEntries(buffer);
  const entryMap = new Map(entries.map((entry) => [entry.name, readZipEntry(buffer, entry)]));
  const sharedStrings = parseSharedStrings(entryMap.get('xl/sharedStrings.xml')?.toString('utf8'));
  const workbookXml = entryMap.get('xl/workbook.xml')?.toString('utf8');
  const relsXml = entryMap.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbookXml || !relsXml) return [];
  const rels = parseWorkbookRelationships(relsXml);
  const sheets = parseWorkbookSheets(workbookXml);
  return sheets.flatMap((sheet) => {
    const target = rels.get(sheet.relationshipId);
    if (!target) return [];
    const entryName = normalizeXlsxTarget(target);
    const sheetXml = entryMap.get(entryName)?.toString('utf8');
    if (!sheetXml) return [];
    return [parseWorksheetMetadata(sheet.name, sheetXml, sharedStrings)];
  });
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;
  while (offset < end) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`bad local header for ${entry.name}`);
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return data;
  if (entry.compressionMethod === 8) return inflateRawSync(data);
  throw new Error(`unsupported zip method ${entry.compressionMethod}`);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('missing zip directory');
}

function parseSharedStrings(xml?: string) {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) =>
    Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1] ?? ''))
      .join(''),
  );
}

function parseWorkbookRelationships(xml: string) {
  const rels = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = match[1] ?? '';
    const id = attr(attrs, 'Id');
    const target = attr(attrs, 'Target');
    if (id && target) rels.set(id, target);
  }
  return rels;
}

function parseWorkbookSheets(xml: string) {
  return Array.from(xml.matchAll(/<sheet\b([^>]*)\/?>/g)).flatMap((match) => {
    const attrs = match[1] ?? '';
    const name = attr(attrs, 'name');
    const relationshipId = attr(attrs, 'r:id');
    return name && relationshipId ? [{ name: decodeXml(name), relationshipId }] : [];
  });
}

function normalizeXlsxTarget(target: string) {
  const normalized = target.replace(/^\/+/, '');
  if (normalized.startsWith('xl/')) return normalized;
  return path.posix.normalize(`xl/${normalized}`).replace(/\\/g, '/');
}

function parseWorksheetMetadata(name: string, xml: string, sharedStrings: string[]): WorkbookSheet {
  const rowMatches = Array.from(xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g));
  const firstRow = rowMatches[0]?.[0] ?? '';
  const columns = Array.from(firstRow.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g))
    .map((cellMatch) => cellValue(cellMatch[1] ?? '', cellMatch[2] ?? '', sharedStrings))
    .map(normalizeColumnName)
    .filter(Boolean)
    .slice(0, 200);
  const nonEmptyRows = rowMatches.filter((rowMatch) => /<v>|<is>|<t/.test(rowMatch[0])).length;
  return { name, columns, rowCount: Math.max(0, nonEmptyRows - 1) };
}

function cellValue(attrs: string, body: string, sharedStrings: string[]) {
  const type = attr(attrs, 't');
  if (type === 's') {
    const index = Number(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? -1);
    return Number.isInteger(index) ? (sharedStrings[index] ?? '') : '';
  }
  if (type === 'inlineStr') {
    return decodeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '');
  }
  return decodeXml(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? '');
}

function attr(attrs: string, name: string) {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return attrs.match(new RegExp(`${escaped}="([^"]*)"`))?.[1] ?? null;
}

function normalizeColumnName(value: string) {
  return decodeXml(value).trim().replace(/\s+/g, ' ').slice(0, 120);
}

function classifySource(input: {
  fileName: string;
  extension: string;
  columns: string[];
  duplicateOfSha256: string | null;
}): { classification: LegacyAudienceSourceClassification; reasons: string[] } {
  if (input.duplicateOfSha256) {
    return { classification: 'duplicate', reasons: ['duplicate_sha256'] };
  }
  const text = `${input.fileName} ${input.columns.join(' ')}`.toLowerCase();
  const oneTime = /one.?time|onetime|rabbi|scheller|sheller|mishnah/.test(text);
  const contactish =
    /email|phone|mobile|whatsapp|subscriber|subscribed|unsubscribed|contact|name|guardian|parent|student|learner|lead/.test(
      text,
    );
  if (oneTime && contactish) {
    return {
      classification: 'proven_one_time',
      reasons: ['one_time_or_rabbi_filename_or_columns', 'contact_columns_present'],
    };
  }
  if (contactish) {
    return {
      classification: 'mixed_needs_review',
      reasons: ['contact_or_audience_columns_without_one_time_proof'],
    };
  }
  if (input.extension === '.xls') {
    return { classification: 'mixed_needs_review', reasons: ['legacy_xls_requires_manual_review'] };
  }
  return { classification: 'unrelated', reasons: ['no_one_time_or_contact_signal'] };
}

function sourceWarnings(input: {
  extension: string;
  columns: string[];
  classification: { classification: LegacyAudienceSourceClassification; reasons: string[] };
}) {
  const warnings: string[] = [];
  const columns = input.columns.join(' ').toLowerCase();
  if (/email|phone|mobile|whatsapp|name|address/.test(columns)) {
    warnings.push('possible_pii_columns_detected');
  }
  if (!/email|phone|mobile|whatsapp/.test(columns) && input.extension !== '.xls') {
    warnings.push('no_email_or_phone_identity_columns_detected');
  }
  if (input.classification.classification === 'mixed_needs_review') {
    warnings.push('operator_review_required_before_import');
  }
  if (input.classification.classification === 'unrelated') {
    warnings.push('excluded_from_one_time_import_by_default');
  }
  return warnings;
}

function summarizeInventory(files: LegacyAudienceSourceInventoryFile[]) {
  return {
    file_count: files.length,
    proven_one_time: files.filter((file) => file.classification === 'proven_one_time').length,
    mixed_needs_review: files.filter((file) => file.classification === 'mixed_needs_review').length,
    unrelated: files.filter((file) => file.classification === 'unrelated').length,
    duplicate: files.filter((file) => file.classification === 'duplicate').length,
    unsupported_files: files.filter((file) =>
      file.warnings.some((warning) => warning.includes('unsupported')),
    ).length,
    possible_pii_files: files.filter((file) =>
      file.warnings.includes('possible_pii_columns_detected'),
    ).length,
  };
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortForHash(entry)]),
    );
  }
  return value;
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${sha256(parts.join('\0')).slice(0, 24)}`;
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
