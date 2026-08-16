import { describe, expect, it } from 'vitest';
import {
  resolveParentWelcomeByteRange,
  validateParentWelcomeAssetBinding,
  type ParentWelcomeAssetBinding,
} from '../../../packages/domain/src/portals/parent-welcome/asset-delivery.ts';

const mediaBinding: ParentWelcomeAssetBinding = {
  account_key: 'one-time-account',
  product_key: 'one_time_mishnayos',
  runtime_tier: 'production',
  verification_environment_id: 'production_broad',
  slot_key: 'parent_companion_welcome',
  video_version_id: 'welcome-approved-v1',
  content_id: 'content-approved',
  content_version_id: 'content-version-approved',
  publication_generation: 2,
  approval_projection_digest: 'a'.repeat(64),
  source_key: 'source-approved',
  source_sha256: 'b'.repeat(64),
  source_object_version_id: 'source-object-version-1',
  asset_kind: 'media',
  storage_provider: 's3',
  bucket_ref: 'one-time-private-media',
  object_key: `derivative_${'c'.repeat(64)}`,
  object_version_id: 'asset-object-version-1',
  byte_count: 100,
  payload_sha256: 'd'.repeat(64),
  content_type: 'video/mp4',
  width: null,
  height: null,
};

describe('Parent welcome governed asset delivery', () => {
  it('normalizes full, bounded, open-ended, and suffix byte requests', () => {
    expect(resolveParentWelcomeByteRange(undefined, 100)).toEqual({
      outcome: 'full',
      start: 0,
      end: 99,
      length: 100,
    });
    expect(resolveParentWelcomeByteRange('bytes=10-19', 100)).toEqual({
      outcome: 'partial',
      start: 10,
      end: 19,
      length: 10,
    });
    expect(resolveParentWelcomeByteRange('bytes=90-', 100)).toEqual({
      outcome: 'partial',
      start: 90,
      end: 99,
      length: 10,
    });
    expect(resolveParentWelcomeByteRange('bytes=-10', 100)).toEqual({
      outcome: 'partial',
      start: 90,
      end: 99,
      length: 10,
    });
    expect(resolveParentWelcomeByteRange('bytes=90-999', 100)).toEqual({
      outcome: 'partial',
      start: 90,
      end: 99,
      length: 10,
    });
  });

  it('returns an unsatisfiable outcome for malformed, multiple, or out-of-bounds ranges', () => {
    for (const header of [
      'items=0-1',
      'bytes=0-1,4-5',
      'bytes=100-',
      'bytes=20-10',
      'bytes=-0',
      'bytes=unsafe',
    ]) {
      expect(resolveParentWelcomeByteRange(header, 100)).toEqual({
        outcome: 'unsatisfiable',
        size: 100,
      });
    }
  });

  it('accepts only exact opaque S3 bindings with the MIME contract for their kind', () => {
    expect(validateParentWelcomeAssetBinding(mediaBinding)).toEqual(mediaBinding);
    expect(() =>
      validateParentWelcomeAssetBinding({
        ...mediaBinding,
        object_key: 'https://drive.google.com/file/d/raw-provider-locator',
      }),
    ).toThrow('parent_welcome_asset_binding_invalid');
    expect(() =>
      validateParentWelcomeAssetBinding({
        ...mediaBinding,
        content_type: 'video/quicktime',
      } as unknown as ParentWelcomeAssetBinding),
    ).toThrow('parent_welcome_asset_binding_invalid');
    expect(() =>
      validateParentWelcomeAssetBinding({
        ...mediaBinding,
        asset_kind: 'poster',
        content_type: 'image/webp',
        width: 1280,
        height: 800,
      }),
    ).toThrow('parent_welcome_asset_binding_invalid');
  });
});
