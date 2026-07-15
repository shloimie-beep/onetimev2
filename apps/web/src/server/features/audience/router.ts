import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AudienceExistingContact } from '../../../../../../packages/contracts/src/audience/schemas.ts';
import { audienceDryRunRequestSchema } from '../../../../../../packages/contracts/src/audience/schemas.ts';
import { buildAudienceDryRunReport } from '../../../../../../packages/domain/src/audience/dry-run.ts';

export type AudienceImportPreviewRouterOptions = {
  loadExistingContacts: (
    accountKey: string,
    productKey: string,
  ) => Promise<AudienceExistingContact[]>;
};

export function createAudienceImportPreviewRouter(options: AudienceImportPreviewRouterOptions) {
  const router = Router();
  router.post('/dry-run', async (request: Request, response: Response, next: NextFunction) => {
    try {
      const parsed = audienceDryRunRequestSchema.parse(request.body);
      const existingContacts = await options.loadExistingContacts(
        parsed.batch.account_key,
        parsed.batch.product_key,
      );
      const report = buildAudienceDryRunReport({
        batch: parsed.batch,
        rows: parsed.rows,
        existingContacts,
      });
      response.status(200).json(report);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
