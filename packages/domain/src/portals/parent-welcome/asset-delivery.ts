import type { ParentWelcomePrincipal } from '../../../../contracts/src/portals/parent-welcome/index.ts';

export const PARENT_WELCOME_ASSET_KINDS = ['media', 'captions', 'poster'] as const;
export type ParentWelcomeAssetKind = (typeof PARENT_WELCOME_ASSET_KINDS)[number];

export type ParentWelcomeAssetBinding = {
  account_key: string;
  product_key: 'one_time_mishnayos';
  runtime_tier: 'isolated_staging' | 'production';
  verification_environment_id: string;
  slot_key: 'parent_companion_welcome';
  video_version_id: string;
  content_id: string;
  content_version_id: string;
  publication_generation: number;
  approval_projection_digest: string;
  source_key: string;
  source_sha256: string;
  source_object_version_id: string;
  asset_kind: ParentWelcomeAssetKind;
  storage_provider: 's3';
  bucket_ref: string;
  object_key: string;
  object_version_id: string;
  byte_count: number;
  payload_sha256: string;
  content_type: 'video/mp4' | 'text/vtt' | 'image/jpeg' | 'image/png' | 'image/webp';
  width: number | null;
  height: number | null;
};

export type ParentWelcomeAssetResolver = {
  resolveAsset(input: {
    principal: ParentWelcomePrincipal;
    video_version_id: string;
    asset_kind: ParentWelcomeAssetKind;
  }): Promise<ParentWelcomeAssetBinding | null>;
};

export type ParentWelcomeByteRange =
  | {
      outcome: 'full' | 'partial';
      start: number;
      end: number;
      length: number;
    }
  | { outcome: 'unsatisfiable'; size: number };

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const SAFE_BUCKET =
  /^(?!.*\.\.)(?!.*\.-)(?!.*-\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const SAFE_OBJECT_KEY =
  /^(?:source_[0-9a-f]{32}|derivative_[0-9a-f]{64}|parent_welcome_(?:media|captions|poster)_[0-9a-f]{64})$/u;
const RAW_LOCATOR = /(?:https?:\/\/|s3:\/\/|drive\.google\.com|vimeo\.com)/iu;

export function resolveParentWelcomeByteRange(
  rangeHeader: string | undefined,
  size: number,
): ParentWelcomeByteRange {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new Error('parent_welcome_asset_size_invalid');
  }
  if (rangeHeader === undefined) {
    return { outcome: 'full', start: 0, end: size - 1, length: size };
  }
  const match = /^bytes=(\d*)-(\d*)$/u.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) return unsatisfiable(size);
  const startText = match[1] ?? '';
  const endText = match[2] ?? '';
  if (!startText) {
    const suffixLength = safeInteger(endText);
    if (suffixLength === null || suffixLength < 1) return unsatisfiable(size);
    const length = Math.min(suffixLength, size);
    return { outcome: 'partial', start: size - length, end: size - 1, length };
  }
  const start = safeInteger(startText);
  const requestedEnd = endText ? safeInteger(endText) : size - 1;
  if (start === null || requestedEnd === null || start >= size || requestedEnd < start) {
    return unsatisfiable(size);
  }
  const end = Math.min(requestedEnd, size - 1);
  return { outcome: 'partial', start, end, length: end - start + 1 };
}

export function validateParentWelcomeAssetBinding(
  binding: ParentWelcomeAssetBinding,
): ParentWelcomeAssetBinding {
  const expectedContentTypes: Record<ParentWelcomeAssetKind, readonly string[]> = {
    media: ['video/mp4'],
    captions: ['text/vtt'],
    poster: ['image/jpeg', 'image/png', 'image/webp'],
  };
  const kindObjectKey =
    binding.asset_kind === 'media'
      ? /^(?:source_[0-9a-f]{32}|derivative_[0-9a-f]{64}|parent_welcome_media_[0-9a-f]{64})$/u
      : new RegExp(`^parent_welcome_${binding.asset_kind}_[0-9a-f]{64}$`, 'u');
  const posterDimensionsValid =
    binding.asset_kind === 'poster'
      ? Number.isSafeInteger(binding.width) &&
        Number.isSafeInteger(binding.height) &&
        (binding.width ?? 0) > 0 &&
        (binding.height ?? 0) > 0 &&
        (binding.width ?? 0) * 9 === (binding.height ?? 0) * 16
      : binding.width === null && binding.height === null;
  if (
    !binding.account_key.trim() ||
    binding.product_key !== 'one_time_mishnayos' ||
    !['isolated_staging', 'production'].includes(binding.runtime_tier) ||
    !binding.verification_environment_id.trim() ||
    binding.slot_key !== 'parent_companion_welcome' ||
    !SAFE_ID.test(binding.video_version_id) ||
    !binding.content_id.trim() ||
    !binding.content_version_id.trim() ||
    !Number.isSafeInteger(binding.publication_generation) ||
    binding.publication_generation < 1 ||
    !SHA256.test(binding.approval_projection_digest) ||
    !binding.source_key.trim() ||
    !SHA256.test(binding.source_sha256) ||
    !opaqueVersion(binding.source_object_version_id) ||
    !PARENT_WELCOME_ASSET_KINDS.includes(binding.asset_kind) ||
    binding.storage_provider !== 's3' ||
    !SAFE_BUCKET.test(binding.bucket_ref) ||
    RAW_LOCATOR.test(binding.bucket_ref) ||
    !SAFE_OBJECT_KEY.test(binding.object_key) ||
    !kindObjectKey.test(binding.object_key) ||
    !opaqueVersion(binding.object_version_id) ||
    !Number.isSafeInteger(binding.byte_count) ||
    binding.byte_count < 1 ||
    binding.byte_count > 5_368_709_120 ||
    !SHA256.test(binding.payload_sha256) ||
    !expectedContentTypes[binding.asset_kind].includes(binding.content_type) ||
    !posterDimensionsValid
  ) {
    throw new Error('parent_welcome_asset_binding_invalid');
  }
  return binding;
}

function opaqueVersion(value: string) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 1024 &&
    ![...value].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    }) &&
    !RAW_LOCATOR.test(value)
  );
}

function safeInteger(value: string) {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function unsatisfiable(size: number): ParentWelcomeByteRange {
  return { outcome: 'unsatisfiable', size };
}
