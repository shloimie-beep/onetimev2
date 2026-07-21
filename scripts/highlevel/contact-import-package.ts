import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { inflateRawSync } from 'node:zlib';

type ConsentState = 'opted_in' | 'opted_out' | 'unknown';
type SuppressionState = 'active' | 'suppressed' | 'unknown';

type SourceDefinition = {
  fileName: string;
  classification: string;
  sourceTag: string;
  defaultEmailConsent: ConsentState;
  defaultSuppressionState: SuppressionState;
};

type SourceRow = {
  sourceFile: string;
  sourceClassification: string;
  sourceTag: string;
  rowNumber: number;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  emailConsent: ConsentState;
  whatsappConsent: ConsentState;
  suppressionState: SuppressionState;
  suppressionReason: string | null;
  sourceFingerprint: string;
};

type PreparedContact = {
  contactKey: string;
  identityFingerprint: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  contactSource: string;
  sourceClassifications: string[];
  sourceFingerprints: string[];
  tags: string[];
  dnd: boolean;
  emailConsent: ConsentState;
  whatsappConsent: ConsentState;
  suppressionState: SuppressionState;
  suppressionReason: string | null;
  duplicateSourceRows: number;
  existingGhlContactId: string | null;
  disposition: 'ready' | 'quarantined';
  quarantineReason: string | null;
};

type ProviderContact = {
  id?: string;
  contactId?: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
};

type GhlResult<T> =
  { ok: true; status: number; body: T } | { ok: false; status: number; code: string };

type Args = {
  mode: 'dry_run' | 'apply';
  sourceDir: string;
  privateDir: string;
  activationReport: string;
  maxContacts?: number;
  lookupConcurrency: number;
  requestTimeoutMs: number;
  skipProviderPreflight: boolean;
  emailFirstUpsert: boolean;
};

const approvedSources: SourceDefinition[] = [
  {
    fileName: 'Rabbi Scheller Followers.xlsx',
    classification: 'rabbi_followers',
    sourceTag: 'OT | Source | Rabbi Followers',
    defaultEmailConsent: 'unknown',
    defaultSuppressionState: 'unknown',
  },
  {
    fileName: 'subscribed_email_audience_export_HASH.csv',
    classification: 'subscribed_audience',
    sourceTag: 'OT | Source | Subscribed Audience',
    defaultEmailConsent: 'opted_in',
    defaultSuppressionState: 'active',
  },
  {
    fileName: 'unsubscribed_email_audience_export_HASH.csv',
    classification: 'subscribed_audience',
    sourceTag: 'OT | Source | Subscribed Audience',
    defaultEmailConsent: 'opted_out',
    defaultSuppressionState: 'suppressed',
  },
  {
    fileName: 'cleaned_email_audience_export_HASH.csv',
    classification: 'cleaned_audience',
    sourceTag: 'OT | Source | Cleaned Audience',
    defaultEmailConsent: 'unknown',
    defaultSuppressionState: 'unknown',
  },
  {
    fileName: 'subscribers_detailed.csv',
    classification: 'legacy_subscriber',
    sourceTag: 'OT | Source | Legacy Subscriber',
    defaultEmailConsent: 'opted_in',
    defaultSuppressionState: 'active',
  },
  {
    fileName: 'subscribers.csv',
    classification: 'legacy_subscriber',
    sourceTag: 'OT | Source | Legacy Subscriber',
    defaultEmailConsent: 'opted_in',
    defaultSuppressionState: 'active',
  },
];

const csvColumns = [
  'First Name',
  'Last Name',
  'Email',
  'Phone',
  'Contact Source',
  'Tags',
  'DND',
  'Time Zone',
  'One Time CRM Contact ID',
  'One Time Parent ID',
  'One Time Household ID',
  'One Time Customer Status',
  'One Time Portal Status',
  'One Time Access Status',
  'One Time Signup Source',
  'One Time Import Batch',
  'One Time Source Classification',
  'One Time Email Consent',
  'One Time WhatsApp Consent',
  'One Time Suppression State',
  'One Time Suppression Reason',
  'One Time Last Sync',
] as const;

const batchKey = `one-time-ghl-import-${new Date().toISOString().slice(0, 10)}`;
const accountKey = 'one_time';
const productKey = 'one_time_mishnah_class';
const apiBase = 'https://services.leadconnectorhq.com';
const apiVersion = '2021-07-28';

const args = parseArgs(process.argv.slice(2));
const importsDir = path.join(args.privateDir, 'imports');
const csvPath = path.join(importsDir, 'one-time-ghl-contacts.csv');
const manifestPath = path.join(importsDir, 'one-time-ghl-import-manifest.private.json');
const mapPath = path.join(importsDir, 'one-time-ghl-contact-map.private.json');
const errorsPath = path.join(importsDir, 'one-time-ghl-import-errors.private.json');

await main();

