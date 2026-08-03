import { createHash } from 'node:crypto';
import {
  contentAdminStructuredPromptDocumentSchema,
  contentAdminStructuredPromptOperationSchema,
  type ContentAdminStructuredPromptDocument,
  type ContentAdminStructuredPromptOperation,
  type ContentAdminStructuredPromptSection,
} from '../../../contracts/src/content/admin-workspace.ts';

export const STRUCTURED_PROMPT_SCHEMA_VERSION = 1 as const;

export const STRUCTURED_PROMPT_SECTION_ORDER = [
  'objective',
  'audience',
  'approved_sources',
  'tone_and_voice',
  'channel_and_output_format',
  'visual_camera_composition',
  'required_elements',
  'forbidden_elements',
  'citations',
  'safety',
] as const satisfies readonly ContentAdminStructuredPromptSection[];

const SECTION_LABELS: Record<ContentAdminStructuredPromptSection, string> = {
  objective: 'Objective',
  audience: 'Audience',
  approved_sources: 'Approved sources',
  tone_and_voice: 'Tone and voice',
  channel_and_output_format: 'Channel and output format',
  visual_camera_composition: 'Visual, camera, and composition',
  required_elements: 'Required elements',
  forbidden_elements: 'Forbidden elements',
  citations: 'Citations',
  safety: 'Safety',
};

export type StructuredPromptPatchEnvelope = {
  schema_version: typeof STRUCTURED_PROMPT_SCHEMA_VERSION;
  document: ContentAdminStructuredPromptDocument;
  operations: ContentAdminStructuredPromptOperation[];
};

export type StructuredPromptDiff = {
  operation: ContentAdminStructuredPromptOperation['operation'];
  section: ContentAdminStructuredPromptSection;
  before: string[];
  after: string[];
  before_checksum: string;
  after_checksum: string;
};

export class StructuredPromptPatchError extends Error {
  constructor(
    public readonly code:
      | 'SECTION_CHECKSUM_CONFLICT'
      | 'INVALID_ITEM_INDEX'
      | 'PATCH_NOOP'
      | 'INVALID_STRUCTURED_DOCUMENT',
    message: string,
  ) {
    super(message);
  }
}

export function compileLegacyPromptDocument(
  promptText: string,
): ContentAdminStructuredPromptDocument {
  if (promptText.length < 1) {
    throw new StructuredPromptPatchError(
      'INVALID_STRUCTURED_DOCUMENT',
      'Legacy prompt text cannot be empty.',
    );
  }
  return contentAdminStructuredPromptDocumentSchema.parse({
    objective: [],
    audience: [],
    approved_sources: [],
    tone_and_voice: [],
    channel_and_output_format: [],
    visual_camera_composition: [],
    required_elements: [],
    forbidden_elements: [],
    citations: [],
    // Legacy prompts can mix objectives and guardrails in one unstructured
    // block. Preserve that block in a non-destructively mutable section.
    safety: [promptText],
  });
}

export function readStructuredPromptDocument(input: {
  promptText: string;
  patchJson: unknown;
}): ContentAdminStructuredPromptDocument {
  const record = asRecord(input.patchJson);
  const parsed = contentAdminStructuredPromptDocumentSchema.safeParse(record.document);
  const hasStructuredEnvelope =
    Object.hasOwn(record, 'schema_version') || Object.hasOwn(record, 'document');
  if (hasStructuredEnvelope) {
    const validOperations =
      Array.isArray(record.operations) &&
      record.operations.length <= 20 &&
      record.operations.every(
        (operation) => contentAdminStructuredPromptOperationSchema.safeParse(operation).success,
      );
    if (
      record.schema_version !== STRUCTURED_PROMPT_SCHEMA_VERSION ||
      !parsed.success ||
      !validOperations
    ) {
      throw new StructuredPromptPatchError(
        'INVALID_STRUCTURED_DOCUMENT',
        'Stored structured prompt data is invalid and cannot be used.',
      );
    }
    return parsed.data;
  }
  return compileLegacyPromptDocument(input.promptText);
}

