import {
  isLowercaseSha256,
  isNonEmptyString,
  isPlaceholder,
  issue,
  parseTimestamp,
  result,
  type ValidationIssue,
} from './validation.ts';
import { validateEnvironmentIdentity } from './environment.ts';

export const REQUIRED_LEGAL_ARTIFACTS = {
  terms: { path: 'legal/terms-of-service.html', route: '/terms' },
  privacy: { path: 'legal/privacy-notice.html', route: '/privacy' },
  student_data_and_recording_consent: {
    path: 'legal/student-data-and-recording-consent.html',
    route: 'student_creation_and_prejoin_consent',
  },
  cancellation: {
    path: 'legal/cancellation-policy.html',
    route: '/cancellation-refund',
  },
  refund: {
    path: 'legal/refund-policy.html',
    route: '/cancellation-refund',
  },
} as const;

export type LegalArtifactKey = keyof typeof REQUIRED_LEGAL_ARTIFACTS;

export interface LegalArtifactEvidence {
  key: string;
  path: string;
  route: string;
  external_file_id: string;
  policy_version: string;
  effective_at: string;
  supersedes_version: string | null;
  superseded_by_version: string | null;
  external_file_id_readback_verified: boolean;
  file_sha256: string;
  rendered_sha256: string;
  product_owner_approved_sha256: string;
  legal_reviewer_approved_sha256: string;
  production_render_read_at: string;
}

export interface LegalPolicyGateInput {
  evidence_kind: 'external_legal_policy_bundle';
  verification_environment_id: string;
  runtime_tier: string;
  credential_boundary: string;
  manifest_path: 'legal/legal-policy-manifest.json';
  manifest_sha256: string;
  release_manifest_legal_manifest_sha256: string;
  acceptance_evidence_legal_manifest_sha256: string;
  product_owner_full_name: string;
  product_owner_approved_at: string;
  qualified_legal_reviewer_full_name: string;
  qualified_legal_reviewer_credential_or_firm: string;
  legal_approved_at: string;
  review_scope: readonly string[];
  repository_sha: string;
  application_content_sha: string;
  release_configuration_digest: string;
  artifacts: readonly LegalArtifactEvidence[];
}

function validateNamedPerson(issues: ValidationIssue[], value: unknown, path: string): void {
  if (
    !isNonEmptyString(value) ||
    isPlaceholder(value) ||
    /^(?:product owner|qualified legal reviewer|legal reviewer|administrator|admin)$/i.test(
      value.trim(),
    ) ||
    value.trim().split(/\s+/).length < 2
  ) {
    issues.push(
      issue(
        'LEGAL_NAMED_PERSON_REQUIRED',
        path,
        'A non-placeholder full person name is required; a role label is insufficient.',
      ),
    );
  }
}