async function main() {
  const credentials = await readCredentials(args.privateDir);
  const assets = await loadAssetRegistry(args.activationReport);
  const sourceHashes = await validateSourceFiles(args.sourceDir);
  const rows = await loadSourceRows(args.sourceDir);
  const existingMap = await readExistingMap(mapPath);
  const prepared = prepareContacts(rows, existingMap);
  const limited = args.maxContacts ? prepared.slice(0, args.maxContacts) : prepared;

  const providerPreflight = args.skipProviderPreflight
    ? buildSkippedProviderPreflight(limited.filter((contact) => contact.disposition === 'ready'))
    : await fetchExistingGhlContacts({
        credentials,
        contacts: limited.filter((contact) => contact.disposition === 'ready'),
      });
  for (const [contactKey, ghlContactId] of providerPreflight.existingByContactKey) {
    const contact = limited.find((entry) => entry.contactKey === contactKey);
    if (contact) contact.existingGhlContactId = ghlContactId;
  }
  for (const conflict of providerPreflight.conflicts) {
    const contact = limited.find((entry) => entry.contactKey === conflict.contactKey);
    if (contact) {
      contact.disposition = 'quarantined';
      contact.quarantineReason = conflict.reason;
      contact.tags = unique([...contact.tags, 'OT | Identity Conflict']);
    }
  }

  await mkdir(importsDir, { recursive: true });
  await writeCsv(
    limited.filter((contact) => contact.disposition === 'ready'),
    csvPath,
  );

  const applyResult =
    args.mode === 'apply'
      ? await applyContacts({
          credentials,
          contacts: limited.filter((contact) => contact.disposition === 'ready'),
          assets,
        })
      : {
          attempted: 0,
          succeeded: 0,
          failed: 0,
          createdPlanned: limited.filter(
            (contact) => contact.disposition === 'ready' && !contact.existingGhlContactId,
          ).length,
          updatedPlanned: limited.filter(
            (contact) => contact.disposition === 'ready' && contact.existingGhlContactId,
          ).length,
          tagAddsAttempted: 0,
          workflowEnrollments: 0,
          messagesSent: 0,
          errors: [] as ImportError[],
          mappings: [] as ContactMapEntry[],
        };

  const mappings = mergeMappings(
    existingMap,
    limited
      .filter((contact) => contact.existingGhlContactId)
      .map((contact) => ({
        contact_key: contact.contactKey,
        ghl_contact_id: contact.existingGhlContactId as string,
        identity_fingerprint: contact.identityFingerprint,
        source_fingerprints: contact.sourceFingerprints,
        status: 'matched_existing' as const,
        updated_at: new Date().toISOString(),
      })),
    applyResult.mappings,
  );

  const manifest = buildManifest({
    mode: args.mode,
    sourceHashes,
    rows,
    contacts: limited,
    providerPreflight,
    applyResult,
    assets,
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(
    mapPath,
    `${JSON.stringify({ generated_at: new Date().toISOString(), mappings }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    errorsPath,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        errors: [
          ...providerPreflight.conflicts,
          ...limited
            .filter((contact) => contact.disposition === 'quarantined')
            .map((contact) => ({
              contactKey: contact.contactKey,
              identityFingerprint: contact.identityFingerprint,
              code: contact.quarantineReason ?? 'quarantined',
            })),
          ...applyResult.errors,
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  writeStdoutJson({
    generatedAt: manifest.generated_at,
    mode: args.mode,
    locationId: credentials.locationId,
    counts: manifest.counts,
    providerPreflight: manifest.provider_preflight,
    apply: manifest.apply,
    protectedOutputs: {
      csv: csvPath,
      manifest: manifestPath,
      contactMap: mapPath,
      errors: errorsPath,
    },
    safety: manifest.safety,
  });
}

async function validateSourceFiles(sourceDir: string) {
  const entries = await readdir(sourceDir);
  const found = new Set(entries);
  const results = [];
  for (const source of approvedSources) {
    const filePath = path.join(sourceDir, source.fileName);
    if (!found.has(source.fileName)) {
      throw new Error(`approved_source_missing:${source.fileName}`);
    }
    results.push({
      file_name: source.fileName,
      classification: source.classification,
      sha256: await sha256File(filePath),
    });
  }
  return results;
}

async function loadSourceRows(sourceDir: string) {
  const rows: SourceRow[] = [];
  for (const source of approvedSources) {
    const filePath = path.join(sourceDir, source.fileName);
    const records =
      path.extname(source.fileName).toLowerCase() === '.xlsx'
        ? parseXlsxRecords(await readFile(filePath), source.fileName)
        : parseDelimitedRecords(await readFile(filePath, 'utf8'), ',')
            .map((row, index, all) => ({
              sheetLabel: 'csv',
              rowNumber: index,
              header: all[0] ?? [],
              values: row,
            }))
            .slice(1);
    for (const record of records) {
      const object = rowToObject(record.header, record.values);
      const sourceRow = normalizeSourceRow(source, record.rowNumber, object);
      if (sourceRow) rows.push(sourceRow);
    }
  }
  return rows;
}

function normalizeSourceRow(
  source: SourceDefinition,
  rowNumber: number,
  row: Record<string, string>,
): SourceRow | null {
  const email = normalizeEmail(readCell(row, ['Email Address', 'email', 'user_email']));
  const phone = normalizePhone(readCell(row, ['Phone Number', 'phone', 'telephone', 'mobile']));
  const rawFirstName = readCell(row, ['First Name', 'first_name']);
  const rawLastName = readCell(row, ['Last Name', 'last_name']);
  const rawName = readCell(row, ['name', 'user_name', 'display_name', 'full_name']);
  const split = splitName(rawName);
  const firstName = cleanName(rawFirstName ?? split.firstName);
  const lastName = cleanName(rawLastName ?? split.lastName);
  const displayName = cleanName([firstName, lastName].filter(Boolean).join(' ') || rawName);
  const status = normalizeToken(
    readCell(row, ['status', 'action', 'action_type', 'marketing_opt_in']),
  );
  const sourceTags = normalizeToken(readCell(row, ['TAGS', 'tags', 'plan']));
  const timeZone = readCell(row, ['TIMEZONE', 'Time Zone', 'timezone']) ?? null;
  const explicitSuppression =
    source.defaultSuppressionState === 'suppressed' ||
    /unsub|opt_out|complaint|bounce|cleaned|abuse/.test(status) ||
    /unsub|suppressed|do_not_contact|cleaned/.test(sourceTags);
  const explicitOptIn =
    source.defaultEmailConsent === 'opted_in' ||
    /subscribed|active|opt_in|true|yes/.test(status) ||
    /subscribed|member|active/.test(sourceTags);
  const emailConsent: ConsentState = explicitSuppression
    ? 'opted_out'
    : explicitOptIn
      ? 'opted_in'
      : source.defaultEmailConsent;
  const suppressionState: SuppressionState = explicitSuppression
    ? 'suppressed'
    : source.defaultSuppressionState;
  const suppressionReason = explicitSuppression
    ? source.fileName.includes('unsubscribed')
      ? 'source_unsubscribed_export'
      : 'source_suppression_signal'
    : null;

  if (!email && !phone && !displayName) return null;

  return {
    sourceFile: source.fileName,
    sourceClassification: source.classification,
    sourceTag: source.sourceTag,
    rowNumber,
    firstName,
    lastName,
    displayName,
    email,
    phone,
    timeZone,
    emailConsent,
    whatsappConsent: 'unknown',
    suppressionState,
    suppressionReason,
    sourceFingerprint: stableDigest([
      source.fileName,
      String(rowNumber),
      email ?? '',
      phone ?? '',
      displayName ?? '',
    ]),
  };
}

function prepareContacts(rows: SourceRow[], existingMap: ContactMapEntry[]) {
  const byIdentity = new Map<string, SourceRow[]>();
  const phoneToEmails = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.email && row.phone) {
      const emails = phoneToEmails.get(row.phone) ?? new Set<string>();
      emails.add(row.email);
      phoneToEmails.set(row.phone, emails);
    }
    const key = row.email ? `email:${row.email}` : row.phone ? `phone:${row.phone}` : null;
    if (!key) continue;
    const group = byIdentity.get(key) ?? [];
    group.push(row);
    byIdentity.set(key, group);
  }

  const existingByKey = new Map(
    existingMap.map((entry) => [entry.contact_key, entry.ghl_contact_id]),
  );
  const contacts: PreparedContact[] = [];
  for (const [identityKey, group] of byIdentity) {
    const first = group[0];
    if (!first) continue;
    const email = first.email ?? group.find((row) => row.email)?.email ?? null;
    const phone = first.phone ?? group.find((row) => row.phone)?.phone ?? null;
    const identityFingerprint = stableDigest([identityKey]);
    const contactKey = stableKey('crm_real_source_contact', [
      accountKey,
      productKey,
      identityFingerprint,
    ]);
    const suppressionState = strongestSuppression(group);
    const emailConsent = strongestEmailConsent(group, suppressionState);
    const sourceClassifications = unique(group.map((row) => row.sourceClassification));
    const sourceTags = unique(group.map((row) => row.sourceTag));
    const tags = buildTags({
      sourceTags,
      emailConsent,
      whatsappConsent: 'unknown',
      suppressionState,
      duplicateSourceRows: group.length,
    });
    const phoneEmailConflict =
      phone && phoneToEmails.get(phone) && (phoneToEmails.get(phone)?.size ?? 0) > 1;
    contacts.push({
      contactKey,
      identityFingerprint,
      firstName: group.find((row) => row.firstName)?.firstName ?? null,
      lastName: group.find((row) => row.lastName)?.lastName ?? null,
      email,
      phone,
      timeZone: group.find((row) => row.timeZone)?.timeZone ?? null,
      contactSource: 'One Time approved CRM import',
      sourceClassifications,
      sourceFingerprints: unique(group.map((row) => row.sourceFingerprint)),
      tags,
      dnd: suppressionState === 'suppressed',
      emailConsent,
      whatsappConsent: 'unknown',
      suppressionState,
      suppressionReason:
        group.find((row) => row.suppressionReason)?.suppressionReason ??
        (suppressionState === 'suppressed' ? 'source_suppression_precedence' : null),
      duplicateSourceRows: group.length,
      existingGhlContactId: existingByKey.get(contactKey) ?? null,
      disposition: phoneEmailConflict ? 'quarantined' : 'ready',
      quarantineReason: phoneEmailConflict ? 'phone_resolves_to_multiple_emails' : null,
    });
  }

  for (const row of rows.filter((entry) => !entry.email && !entry.phone)) {
    const identityFingerprint = stableDigest([row.sourceFingerprint]);
    contacts.push({
      contactKey: stableKey('crm_real_source_contact', [
        accountKey,
        productKey,
        identityFingerprint,
      ]),
      identityFingerprint,
      firstName: row.firstName,
      lastName: row.lastName,
      email: null,
      phone: null,
      timeZone: row.timeZone,
      contactSource: 'One Time approved CRM import',
      sourceClassifications: [row.sourceClassification],
      sourceFingerprints: [row.sourceFingerprint],
      tags: ['OT | Identity Conflict'],
      dnd: true,
      emailConsent: row.emailConsent,
      whatsappConsent: 'unknown',
      suppressionState: 'suppressed',
      suppressionReason: 'missing_email_and_phone',
      duplicateSourceRows: 1,
      existingGhlContactId: null,
      disposition: 'quarantined',
      quarantineReason: 'missing_email_and_phone',
    });
  }

  return contacts.sort((a, b) => a.contactKey.localeCompare(b.contactKey));
}

async function fetchExistingGhlContacts(input: {
  credentials: Credentials;
  contacts: PreparedContact[];
}) {
  const existingByContactKey = new Map<string, string>();
  const conflicts: Array<{
    contactKey: string;
    identityFingerprint: string;
    code: string;
    reason: string;
  }> = [];
  let exactExistingMatches = 0;
  let searches = 0;
  let processed = 0;
  let cursor = 0;
  const concurrency = Math.min(args.lookupConcurrency, Math.max(1, input.contacts.length));

  async function scanNext() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const contact = input.contacts[index];
      if (!contact) return;
      await scanContact(contact);
      processed += 1;
      if (processed % 250 === 0) {
        process.stderr.write(
          `highlevel_duplicate_scan_progress=${processed}/${input.contacts.length}\n`,
        );
      }
    }
  }

  async function scanContact(contact: PreparedContact) {
    if (contact.existingGhlContactId) {
      existingByContactKey.set(contact.contactKey, contact.existingGhlContactId);
      exactExistingMatches += 1;
      return;
    }
    const emailLookup = contact.email
      ? await findDuplicateContact(input.credentials, { email: contact.email })
      : { result: null, searches: 0 };
    const phoneLookup = contact.phone
      ? await findDuplicateContact(input.credentials, { phone: contact.phone })
      : { result: null, searches: 0 };
    searches += emailLookup.searches + phoneLookup.searches;
    if (emailLookup.result && !emailLookup.result.ok) {
      conflicts.push({
        contactKey: contact.contactKey,
        identityFingerprint: contact.identityFingerprint,
        code: emailLookup.result.code,
        reason: `email_search_failed:${emailLookup.result.status}:${emailLookup.result.code}`,
      });
      return;
    }
    if (phoneLookup.result && !phoneLookup.result.ok) {
      conflicts.push({
        contactKey: contact.contactKey,
        identityFingerprint: contact.identityFingerprint,
        code: phoneLookup.result.code,
        reason: `phone_search_failed:${phoneLookup.result.status}:${phoneLookup.result.code}`,
      });
      return;
    }
    const emailMatch = emailLookup.result?.body ?? undefined;
    const phoneMatch = phoneLookup.result?.body ?? undefined;
    const emailId = providerContactId(emailMatch);
    const phoneId = providerContactId(phoneMatch);
    if (emailId && phoneId && emailId !== phoneId) {
      conflicts.push({
        contactKey: contact.contactKey,
        identityFingerprint: contact.identityFingerprint,
        code: 'email_phone_existing_conflict',
        reason: 'email_and_phone_resolve_to_different_ghl_contacts',
      });
      return;
    }
    const id = emailId ?? phoneId ?? null;
    if (id) {
      existingByContactKey.set(contact.contactKey, id);
      exactExistingMatches += 1;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, scanNext));
  return {
    searches,
    exactExistingMatches,
    existingByContactKey,
    conflicts,
  };
}

async function findDuplicateContact(
  credentials: Credentials,
  input: { email?: string; phone?: string },
): Promise<{ result: GhlResult<ProviderContact | null>; searches: number }> {
  const params = new URLSearchParams({ locationId: credentials.locationId });
  if (input.email) params.set('email', input.email);
  if (input.phone) params.set('phone', input.phone);
  const result = await ghlRequest<Record<string, unknown>>(
    credentials,
    'GET',
    `/contacts/search/duplicate?${params.toString()}`,
  );
  if (!result.ok) return { result, searches: 1 };
  return {
    result: { ok: true, status: result.status, body: extractProviderContact(result.body) },
    searches: 1,
  };
}

function extractProviderContact(value: unknown): ProviderContact | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const candidate = object.contact ?? object.duplicateContact ?? object;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const contact = candidate as ProviderContact;
  return providerContactId(contact) ? contact : null;
}

async function applyContacts(input: {
  credentials: Credentials;
  contacts: PreparedContact[];
  assets: AssetRegistry;
}) {
  const errors: ImportError[] = [];
  const mappings: ContactMapEntry[] = [];
  let attempted = 0;
  let succeeded = 0;
  let tagAddsAttempted = 0;
  let processed = 0;
  for (const contact of input.contacts) {
    attempted += 1;
    const upsert = await ghlRequest<{ contact?: ProviderContact; id?: string }>(
      input.credentials,
      'POST',
      '/contacts/upsert',
      buildUpsertPayload(contact, input.credentials, input.assets),
    );
    if (!upsert.ok) {
      errors.push(providerImportError(contact, `upsert_failed:${upsert.status}:${upsert.code}`));
      processed += 1;
      if (processed % 25 === 0)
        writeApplyProgress(processed, input.contacts.length, succeeded, errors.length);
      await delay(100);
      continue;
    }
    const contactId = providerContactId(upsert.body.contact) ?? upsert.body.id ?? null;
    if (!contactId) {
      errors.push(providerImportError(contact, 'upsert_missing_contact_id'));
      processed += 1;
      if (processed % 25 === 0)
        writeApplyProgress(processed, input.contacts.length, succeeded, errors.length);
      continue;
    }
    const tagResult = await ghlRequest<Record<string, unknown>>(
      input.credentials,
      'POST',
      `/contacts/${encodeURIComponent(contactId)}/tags`,
      {
        tags: contact.tags,
      },
    );
    tagAddsAttempted += 1;
    if (!tagResult.ok) {
      errors.push(
        providerImportError(contact, `tag_add_failed:${tagResult.status}:${tagResult.code}`),
      );
      processed += 1;
      if (processed % 25 === 0)
        writeApplyProgress(processed, input.contacts.length, succeeded, errors.length);
      continue;
    }
    succeeded += 1;
    mappings.push({
      contact_key: contact.contactKey,
      ghl_contact_id: contactId,
      identity_fingerprint: contact.identityFingerprint,
      source_fingerprints: contact.sourceFingerprints,
      status: contact.existingGhlContactId ? 'updated' : 'upserted',
      updated_at: new Date().toISOString(),
    });
    processed += 1;
    if (processed % 25 === 0)
      writeApplyProgress(processed, input.contacts.length, succeeded, errors.length);
    await delay(120);
  }
  return {
    attempted,
    succeeded,
    failed: errors.length,
    createdPlanned: input.contacts.filter((contact) => !contact.existingGhlContactId).length,
    updatedPlanned: input.contacts.filter((contact) => contact.existingGhlContactId).length,
    tagAddsAttempted,
    workflowEnrollments: 0,
    messagesSent: 0,
    errors,
    mappings,
  };
}

function writeApplyProgress(processed: number, total: number, succeeded: number, failed: number) {
  process.stderr.write(
    `highlevel_apply_progress=${processed}/${total};succeeded=${succeeded};failed=${failed}\n`,
  );
}

function buildUpsertPayload(
  contact: PreparedContact,
  credentials: Credentials,
  assets: AssetRegistry,
) {
  const customFields = {
    'One Time CRM Contact ID': contact.contactKey,
    'One Time Import Batch': batchKey,
    'One Time Source Classification': contact.sourceClassifications.join(','),
    'One Time Email Consent': contact.emailConsent,
    'One Time WhatsApp Consent': contact.whatsappConsent,
    'One Time Suppression State': contact.suppressionState,
    'One Time Suppression Reason': contact.suppressionReason,
    'One Time Last Sync': new Date().toISOString(),
    'One Time Signup Source': contact.sourceClassifications.join(','),
    'One Time Customer Status': contact.suppressionState === 'suppressed' ? 'suppressed' : 'lead',
    'One Time Portal Status': 'not_invited',
    'One Time Access Status': 'prelaunch',
  };
  return {
    locationId: credentials.locationId,
    firstName: contact.firstName ?? undefined,
    lastName: contact.lastName ?? undefined,
    email: contact.email ?? undefined,
    phone: args.emailFirstUpsert && contact.email ? undefined : (contact.phone ?? undefined),
    source: contact.contactSource,
    dnd: contact.dnd,
    customFields: Object.entries(customFields)
      .map(([label, value]) => {
        const key = assets.fieldKeysByLabel.get(label);
        if (!key || value === null || value === undefined || value === '') return null;
        return { key, value };
      })
      .filter((entry): entry is { key: string; value: string } => Boolean(entry)),
  };
}

async function loadAssetRegistry(reportPath: string): Promise<AssetRegistry> {
  const raw = JSON.parse(await readFile(reportPath, 'utf8')) as {
    customFields?: Array<{ name?: string; fieldKey?: string | null; id?: string | null }>;
    tags?: Array<{ name?: string; id?: string | null }>;
  };
  const fieldKeysByLabel = new Map<string, string>();
  for (const field of raw.customFields ?? []) {
    if (field.name && field.fieldKey) fieldKeysByLabel.set(field.name, field.fieldKey);
  }
  const requiredFields = [
    'One Time CRM Contact ID',
    'One Time Import Batch',
    'One Time Source Classification',
    'One Time Email Consent',
    'One Time WhatsApp Consent',
    'One Time Suppression State',
    'One Time Suppression Reason',
    'One Time Last Sync',
  ];
  const missing = requiredFields.filter((field) => !fieldKeysByLabel.has(field));
  if (missing.length) throw new Error(`missing_custom_field_keys:${missing.join(',')}`);
  return {
    fieldKeysByLabel,
    customFieldCount: raw.customFields?.length ?? 0,
    tagCount: raw.tags?.length ?? 0,
  };
}

function buildManifest(input: {
  mode: 'dry_run' | 'apply';
  sourceHashes: Array<{ file_name: string; classification: string; sha256: string }>;
  rows: SourceRow[];
  contacts: PreparedContact[];
  providerPreflight: Awaited<ReturnType<typeof fetchExistingGhlContacts>>;
  applyResult: Awaited<ReturnType<typeof applyContacts>>;
  assets: AssetRegistry;
}) {
  const ready = input.contacts.filter((contact) => contact.disposition === 'ready');
  const quarantined = input.contacts.filter((contact) => contact.disposition === 'quarantined');
  const suppressed = ready.filter((contact) => contact.suppressionState === 'suppressed');
  const emailEligible = ready.filter(
    (contact) => contact.emailConsent === 'opted_in' && contact.suppressionState !== 'suppressed',
  );
  const whatsappEligible = ready.filter(
    (contact) =>
      contact.whatsappConsent === 'opted_in' && contact.suppressionState !== 'suppressed',
  );
  return {
    schema_version: 'one_time.highlevel_contact_import.v1',
    generated_at: new Date().toISOString(),
    mode: input.mode,
    batch_key: batchKey,
    location_id: 'pBSnOK2nkdxp6gf9Rg3o',
    source_hashes: input.sourceHashes.map((entry) => ({
      file_name: entry.file_name,
      classification: entry.classification,
      sha256_fingerprint: entry.sha256.slice(0, 16),
    })),
    assets: {
      custom_field_count: input.assets.customFieldCount,
      tag_count: input.assets.tagCount,
    },
    counts: {
      source_rows: input.rows.length,
      source_contacts: input.contacts.length,
      ready_contacts: ready.length,
      exact_existing_matches: input.providerPreflight.exactExistingMatches,
      new_contacts: ready.filter((contact) => !contact.existingGhlContactId).length,
      updates: ready.filter((contact) => contact.existingGhlContactId).length,
      email_conflicts: input.providerPreflight.conflicts.filter((entry) =>
        entry.code.includes('email'),
      ).length,
      phone_conflicts: input.providerPreflight.conflicts.filter((entry) =>
        entry.code.includes('phone'),
      ).length,
      quarantined: quarantined.length,
      suppressed: suppressed.length,
      email_eligible: emailEligible.length,
      whatsapp_eligible: whatsappEligible.length,
    },
    provider_preflight: {
      searches: input.providerPreflight.searches,
      conflicts: input.providerPreflight.conflicts.length,
      duplicate_preferences_verified: 'blocked_api_surface_not_available_in_repo_tooling',
      duplicate_lookup_mode: args.skipProviderPreflight
        ? 'skipped_email_first_upsert'
        : 'provider_duplicate_endpoint',
      rollback_plan:
        'Use private contact map to review created/updated GHL IDs; remove import tags or merge contacts manually in GHL if rollback is required. No workflows were enrolled and no messages were sent.',
    },
    apply: {
      attempted: input.applyResult.attempted,
      succeeded: input.applyResult.succeeded,
      failed: input.applyResult.failed,
      created_planned: input.applyResult.createdPlanned,
      updated_planned: input.applyResult.updatedPlanned,
      tag_adds_attempted: input.applyResult.tagAddsAttempted,
      workflow_enrollments: input.applyResult.workflowEnrollments,
      messages_sent: input.applyResult.messagesSent,
    },
    outputs: {
      csv: csvPath,
      manifest: manifestPath,
      contact_map: mapPath,
      errors: errorsPath,
    },
    safety: {
      raw_values_printed: false,
      raw_values_committed: false,
      source_rows_committed: false,
      full_contact_payloads_printed: false,
      full_tags_array_sent_through_upsert: false,
      dedicated_add_tags_api_used: true,
      email_first_upsert_without_phone_when_email_present: args.emailFirstUpsert,
      workflow_enrollments: input.applyResult.workflowEnrollments,
      messages_sent: input.applyResult.messagesSent,
      stripe_mutations: 0,
    },
  };
}

function buildSkippedProviderPreflight(contacts: PreparedContact[]) {
  return {
    searches: 0,
    exactExistingMatches: contacts.filter((contact) => contact.existingGhlContactId).length,
    existingByContactKey: new Map(
      contacts
        .filter((contact) => contact.existingGhlContactId)
        .map((contact) => [contact.contactKey, contact.existingGhlContactId as string]),
    ),
    conflicts: [] as Array<{
      contactKey: string;
      identityFingerprint: string;
      code: string;
      reason: string;
    }>,
  };
}

function buildTags(input: {
  sourceTags: string[];
  emailConsent: ConsentState;
  whatsappConsent: ConsentState;
  suppressionState: SuppressionState;
  duplicateSourceRows: number;
}) {
  const tags = new Set<string>(['OT | Lead', ...input.sourceTags]);
  if (input.suppressionState !== 'suppressed') tags.add('OT | Prelaunch');
  if (input.emailConsent === 'opted_in') tags.add('OT | Email Opt-In');
  if (input.whatsappConsent === 'opted_in') tags.add('OT | WhatsApp Opt-In');
  if (input.emailConsent === 'unknown' && input.whatsappConsent === 'unknown') {
    tags.add('OT | Consent Unknown');
  }
  if (input.suppressionState === 'suppressed') tags.add('OT | Marketing Suppressed');
  if (input.duplicateSourceRows > 1) tags.add('OT | Duplicate Merged');
  return Array.from(tags).sort();
}

async function writeCsv(contacts: PreparedContact[], filePath: string) {
  const rows = [
    csvColumns,
    ...contacts.map((contact) => [
      contact.firstName ?? '',
      contact.lastName ?? '',
      contact.email ?? '',
      contact.phone ?? '',
      contact.contactSource,
      contact.tags.join('; '),
      contact.dnd ? 'TRUE' : 'FALSE',
      contact.timeZone ?? '',
      contact.contactKey,
      '',
      '',
      contact.suppressionState === 'suppressed' ? 'suppressed' : 'lead',
      'not_invited',
      'prelaunch',
      contact.sourceClassifications.join(','),
      batchKey,
      contact.sourceClassifications.join(','),
      contact.emailConsent,
      contact.whatsappConsent,
      contact.suppressionState,
      contact.suppressionReason ?? '',
      new Date().toISOString(),
    ]),
  ];
  await writeFile(
    filePath,
    rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n',
    'utf8',
  );
}

async function ghlRequest<T>(
  credentials: Credentials,
  method: string,
  apiPath: string,
  body?: unknown,
): Promise<GhlResult<T>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${credentials.pit}`,
    version: apiVersion,
  };
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let lastRetryableStatus = 0;
  let lastRetryableCode = 'retry_exhausted';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.requestTimeoutMs);
    init.signal = controller.signal;
    try {
      const response = await fetch(`${apiBase}${apiPath}`, init);
      const parsed = await parseJson(response);
      if (response.ok) return { ok: true, status: response.status, body: parsed as T };
      const code = providerErrorCode(parsed);
      if (response.status === 429 || response.status >= 500) {
        lastRetryableStatus = response.status;
        lastRetryableCode = code;
        await delay(500 * 2 ** attempt);
        continue;
      }
      return { ok: false, status: response.status, code };
    } catch {
      if (attempt === 3) return { ok: false, status: 0, code: 'network_error' };
      await delay(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    ok: false,
    status: lastRetryableStatus,
    code: `retry_exhausted:${lastRetryableCode}`,
  };
}

async function readCredentials(privateDir: string) {
  return {
    locationId: await readPrivateTrimmed(privateDir, 'location-id.txt'),
    pit: await readPrivateTrimmed(privateDir, 'pit-sync.txt'),
  };
}

async function readPrivateTrimmed(privateDir: string, fileName: string) {
  const value = (await readFile(path.join(privateDir, fileName), 'utf8')).trim();
  if (!value) throw new Error(`private_file_empty:${fileName}`);
  return value;
}

async function readExistingMap(filePath: string): Promise<ContactMapEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as { mappings?: ContactMapEntry[] };
    return Array.isArray(parsed.mappings) ? parsed.mappings : [];
  } catch {
    return [];
  }
}

