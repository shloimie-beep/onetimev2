export const ot37Task = {
  taskId: 'OT-37',
  repository: 'shloimie-beep/onetimev2',
  baseCommit: '4ac288968ba24e30a5c3f8c6924f492eedf4338f',
  foundationAncestor: '3465bd7d4c6b6829a6be6e4b4f8a003d608f3680',
  stackedBaseBranch: 'codex/crm-core-v1',
  recoveryBranch: 'codex/ot60r-recovery-convergence',
} as const;

export const reservedSyntheticDomains = [
  'example.com',
  'example.net',
  'example.org',
  'example.test',
  'example.invalid',
] as const;

export type QueryScenarioId =
  | 'crm_default_updated_desc'
  | 'crm_name_sort'
  | 'crm_created_desc'
  | 'crm_search_leading_wildcard'
  | 'crm_status_filter'
  | 'crm_classification_filter'
  | 'crm_source_filter'
  | 'crm_assigned_user_filter';

export const queryScenarioIds: QueryScenarioId[] = [
  'crm_default_updated_desc',
  'crm_name_sort',
  'crm_created_desc',
  'crm_search_leading_wildcard',
  'crm_status_filter',
  'crm_classification_filter',
  'crm_source_filter',
  'crm_assigned_user_filter',
];

export type PerformanceScenarioId =
  'db_list_default' | 'db_contact_detail' | 'db_search_leading_wildcard';

export const performanceScenarioIds: PerformanceScenarioId[] = [
  'db_list_default',
  'db_contact_detail',
  'db_search_leading_wildcard',
];

export const expectedOpenFindingCatalog = [
  {
    id: 'DATA-008',
    title: 'Migration backfill selects no authoritative signup row for multi-signup contacts.',
    source: 'OT-27 data-integrity review',
  },
  {
    id: 'PERF-003',
    title: 'CRM search and some source/assignee/created sort modes lack matching indexes.',
    source: 'OT-27 performance review',
  },
  {
    id: 'PERF-005',
    title: 'Real PostgreSQL migration and query-plan evidence was absent before OT-37.',
    source: 'OT-27 performance review',
  },
  {
    id: 'DURABLE-THROTTLE-MISSING',
    title:
      'The current base has process-local throttling and no durable throttle table to exercise.',
    source: 'OT-27 security review',
  },
] as const;