export function validateLegalPolicyGate(
  input: LegalPolicyGateInput,
  options: { evaluated_at: string },
): ReturnType<typeof result> & { gate: 'closed' | 'open' } {
  const issues: ValidationIssue[] = [];
  if (input.evidence_kind !== 'external_legal_policy_bundle') {
    issues.push(
      issue(
        'LEGAL_EVIDENCE_KIND_INVALID',
        'evidence_kind',
        'The exact external legal-policy evidence kind is required.',
      ),
    );
  }
  issues.push(...validateEnvironmentIdentity(input).issues);
  if (
    input.verification_environment_id !== 'production_broad' ||
    input.runtime_tier !== 'production'
  ) {
    issues.push(
      issue(
        'LEGAL_GATE_ENVIRONMENT_INVALID',
        'verification_environment_id',
        'The external legal artifact gate closes only for production_broad / production.',
      ),
    );
  }
  if (input.manifest_path !== 'legal/legal-policy-manifest.json') {
    issues.push(
      issue(
        'LEGAL_MANIFEST_PATH_MISMATCH',
        'manifest_path',
        'The exact legal-policy manifest path is required.',
      ),
    );
  }
  for (const [path, digest] of [
    ['manifest_sha256', input.manifest_sha256],
    ['release_manifest_legal_manifest_sha256', input.release_manifest_legal_manifest_sha256],
    ['acceptance_evidence_legal_manifest_sha256', input.acceptance_evidence_legal_manifest_sha256],
    ['repository_sha', input.repository_sha],
    ['application_content_sha', input.application_content_sha],
    ['release_configuration_digest', input.release_configuration_digest],
  ] as const) {
    if (!isLowercaseSha256(digest)) {
      issues.push(
        issue('LEGAL_DIGEST_INVALID', path, 'A lowercase 64-character SHA-256 digest is required.'),
      );
    }
  }
  if (
    input.manifest_sha256 !== input.release_manifest_legal_manifest_sha256 ||
    input.manifest_sha256 !== input.acceptance_evidence_legal_manifest_sha256
  ) {
    issues.push(
      issue(
        'LEGAL_MANIFEST_IDENTITY_MISMATCH',
        'manifest_sha256',
        'Release and acceptance evidence must identify the exact manifest bytes.',
      ),
    );
  }

  validateNamedPerson(issues, input.product_owner_full_name, 'product_owner_full_name');
  validateNamedPerson(
    issues,
    input.qualified_legal_reviewer_full_name,
    'qualified_legal_reviewer_full_name',
  );
  if (
    !isNonEmptyString(input.qualified_legal_reviewer_credential_or_firm) ||
    isPlaceholder(input.qualified_legal_reviewer_credential_or_firm)
  ) {
    issues.push(
      issue(
        'LEGAL_REVIEWER_CREDENTIAL_REQUIRED',
        'qualified_legal_reviewer_credential_or_firm',
        'The qualified reviewer credential or firm is required.',
      ),
    );
  }

  const evaluated = parseTimestamp(options.evaluated_at);
  const ownerApproved = parseTimestamp(input.product_owner_approved_at);
  const legalApproved = parseTimestamp(input.legal_approved_at);
  if (
    evaluated === undefined ||
    ownerApproved === undefined ||
    legalApproved === undefined ||
    ownerApproved > evaluated ||
    legalApproved > evaluated
  ) {
    issues.push(
      issue(
        'LEGAL_APPROVAL_TIME_INVALID',
        'legal_approved_at',
        'Both approval timestamps must be valid and no later than evaluation.',
      ),
    );
  }

  const requiredKeys = Object.keys(REQUIRED_LEGAL_ARTIFACTS) as LegalArtifactKey[];
  const seen = new Set<string>();
  for (const artifact of input.artifacts) {
    const expected = REQUIRED_LEGAL_ARTIFACTS[artifact.key as LegalArtifactKey];
    if (expected === undefined || seen.has(artifact.key)) {
      issues.push(
        issue(
          'LEGAL_ARTIFACT_SET_INVALID',
          `artifacts.${artifact.key}`,
          'Unknown or duplicate legal artifact.',
        ),
      );
      continue;
    }
    seen.add(artifact.key);
    if (artifact.path !== expected.path || artifact.route !== expected.route) {
      issues.push(
        issue(
          'LEGAL_ARTIFACT_LOCATION_MISMATCH',
          `artifacts.${artifact.key}`,
          'Artifact path and deployed surface must match the locked bundle.',
        ),
      );
    }
    if (
      !isNonEmptyString(artifact.external_file_id) ||
      isPlaceholder(artifact.external_file_id) ||
      !isNonEmptyString(artifact.policy_version) ||
      isPlaceholder(artifact.policy_version)
    ) {
      issues.push(
        issue(
          'LEGAL_ARTIFACT_IDENTITY_INVALID',
          `artifacts.${artifact.key}.external_file_id`,
          'Stable external identity and immutable policy version are required.',
        ),
      );
    }
    if (!artifact.external_file_id_readback_verified) {
      issues.push(
        issue(
          'LEGAL_EXTERNAL_FILE_ID_UNVERIFIED',
          `artifacts.${artifact.key}.external_file_id_readback_verified`,
          'The stable external file identity must be independently read back.',
        ),
      );
    }
    if (parseTimestamp(artifact.effective_at) === undefined) {
      issues.push(
        issue(
          'LEGAL_EFFECTIVE_TIME_INVALID',
          `artifacts.${artifact.key}.effective_at`,
          'A valid effective timestamp is required.',
        ),
      );
    }
    if (artifact.supersedes_version !== null) {
      if (
        !isNonEmptyString(artifact.supersedes_version) ||
        artifact.supersedes_version === artifact.policy_version ||
        isPlaceholder(artifact.supersedes_version)
      ) {
        issues.push(
          issue(
            'LEGAL_SUPERSESSION_INVALID',
            `artifacts.${artifact.key}.supersedes_version`,
            'A superseded version must be a different immutable version.',
          ),
        );
      }
    }
    if (artifact.superseded_by_version !== null) {
      issues.push(
        issue(
          'LEGAL_APPROVAL_SUPERSEDED',
          `artifacts.${artifact.key}.superseded_by_version`,
          'A superseded artifact cannot close the current legal gate.',
        ),
      );
    }
    if (
      !isLowercaseSha256(artifact.file_sha256) ||
      artifact.file_sha256 !== artifact.rendered_sha256 ||
      artifact.file_sha256 !== artifact.product_owner_approved_sha256 ||
      artifact.file_sha256 !== artifact.legal_reviewer_approved_sha256
    ) {
      issues.push(
        issue(
          'LEGAL_ARTIFACT_HASH_MISMATCH',
          `artifacts.${artifact.key}.file_sha256`,
          'File, deployed rendering, and both named approvals must bind the same hash.',
        ),
      );
    }
    const renderRead = parseTimestamp(artifact.production_render_read_at);
    if (
      renderRead === undefined ||
      ownerApproved === undefined ||
      legalApproved === undefined ||
      renderRead < ownerApproved ||
      renderRead < legalApproved ||
      (evaluated !== undefined && renderRead > evaluated)
    ) {
      issues.push(
        issue(
          'LEGAL_RENDER_READBACK_INVALID',
          `artifacts.${artifact.key}.production_render_read_at`,
          'Production rendering must be read back after both exact-hash approvals.',
        ),
      );
    }
  }

  for (const key of requiredKeys) {
    if (!seen.has(key)) {
      issues.push(
        issue(
          'LEGAL_ARTIFACT_MISSING',
          `artifacts.${key}`,
          'All five exact legal artifacts are required.',
        ),
      );
    }
    if (!input.review_scope.includes(key)) {
      issues.push(
        issue(
          'LEGAL_REVIEW_SCOPE_INCOMPLETE',
          `review_scope.${key}`,
          'Qualified legal review must cover every exact artifact and runtime presentation.',
        ),
      );
    }
  }
  if (!input.review_scope.includes('runtime_presentation')) {
    issues.push(
      issue(
        'LEGAL_REVIEW_SCOPE_INCOMPLETE',
        'review_scope.runtime_presentation',
        'Qualified legal review must cover runtime presentation.',
      ),
    );
  }

  const validation = result(issues);
  return { ...validation, gate: validation.passed ? 'closed' : 'open' };
}