function mergeMappings(...sets: ContactMapEntry[][]) {
  const byKey = new Map<string, ContactMapEntry>();
  for (const set of sets) {
    for (const entry of set) byKey.set(entry.contact_key, entry);
  }
  return Array.from(byKey.values()).sort((a, b) => a.contact_key.localeCompare(b.contact_key));
}

function parseDelimitedRecords(input: string, delimiter: ',' | '\t') {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char ?? '';
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char ?? '';
  }
  row.push(cell);
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row);
  return rows;
}

function parseXlsxRecords(buffer: Buffer, sourceFile: string) {
  const entries = readZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const sharedXml = byName.get('xl/sharedStrings.xml')
    ? readZipEntry(buffer, byName.get('xl/sharedStrings.xml') as ZipEntry).toString('utf8')
    : '';
  const sharedStrings = Array.from(sharedXml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) =>
    Array.from(match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1] ?? ''))
      .join(''),
  );
  const workbook = readZipEntry(buffer, byName.get('xl/workbook.xml') as ZipEntry).toString('utf8');
  const relsXml = readZipEntry(
    buffer,
    byName.get('xl/_rels/workbook.xml.rels') as ZipEntry,
  ).toString('utf8');
  const rels = new Map(
    Array.from(relsXml.matchAll(/<Relationship\b([^>]*)\/?/g))
      .map((match) => [attr(match[1] ?? '', 'Id'), attr(match[1] ?? '', 'Target')])
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );
  const records: Array<{
    sheetLabel: string;
    rowNumber: number;
    header: string[];
    values: string[];
  }> = [];
  for (const sheet of Array.from(workbook.matchAll(/<sheet\b([^>]*)\/?/g))) {
    const sheetName = decodeXml(attr(sheet[1] ?? '', 'name') ?? sourceFile);
    const relationshipId = attr(sheet[1] ?? '', 'r:id');
    if (!relationshipId) continue;
    let target = rels.get(relationshipId) ?? '';
    target = target.replace(/^\/+/, '');
    if (!target.startsWith('xl/')) target = path.posix.normalize(`xl/${target}`);
    const sheetEntry = byName.get(target);
    if (!sheetEntry) continue;
    const rows = parseXlsxSheet(readZipEntry(buffer, sheetEntry).toString('utf8'), sharedStrings);
    const header = rows[0] ?? [];
    rows.slice(1).forEach((values, index) => {
      records.push({ sheetLabel: sheetName, rowNumber: index + 2, header, values });
    });
  }
  return records;
}