export function renderStructuredPromptDocument(
  input: ContentAdminStructuredPromptDocument,
): string {
  const document = contentAdminStructuredPromptDocumentSchema.parse(input);
  const populatedItems = STRUCTURED_PROMPT_SECTION_ORDER.flatMap((section) => document[section]);
  if (populatedItems.length === 1 && document.safety.length === 1) {
    return document.safety[0]!;
  }
  const rendered = STRUCTURED_PROMPT_SECTION_ORDER.flatMap((section) => {
    const items = document[section];
    if (items.length === 0) return [];
    return [`## ${SECTION_LABELS[section]}`, ...items.map((item) => `- ${item}`)];
  }).join('\n');
  if (rendered.length > 30_000) {
    throw new StructuredPromptPatchError(
      'INVALID_STRUCTURED_DOCUMENT',
      'Rendered structured prompt exceeds the 30,000 character limit.',
    );
  }
  return rendered;
}

export function structuredPromptSectionChecksum(items: readonly string[]) {
  return sha256(JSON.stringify(items));
}

export function structuredPromptDocumentChecksum(input: ContentAdminStructuredPromptDocument) {
  return sha256(canonicalStructuredPromptJson(input));
}

export function assertStoredPromptIntegrity(input: {
  promptText: string;
  patchJson: unknown;
  checksum: string;
}) {
  const record = asRecord(input.patchJson);
  const hasStructuredEnvelope =
    Object.hasOwn(record, 'schema_version') || Object.hasOwn(record, 'document');
  const document = readStructuredPromptDocument(input);
  const rendered = renderStructuredPromptDocument(document);
  const expectedChecksum = hasStructuredEnvelope
    ? structuredPromptDocumentChecksum(document)
    : sha256(input.promptText);
  if (rendered !== input.promptText || expectedChecksum !== input.checksum) {
    throw new StructuredPromptPatchError(
      'INVALID_STRUCTURED_DOCUMENT',
      'Stored prompt text, structured document, and checksum do not match.',
    );
  }
  return document;
}

export function canonicalStructuredPromptJson(input: ContentAdminStructuredPromptDocument) {
  const document = contentAdminStructuredPromptDocumentSchema.parse(input);
  return JSON.stringify(
    Object.fromEntries(
      STRUCTURED_PROMPT_SECTION_ORDER.map((section) => [section, document[section]]),
    ),
  );
}

export function applyStructuredPromptOperations(
  parentInput: ContentAdminStructuredPromptDocument,
  operationsInput: ContentAdminStructuredPromptOperation[],
): {
  document: ContentAdminStructuredPromptDocument;
  diff: StructuredPromptDiff[];
} {
  const parent = contentAdminStructuredPromptDocumentSchema.parse(parentInput);
  const operations = operationsInput.map((operation) =>
    contentAdminStructuredPromptOperationSchema.parse(operation),
  );
  let document = cloneDocument(parent);
  const diff: StructuredPromptDiff[] = [];
  for (const operation of operations) {
    const proposedItems =
      operation.operation === 'replace_section'
        ? operation.items
        : operation.operation === 'append_item'
          ? [operation.item]
          : [];
    if (proposedItems.some(instructionAttemptsGuardrailBypass)) {
      throw new StructuredPromptPatchError(
        'INVALID_STRUCTURED_DOCUMENT',
        'Prompt feedback cannot weaken source, citation, privacy, or safety guardrails.',
      );
    }
    const before = [...document[operation.section]];
    const beforeChecksum = structuredPromptSectionChecksum(before);
    if (operation.expected_section_checksum !== beforeChecksum) {
      throw new StructuredPromptPatchError(
        'SECTION_CHECKSUM_CONFLICT',
        `The ${operation.section} section changed before this patch could be applied.`,
      );
    }
    let after: string[];
    if (operation.operation === 'replace_section') {
      after = [...operation.items];
    } else if (operation.operation === 'append_item') {
      after = [...before, operation.item];
    } else {
      if (operation.item_index >= before.length) {
        throw new StructuredPromptPatchError(
          'INVALID_ITEM_INDEX',
          `The selected ${operation.section} instruction no longer exists.`,
        );
      }
      after = before.filter((_item, index) => index !== operation.item_index);
    }
    const afterChecksum = structuredPromptSectionChecksum(after);
    if (afterChecksum === beforeChecksum) {
      throw new StructuredPromptPatchError('PATCH_NOOP', 'Structured prompt patch made no change.');
    }
    document = contentAdminStructuredPromptDocumentSchema.parse({
      ...document,
      [operation.section]: after,
    });
    diff.push({
      operation: operation.operation,
      section: operation.section,
      before,
      after,
      before_checksum: beforeChecksum,
      after_checksum: afterChecksum,
    });
  }
  renderStructuredPromptDocument(document);
  return { document, diff };
}

