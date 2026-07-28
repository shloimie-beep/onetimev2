import type {
  CalendarActorScope,
  CalendarQuery,
  CalendarQueryResult,
  CalendarRepository,
} from '../../../../../../packages/contracts/src/calendar/index.ts';
import { projectCalendarView } from '../../../../../../packages/domain/src/calendar/index.ts';
import { calendarRepositoryQueryFor } from '../../../../../../packages/db/src/calendar/index.ts';

export type AuthenticatedCalendarRequest = {
  /**
   * This context must be built by the F02 authenticated account lifecycle
   * adapter. Request bodies must never supply role or ownership scopes.
   */
  actor: CalendarActorScope;
  query: CalendarQuery;
};

export function createCalendarQueryService(repository: CalendarRepository) {
  return {
    async query(request: AuthenticatedCalendarRequest): Promise<CalendarQueryResult> {
      const occurrences = await repository.listOccurrences(
        calendarRepositoryQueryFor({
          accountKey: request.actor.accountKey,
          productKey: request.actor.productKey,
          adminAccess: request.actor.role === 'admin',
          rangeStart: request.query.rangeStart,
          rangeEnd: request.query.rangeEnd,
          householdIds: request.actor.householdIds,
          studentIds: request.actor.studentIds,
          ...(request.query.statuses ? { statuses: request.query.statuses } : {}),
          ...(request.query.seriesIds ? { seriesIds: request.query.seriesIds } : {}),
        }),
      );
      return projectCalendarView({
        actor: request.actor,
        query: request.query,
        occurrences,
      });
    },
  };
}