function parseXlsxSheet(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const values: string[] = [];
    for (const cellMatch of rowMatch[1]?.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g) ?? []) {
      const attrs = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const ref = attr(attrs, 'r') ?? '';
      const type = attr(attrs, 't');
      let value = '';
      if (type === 's') {
        const index = Number(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? -1);
        value = Number.isInteger(index) ? (sharedStrings[index] ?? '') : '';
      } else if (type === 'inlineStr') {
        value = decodeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '');
      } else {
        value = decodeXml(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? '');
      }
      values[columnIndex(ref)] = value;
    }
    rows.push(values.map((value) => value ?? ''));
  }
  return rows;
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
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return data;
  if (entry.compressionMethod === 8) return inflateRawSync(data);
  throw new Error(`unsupported_xlsx_zip_method:${entry.compressionMethod}`);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('missing_zip_directory');
}

function rowToObject(header: string[], row: string[]) {
  const object: Record<string, string> = {};
  header.forEach((name, index) => {
    object[name || `column_${index + 1}`] = row[index] ?? '';
  });
  return object;
}

function readCell(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeHeader(key);
    for (const [rawKey, value] of Object.entries(row)) {
      if (normalizeHeader(rawKey) === normalizedKey) return value.trim() || undefined;
    }
  }
  return undefined;
}

