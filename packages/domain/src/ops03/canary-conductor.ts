import { createHash } from 'node:crypto';
import { z } from 'zod';

export const OPS03_TASK_ID = 'OPS-03';
export const OPS03_PACKET_ID = 'ops-03-20260716T035413Z-4ff20771';

export const OPS03_PROVIDERS = [
  'telegram',
  'whatsapp',
  'vimeo',
  'buffer',
  'stripe_test',
  'email',
  'zoom',
] as const;

export type Ops03Provider = (typeof OPS03_PROVIDERS)[number];

export type Ops03ProviderStatus =
  'unconfigured' | 'configured_unverified' | 'ready_for_canary' | 'canary_passed' | 'blocked';

export type Ops03Outcome = 'passed' | 'failed' | 'blocked' | 'not_applicable' | 'not_observed';

export const OPS03_ACTION_BY_PROVIDER: Record<Ops03Provider, string> = {
  telegram: 'telegram.owner_admin_ping',
  whatsapp: 'whatsapp.public_lead_single_turn',
  vimeo: 'vimeo.synthetic_asset_ingest',
  buffer: 'buffer.create_approval_draft',
  stripe_test: 'stripe_test.entitlement_webhook',
  email: 'email.sink_transactional_delivery',
  zoom: 'zoom.issue_learner_launch',
};

const authorizationRecordSchema = z
  .object({
    schema_version: z.literal('1.0.0'),
    task_id: z.literal(OPS03_TASK_ID),
    authorization_id: z.string().regex(/^OPS-03-AUTH-[A-Z0-9][A-Z0-9._-]{5,80}$/),
    provider: z.enum(OPS03_PROVIDERS),
    environment: z.enum(['staging', 'test']),
    integrated_staging_sha: z.string().regex(/^[0-9a-f]{40}$/),
    target_alias: z.string().regex(/^ops03-[a-z0-9][a-z0-9._-]{2,80}$/),
    action: z.enum([
      'telegram.owner_admin_ping',
      'whatsapp.public_lead_single_turn',
      'vimeo.synthetic_asset_ingest',
      'buffer.create_approval_draft',
      'stripe_test.entitlement_webhook',
      'email.sink_transactional_delivery',
      'zoom.issue_learner_launch',
    ]),
    authorized_from: z.string().datetime(),
    authorized_until: z.string().datetime(),
    approver_ref: z.string().regex(/^OPS-03-APPROVER-[A-Z0-9][A-Z0-9._-]{2,80}$/),
    authorization_source_ref: z
      .string()
      .regex(/^OPS-03-SOURCE-[A-Z0-9][A-Z0-9._-]{2,100}$/)
      .optional(),
    cleanup_authorization: z.enum(['authorized', 'separate_approval_required', 'disable_only']),
    notes: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.action !== OPS03_ACTION_BY_PROVIDER[record.provider]) {
      context.addIssue({
        code: 'custom',
        path: ['action'],
        message: 'Authorization action does not match provider.',
      });
    }
    if (record.notes) {
      const findings = scanTextForOps03Leaks(record.notes);
      if (findings.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['notes'],
          message: 'Authorization notes contain unsafe material.',
        });
      }
    }
  });

export type Ops03AuthorizationRecord = z.infer<typeof authorizationRecordSchema>;

export type Ops03AuthorizationValidation = {
  ok: boolean;
  reason_codes: string[];
  provider?: Ops03Provider;
  action?: string;
  authorization_id?: string;
};

export function validateOps03AuthorizationRecord(
  record: unknown,
  options: {
    exactStagingSha?: string;
    provider?: Ops03Provider;
    now?: Date;
  } = {},
): Ops03AuthorizationValidation {
  const parsed = authorizationRecordSchema.safeParse(record);
  if (!parsed.success) {
    return { ok: false, reason_codes: ['OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID'] };
  }
  const now = options.now ?? new Date();
  const validFrom = new Date(parsed.data.authorized_from);
  const validUntil = new Date(parsed.data.authorized_until);
  const reasonCodes: string[] = [];
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    reasonCodes.push('OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID');
  } else if (validFrom.getTime() > now.getTime() || validUntil.getTime() <= now.getTime()) {
    reasonCodes.push('OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID');
  }
  if (options.exactStagingSha && parsed.data.integrated_staging_sha !== options.exactStagingSha) {
    reasonCodes.push('OPS-03-GLOBAL-STAGING-SHA-UNVERIFIED');
  }
  if (options.provider && parsed.data.provider !== options.provider) {
    reasonCodes.push('OPS-03-PROVIDER-AUTHORIZATION-MISSING-OR-INVALID');
  }
  return {
    ok: reasonCodes.length === 0,
    reason_codes: [...new Set(reasonCodes)],
    provider: parsed.data.provider,
    action: parsed.data.action,
    authorization_id: parsed.data.authorization_id,
  };
}

