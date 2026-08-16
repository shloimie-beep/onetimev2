import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, type GetObjectCommandOutput, type S3Client } from '@aws-sdk/client-s3';
import type { Request, Response } from 'express';
import type { ParentWelcomePrincipal } from '../../../../../../../packages/contracts/src/portals/parent-welcome/index.ts';
import {
  resolveParentWelcomeByteRange,
  validateParentWelcomeAssetBinding,
  type ParentWelcomeAssetBinding,
  type ParentWelcomeAssetKind,
  type ParentWelcomeAssetResolver,
} from '../../../../../../../packages/domain/src/portals/parent-welcome/asset-delivery.ts';

export type ParentWelcomeAssetRuntime = {
  send(
    req: Request,
    res: Response,
    input: {
      principal: ParentWelcomePrincipal;
      video_version_id: string;
      asset_kind: ParentWelcomeAssetKind;
    },
  ): Promise<void>;
};

export function createParentWelcomeS3AssetRuntime(input: {
  resolver: ParentWelcomeAssetResolver;
  s3Client: Pick<S3Client, 'send'>;
  expectedBucketRef: string;
}): ParentWelcomeAssetRuntime {
  const expectedBucketRef = input.expectedBucketRef.trim();
  if (!expectedBucketRef || /(?:https?:\/\/|s3:\/\/)/iu.test(expectedBucketRef)) {
    throw new Error('parent_welcome_asset_runtime_bucket_invalid');
  }

  return {
    async send(req, res, command) {
      let binding;
      try {
        const resolved = await input.resolver.resolveAsset(command);
        if (!resolved) {
          sendUnavailable(res);
          return;
        }
        binding = validateParentWelcomeAssetBinding(resolved);
        if (
          binding.bucket_ref !== expectedBucketRef ||
          binding.video_version_id !== command.video_version_id ||
          binding.asset_kind !== command.asset_kind
        ) {
          sendUnavailable(res);
          return;
        }
      } catch {
        sendUnavailable(res);
        return;
      }

      const range = resolveParentWelcomeByteRange(
        binding.asset_kind === 'media' ? req.header('range') : undefined,
        binding.byte_count,
      );
      if (range.outcome === 'unsatisfiable') {
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Range', `bytes */${range.size}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(416).end();
        return;
      }

      const requestedRange =
        range.outcome === 'partial' ? `bytes=${range.start}-${range.end}` : undefined;
      let object: GetObjectCommandOutput;
      try {
        object = (await input.s3Client.send(
          new GetObjectCommand({
            Bucket: expectedBucketRef,
            Key: binding.object_key,
            VersionId: binding.object_version_id,
            ChecksumMode: 'ENABLED',
            ...(requestedRange ? { Range: requestedRange } : {}),
          }),
        )) as GetObjectCommandOutput;
        if (
          !object.Body ||
          object.VersionId !== binding.object_version_id ||
          object.ContentLength !== range.length ||
          object.ContentType !== binding.content_type ||
          (range.outcome === 'partial' &&
            object.ContentRange !== `bytes ${range.start}-${range.end}/${binding.byte_count}`) ||
          (range.outcome === 'full' &&
            object.ChecksumSHA256 !== undefined &&
            object.ChecksumSHA256 !== Buffer.from(binding.payload_sha256, 'hex').toString('base64'))
        ) {
          discardBody(object.Body);
          sendUnavailable(res);
          return;
        }
      } catch {
        sendUnavailable(res);
        return;
      }

      try {
        const current = await input.resolver.resolveAsset(command);
        if (
          !current ||
          bindingFingerprint(validateParentWelcomeAssetBinding(current)) !==
            bindingFingerprint(binding)
        ) {
          discardBody(object.Body);
          sendUnavailable(res);
          return;
        }
      } catch {
        discardBody(object.Body);
        sendUnavailable(res);
        return;
      }

      res.setHeader(
        'Content-Type',
        binding.content_type === 'text/vtt' ? 'text/vtt; charset=utf-8' : binding.content_type,
      );
      res.setHeader('Content-Length', String(range.length));
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (binding.asset_kind === 'media') res.setHeader('Accept-Ranges', 'bytes');
      if (range.outcome === 'partial') {
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${binding.byte_count}`);
      }
      res.status(range.outcome === 'partial' ? 206 : 200);
      try {
        await pipeline(Readable.from(object.Body as AsyncIterable<Uint8Array>), res);
      } catch {
        if (!res.headersSent) {
          sendUnavailable(res);
        } else {
          res.destroy();
        }
      }
    },
  };
}

function bindingFingerprint(binding: ParentWelcomeAssetBinding) {
  return JSON.stringify([
    binding.account_key,
    binding.product_key,
    binding.runtime_tier,
    binding.verification_environment_id,
    binding.slot_key,
    binding.video_version_id,
    binding.content_id,
    binding.content_version_id,
    binding.publication_generation,
    binding.approval_projection_digest,
    binding.source_key,
    binding.source_sha256,
    binding.source_object_version_id,
    binding.asset_kind,
    binding.storage_provider,
    binding.bucket_ref,
    binding.object_key,
    binding.object_version_id,
    binding.byte_count,
    binding.payload_sha256,
    binding.content_type,
    binding.width,
    binding.height,
  ]);
}

function discardBody(body: GetObjectCommandOutput['Body']) {
  const readable = body as { destroy?: () => void } | undefined;
  readable?.destroy?.();
}

function sendUnavailable(res: Response) {
  if (res.headersSent) return;
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(404).end();
}
