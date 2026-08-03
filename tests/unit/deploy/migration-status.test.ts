import { describe, expect, it } from 'vitest';
import { buildMigrationStatusReport } from '../../../scripts/w12-100/deploy/migration-status.ts';

describe('staging migration status compatibility', () => {
  it('accepts exact historical aliases and blocks every other extra ledger row', () => {
    const localIds = [
      '2213_learning_delivery_autotrim_transcripts',
      '2214_learning_delivery_content_factory',
    ];
    const accepted = buildMigrationStatusReport({
      localIds,
      appliedRows: [
        { id: localIds[0]!, checksum: 'current-autotrim' },
        { id: localIds[1]!, checksum: 'current-content-factory' },
        {
          id: '2209_learning_delivery_autotrim_transcripts',
          checksum: 'ebf4dee57c9366e7b149f54c062b9bcc3ffe9ce66d6bcfef69e60497bfde04a8',
        },
        {
          id: '2210_learning_delivery_content_factory',
          checksum: '93aa95f1fb14511569f85307e3026fc67449b30d2582a9280f9b1e2750b8349f',
        },
      ],
      environmentKind: 'staging',
    });
    expect(accepted).toMatchObject({
      status: 'passed',
      pending_migrations: 0,
      accepted_historical_alias_count: 2,
      unrecognized_ledger_rows: 0,
      unrecognized_ids_hash: null,
    });

    const rejected = buildMigrationStatusReport({
      localIds,
      appliedRows: [
        { id: localIds[0]!, checksum: 'current-autotrim' },
        { id: localIds[1]!, checksum: 'current-content-factory' },
        {
          id: '2209_learning_delivery_autotrim_transcripts',
          checksum: '0'.repeat(64),
        },
      ],
      environmentKind: 'staging',
    });
    expect(rejected).toMatchObject({
      status: 'blocked',
      pending_migrations: 0,
      accepted_historical_alias_count: 0,
      unrecognized_ledger_rows: 1,
    });
    expect(rejected.unrecognized_ids_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