export type Ops03CardinalityInput = {
  targetAliases: readonly string[];
  actions: readonly string[];
};

export function evaluateOps03Cardinality(input: Ops03CardinalityInput): {
  passed: boolean;
  blocker_codes: string[];
} {
  const aliases = new Set(input.targetAliases.filter(Boolean));
  const actions = new Set(input.actions.filter(Boolean));
  const aliasPattern = /^ops03-[a-z0-9][a-z0-9._-]{2,80}$/;
  const actionAllowed = new Set(Object.values(OPS03_ACTION_BY_PROVIDER));
  const aliasOk = aliases.size === 1 && [...aliases].every((alias) => aliasPattern.test(alias));
  const actionOk = actions.size === 1 && [...actions].every((action) => actionAllowed.has(action));
  return {
    passed: aliasOk && actionOk,
    blocker_codes: aliasOk && actionOk ? [] : ['OPS-03-PROVIDER-ONE-TARGET-FAILED'],
  };
}

export type Ops03RedactionFinding = {
  name: string;
  index: number;
};

const redactionPatterns: Array<{ name: string; regex: RegExp }> = [
  { name: 'url', regex: /https?:\/\/[^\s"'<>]+/gi },
  { name: 'authorization header', regex: /\bAuthorization:\s*[A-Za-z0-9._~+/=-]+/gi },
  { name: 'bearer token', regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { name: 'query token', regex: /\b(?:token|secret|api[_-]?key)=\S+/gi },
  { name: 'stripe live key', regex: /\bsk_live_[A-Za-z0-9]{12,}\b/g },
  { name: 'stripe test key', regex: /\bsk_test_[A-Za-z0-9]{12,}\b/g },
  { name: 'stripe webhook secret', regex: /\bwhsec_[A-Za-z0-9]{12,}\b/g },
  { name: 'slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/g },
  { name: 'email address', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  {
    name: 'phone-like number',
    regex: /(?<![A-Za-z0-9_-])(?:\+?\d[\s().-]?){10,}(?![A-Za-z0-9_-])/g,
  },
  { name: 'raw webhook url label', regex: /\bwebhook[_-]?url\b/gi },
  { name: 'raw launch url label', regex: /\blaunch[_-]?url\b/gi },
];

export function scanTextForOps03Leaks(text: string): Ops03RedactionFinding[] {
  const findings: Ops03RedactionFinding[] = [];
  for (const pattern of redactionPatterns) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(text);
    while (match) {
      findings.push({ name: pattern.name, index: match.index });
      match = pattern.regex.exec(text);
    }
  }
  return findings;
}

export function assertOps03RedactionClean(text: string): void {
  const findings = scanTextForOps03Leaks(text);
  if (findings.length > 0) {
    const names = [...new Set(findings.map((finding) => finding.name))].join(', ');
    throw new Error(`OPS-03 redaction scan failed: ${names}`);
  }
}

export function ops03Sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function ops03Fingerprint(value: string): string {
  return ops03Sha256Hex(value).slice(0, 12);
}

export type Ops03StatusInputs = {
  configured: boolean;
  hardBlocked: boolean;
  technicalReady: boolean;
  canaryPassed: boolean;
};

export function decideOps03ProviderStatus(input: Ops03StatusInputs): Ops03ProviderStatus {
  if (!input.configured) return 'unconfigured';
  if (input.hardBlocked) return 'blocked';
  if (!input.technicalReady) return 'configured_unverified';
  return input.canaryPassed ? 'canary_passed' : 'ready_for_canary';
}
