export type MigrationLedgerRow = Readonly<{
  id: string;
  checksum: string;
}>;

type HistoricalMigrationAlias = Readonly<{
  id: string;
  checksum: string;
  canonicalId: string;
}>;

const HISTORICAL_MIGRATION_ALIASES: readonly HistoricalMigrationAlias[] = Object.freeze([
  Object.freeze({
    id: '2209_learning_delivery_autotrim_transcripts',
    checksum: 'ebf4dee57c9366e7b149f54c062b9bcc3ffe9ce66d6bcfef69e60497bfde04a8',
    canonicalId: '2213_learning_delivery_autotrim_transcripts',
  }),
  Object.freeze({
    id: '2210_learning_delivery_content_factory',
    checksum: '93aa95f1fb14511569f85307e3026fc67449b30d2582a9280f9b1e2750b8349f',
    canonicalId: '2214_learning_delivery_content_factory',
  }),
]);

const HISTORICAL_ALIAS_BY_ID = new Map(
  HISTORICAL_MIGRATION_ALIASES.map((alias) => [alias.id, alias]),
);

export function classifyMigrationLedgerRows(
  rows: readonly MigrationLedgerRow[],
  localMigrationIds: ReadonlySet<string>,
) {
  const currentRows: MigrationLedgerRow[] = [];
  const acceptedHistoricalAliases: HistoricalMigrationAlias[] = [];
  const unrecognizedRows: MigrationLedgerRow[] = [];

  for (const row of rows) {
    if (localMigrationIds.has(row.id)) {
      currentRows.push(row);
      continue;
    }
    const alias = HISTORICAL_ALIAS_BY_ID.get(row.id);
    if (alias && alias.checksum === row.checksum && localMigrationIds.has(alias.canonicalId)) {
      acceptedHistoricalAliases.push(alias);
      continue;
    }
    unrecognizedRows.push(row);
  }

  return {
    currentRows,
    acceptedHistoricalAliases,
    unrecognizedRows,
  };
}