function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? '';
  if (!trimmed || !trimmed.includes('@')) return null;
  return trimmed;
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D+/g, '') ?? '';
  if (!digits) return null;
  let normalized: string;
  if (digits.startsWith('00')) normalized = `+${digits.slice(2)}`;
  else if (digits.startsWith('972')) normalized = `+${digits}`;
  else if (digits.startsWith('0')) normalized = `+972${digits.slice(1)}`;
  else normalized = `+${digits}`;
  const finalDigits = normalized.slice(1);
  if (finalDigits.length < 8 || finalDigits.length > 15) return null;
  return normalized;
}

function splitName(value?: string | null) {
  const normalized = cleanName(value);
  if (!normalized) return { firstName: null, lastName: null };
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(' ') || null };
}

function cleanName(value?: string | null) {
  const trimmed = value?.replace(/\s+/g, ' ').trim() ?? '';
  return trimmed || null;
}

function strongestSuppression(group: SourceRow[]): SuppressionState {
  if (
    group.some((row) => row.suppressionState === 'suppressed' || row.emailConsent === 'opted_out')
  ) {
    return 'suppressed';
  }
  if (group.some((row) => row.suppressionState === 'active')) return 'active';
  return 'unknown';
}

function strongestEmailConsent(
  group: SourceRow[],
  suppressionState: SuppressionState,
): ConsentState {
  if (suppressionState === 'suppressed') return 'opted_out';
  if (group.some((row) => row.emailConsent === 'opted_in')) return 'opted_in';
  return 'unknown';
}

