export const SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON = 'unsafe_source_content' as const;

type ScopedKnowledgeCitation = {
  section_title: string;
  deep_link: string;
};

type SafeScopedKnowledgeProjection<TCitation extends ScopedKnowledgeCitation> = {
  safe: true;
  answer: string;
  citations: TCitation[];
  sourceRefs: string[];
};

type UnsafeScopedKnowledgeProjection = {
  safe: false;
  reason: typeof SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON;
};

const PROVIDER_DOMAIN_PATTERN =
  /(?:^|[^a-z0-9])(?:[a-z0-9-]+\.)*(?:zoom\.us|vimeo\.com)(?=$|[/:?#\s])/i;
const URL_PATTERN =
  /(?:\b(?:https?|ftp):[\\/]{2}|\bwww\.|(?:^|[^a-z0-9])(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.)+[a-z]{2,63}(?=$|[/:?#\s]))/i;
const PROTOCOL_RELATIVE_URL_PATTERN = /(?:^|[\s("'`])\/{2}[a-z0-9]/i;
const PROTECTED_VALUE_PATTERN =
  /\b(?:access(?:[\s_-]?token)|api(?:[\s_-]?key)|client(?:[\s_-]?(?:id|secret))|host(?:[\s_-]?user)?[\s_-]?id|id(?:[\s_-]?token)|meeting(?:[\s_-]?(?:id|passcode|password))|passcode|password|provider(?:[\s_-]?(?:key|secret|token))|pwd|refresh(?:[\s_-]?token)|registrant(?:[\s_-]?token)|secret|signature|tk|token|video(?:[\s_-]?id)|zak)\b(?:(?:\s*(?:=|:|=>)\s*)|(?:\s+is\s+)|\s+)["']?[^\s"'&,;]+/i;
const PROTECTED_QUERY_PATTERN =
  /[?&](?:access[_-]?token|api[_-]?key|client[_-]?secret|id[_-]?token|passcode|password|pwd|refresh[_-]?token|secret|signature|tk|token|zak)=/i;
const SAFE_DEEP_LINK_PATTERNS = [
  /^\/library\/classes\/[A-Za-z0-9][A-Za-z0-9._:-]{2,127}#section-[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/,
  /^\/app\/student#[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/,
] as const;

export function containsProtectedScopedKnowledgeMaterial(value: string): boolean {
  for (const candidate of detectionCandidates(value)) {
    if (
      PROVIDER_DOMAIN_PATTERN.test(candidate) ||
      URL_PATTERN.test(candidate) ||
      PROTOCOL_RELATIVE_URL_PATTERN.test(candidate) ||
      PROTECTED_VALUE_PATTERN.test(candidate) ||
      PROTECTED_QUERY_PATTERN.test(candidate)
    ) {
      return true;
    }
  }
  return false;
}

export function sanitizeScopedKnowledgeProjection<
  TCitation extends ScopedKnowledgeCitation,
>(input: {
  answer: string;
  citations: readonly TCitation[];
}): SafeScopedKnowledgeProjection<TCitation> | UnsafeScopedKnowledgeProjection {
  if (containsProtectedScopedKnowledgeMaterial(input.answer)) {
    return { safe: false, reason: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON };
  }

  const citations: TCitation[] = [];
  const sourceRefs: string[] = [];
  for (const citation of input.citations) {
    const sectionTitle = normalizeDisplayText(citation.section_title);
    if (
      !sectionTitle ||
      containsProtectedScopedKnowledgeMaterial(sectionTitle) ||
      !isAllowlistedScopedKnowledgeDeepLink(citation.deep_link)
    ) {
      return { safe: false, reason: SCOPED_KNOWLEDGE_UNSAFE_SOURCE_REASON };
    }

    const sanitizedCitation = {
      ...citation,
      section_title: sectionTitle,
    };
    citations.push(sanitizedCitation);
    sourceRefs.push(sourceRefForSafeCitation(sanitizedCitation));
  }

  return {
    safe: true,
    answer: input.answer,
    citations,
    sourceRefs,
  };
}

export function isAllowlistedScopedKnowledgeDeepLink(value: string): boolean {
  if (
    value !== value.trim() ||
    containsProtectedScopedKnowledgeMaterial(value) ||
    value.includes('?')
  ) {
    return false;
  }
  return SAFE_DEEP_LINK_PATTERNS.some((pattern) => pattern.test(value));
}

function sourceRefForSafeCitation(citation: ScopedKnowledgeCitation): string {
  const withTitle = `${citation.section_title} (${citation.deep_link})`;
  if (withTitle.length <= 180) return withTitle;
  const withoutTitle = `Approved class section (${citation.deep_link})`;
  return withoutTitle.length <= 180 ? withoutTitle : 'Approved class section';
}

function detectionCandidates(value: string): string[] {
  const candidates = new Set<string>();
  let normalized = value
    .normalize('NFKC')
    .replaceAll(/[\u200B-\u200D\uFEFF]/g, '')
    .replaceAll(/&#(?:0*46|x0*2e);|&period;/gi, '.')
    .replaceAll(/&#(?:0*47|x0*2f);/gi, '/');
  candidates.add(normalized);
  candidates.add(normalized.replaceAll('\\', '/'));
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
      candidates.add(normalized);
      candidates.add(normalized.replaceAll('\\', '/'));
    } catch {
      break;
    }
  }
  return [...candidates];
}

function normalizeDisplayText(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim();
}
