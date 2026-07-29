import type { AppConfig } from '../../../../../../../packages/config/src/index.ts';
import type { DbPool } from '../../../../../../../packages/db/src/index.ts';
import type {
  AdminOperationsActor,
  AdminNavigationRequest,
  AdminSearchRequest,
} from '../../../../../../../packages/contracts/src/admin/operations/index.ts';
import {
  readAuthorizedAdminDashboard,
  resolveAuthorizedAdminNavigation,
  searchAuthorizedAdminOperations,
} from '../../../../../../../packages/domain/src/admin-search/index.ts';
import { PostgresAdminOperationsRepository } from './repository.ts';

export class AdminOperationsService {
  private readonly repository: PostgresAdminOperationsRepository;

  constructor(pool: DbPool, config: AppConfig, now?: () => Date) {
    this.repository = new PostgresAdminOperationsRepository(pool, config, now);
  }

  readDashboard(actor: AdminOperationsActor) {
    return readAuthorizedAdminDashboard({ actor, repository: this.repository });
  }

  search(actor: AdminOperationsActor, request: AdminSearchRequest) {
    return searchAuthorizedAdminOperations({ actor, request, repository: this.repository });
  }

  resolveNavigation(actor: AdminOperationsActor, request: AdminNavigationRequest) {
    return resolveAuthorizedAdminNavigation({ actor, request, repository: this.repository });
  }
}