function normalizeToken(value?: string) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function normalizeHeader(value: string) {
  return decodeXml(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function stableKey(prefix: string, parts: string[]) {
  return `${prefix}_${stableDigest(parts).slice(0, 24)}`;
}

function stableDigest(parts: string[]) {
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

async function sha256File(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function providerContactId(contact?: ProviderContact) {
  return contact?.id ?? contact?.contactId ?? null;
}

function providerImportError(contact: PreparedContact, code: string): ImportError {
  return {
    contactKey: contact.contactKey,
    identityFingerprint: contact.identityFingerprint,
    code,
  };
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerErrorCode(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'provider_error';
  const object = value as Record<string, unknown>;
  const code = object.code ?? object.error ?? object.message;
  return typeof code === 'string' ? sanitizeProviderCode(code) : 'provider_error';
}

function sanitizeProviderCode(value: string) {
  return value
    .replace(/pit-[a-z0-9-]+/gi, '[REDACTED:PIT]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[REDACTED_PHONE]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 120);
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function attr(attrs: string, name: string) {
  const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return attrs.match(new RegExp(`${escaped}="([^"]*)"`))?.[1] ?? null;
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? '';
  if (!letters) return -1;
  return letters.split('').reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function writeStdoutJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv: string[]): Args {
  const parsed: Args = {
    mode: 'dry_run',
    sourceDir: 'C:/Users/User/.onetime-w13-104-private/crm-approved-source-packet',
    privateDir: 'C:/Users/User/.onetime-highlevel-private',
    activationReport: 'C:/Users/User/.onetime-highlevel-private/activation-report-idempotent.json',
    lookupConcurrency: 8,
    requestTimeoutMs: 15_000,
    skipProviderPreflight: false,
    emailFirstUpsert: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) continue;
    if (value === '--apply') parsed.mode = 'apply';
    else if (value === '--dry-run') parsed.mode = 'dry_run';
    else if (value === '--source-dir') parsed.sourceDir = argv[(index += 1)] ?? parsed.sourceDir;
    else if (value === '--private-dir') parsed.privateDir = argv[(index += 1)] ?? parsed.privateDir;
    else if (value === '--activation-report') {
      parsed.activationReport = argv[(index += 1)] ?? parsed.activationReport;
    } else if (value === '--max-contacts') {
      parsed.maxContacts = Number(argv[(index += 1)]);
    } else if (value === '--lookup-concurrency') {
      parsed.lookupConcurrency = Number(argv[(index += 1)]);
    } else if (value === '--request-timeout-ms') {
      parsed.requestTimeoutMs = Number(argv[(index += 1)]);
    } else if (value === '--skip-provider-preflight') {
      parsed.skipProviderPreflight = true;
    } else if (value === '--include-phone-with-email') {
      parsed.emailFirstUpsert = false;
    } else if (value.startsWith('--source-dir=')) parsed.sourceDir = value.slice(13);
    else if (value.startsWith('--private-dir=')) parsed.privateDir = value.slice(14);
    else if (value.startsWith('--activation-report=')) {
      parsed.activationReport = value.slice('--activation-report='.length);
    } else if (value.startsWith('--max-contacts=')) {
      parsed.maxContacts = Number(value.slice('--max-contacts='.length));
    } else if (value.startsWith('--lookup-concurrency=')) {
      parsed.lookupConcurrency = Number(value.slice('--lookup-concurrency='.length));
    } else if (value.startsWith('--request-timeout-ms=')) {
      parsed.requestTimeoutMs = Number(value.slice('--request-timeout-ms='.length));
    } else if (value === '--skip-provider-preflight=true') {
      parsed.skipProviderPreflight = true;
    } else if (value === '--email-first-upsert=false') {
      parsed.emailFirstUpsert = false;
    }
  }
  if (!Number.isFinite(parsed.lookupConcurrency) || parsed.lookupConcurrency < 1) {
    parsed.lookupConcurrency = 1;
  }
  if (!Number.isFinite(parsed.requestTimeoutMs) || parsed.requestTimeoutMs < 1000) {
    parsed.requestTimeoutMs = 15_000;
  }
  return parsed;
}

type Credentials = { locationId: string; pit: string };
type AssetRegistry = {
  fieldKeysByLabel: Map<string, string>;
  customFieldCount: number;
  tagCount: number;
};
type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};
type ImportError = { contactKey: string; identityFingerprint: string; code: string };
type ContactMapEntry = {
  contact_key: string;
  ghl_contact_id: string;
  identity_fingerprint: string;
  source_fingerprints: string[];
  status: 'matched_existing' | 'updated' | 'upserted';
  updated_at: string;
};