export function structuredPromptPatchEnvelope(input: {
  document: ContentAdminStructuredPromptDocument;
  operations: ContentAdminStructuredPromptOperation[];
}): StructuredPromptPatchEnvelope {
  return {
    schema_version: STRUCTURED_PROMPT_SCHEMA_VERSION,
    document: contentAdminStructuredPromptDocumentSchema.parse(input.document),
    operations: input.operations.map((operation) =>
      contentAdminStructuredPromptOperationSchema.parse(operation),
    ),
  };
}

export function proposeStructuredPromptAppend(input: {
  document: ContentAdminStructuredPromptDocument;
  section: ContentAdminStructuredPromptSection;
  feedback: string;
}): ContentAdminStructuredPromptOperation {
  return contentAdminStructuredPromptOperationSchema.parse({
    operation: 'append_item',
    section: input.section,
    expected_section_checksum: structuredPromptSectionChecksum(input.document[input.section]),
    item: input.feedback,
  });
}

function cloneDocument(input: ContentAdminStructuredPromptDocument) {
  return contentAdminStructuredPromptDocumentSchema.parse(
    Object.fromEntries(
      STRUCTURED_PROMPT_SECTION_ORDER.map((section) => [section, [...input[section]]]),
    ),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  return {};
}

function instructionAttemptsGuardrailBypass(value: string) {
  const normalized = ` ${value.toLowerCase().replaceAll(/[^a-z0-9\s]/g, ' ')} `;
  const exactPatterns = [
    ' ignore previous ',
    ' ignore safety ',
    ' disable safety ',
    ' remove safety ',
    ' without citations ',
    ' disable citations ',
    ' do not cite ',
    ' dont cite ',
    ' skip citations ',
    ' ignore approved sources ',
    ' do not use approved sources ',
    ' use unapproved sources ',
    ' use outside sources ',
    ' use outside materials ',
    ' use external sources ',
    ' use external materials ',
    ' include private data ',
    ' reveal private data ',
  ];
  if (exactPatterns.some((pattern) => normalized.includes(pattern))) return true;
  const attemptsControlBypass =
    /\b(ignore|disregard|override|disable|remove|omit|bypass)\b/.test(normalized) &&
    /\b(previous|prior|instruction|guardrail|safety|citation|source|privacy|private)\b/.test(
      normalized,
    );
  const attemptsDataExposure =
    /\b(reveal|include|expose|leak|print)\b/.test(normalized) &&
    /\b(private|secret|credential|password|token|learner data)\b/.test(normalized);
  const makesGuardrailOptional =
    /\b(safety|citations?|approved sources?|privacy|guardrails?)\b/.test(normalized) &&
    /\b(optional|unnecessary|not required|irrelevant)\b/.test(normalized);
  const forbidsGrounding =
    /\b(cite|citation|source)\b/.test(normalized) &&
    /\b(nothing|none|never|without)\b/.test(normalized);
  const permitsOutsideMaterial =
    !/\b(do not|dont|never|must not|cannot)\s+(use|consult|rely|draw)\b/.test(normalized) &&
    ((/\b(use|consult|rely|draw)\b/.test(normalized) &&
      /\b(outside|external|unapproved|nonapproved|any available)\b/.test(normalized) &&
      /\b(sources?|materials?|content|information)\b/.test(normalized)) ||
      (/\b(outside|external|unapproved|nonapproved)\b/.test(normalized) &&
        /\b(sources?|materials?|content|information)\b/.test(normalized) &&
        /\b(allowed|permitted|acceptable|reliable)\b/.test(normalized)));
  return (
    attemptsControlBypass ||
    attemptsDataExposure ||
    makesGuardrailOptional ||
    forbidsGrounding ||
    permitsOutsideMaterial
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
