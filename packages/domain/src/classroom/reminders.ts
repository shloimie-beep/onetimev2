import type { PortalActorContext } from '../../../contracts/src/portals/index.ts';
import type { ClassroomRepository } from './service.ts';
import { resolveDailyClassWindow } from '../classes/schedule.ts';
import type { AppConfig } from '../../../config/src/index.ts';

export type ClassroomReminderJobDeps = {
  config: AppConfig;
  repository: ClassroomRepository;
  clock?: (() => Date) | undefined;
};

export type ClassroomReminderJobResult = {
  occurrence_key: string;
  queued: number;
  suppressed: number;
  external_send_performed: false;
};

export function createClassroomReminderJob(deps: ClassroomReminderJobDeps) {
  const clock = deps.clock ?? (() => new Date());
  return {
    async runOnce(
      actor: Pick<
        PortalActorContext,
        'account_key' | 'product_key' | 'actor_user_ref' | 'actor_role'
      >,
    ): Promise<ClassroomReminderJobResult> {
      const now = clock();
      const occurrence = await deps.repository.ensureDailyOccurrence({
        actor,
        window: resolveDailyClassWindow(now, { currentOccurrenceStillJoinable: true }),
        durationMinutes: deps.config.zoomClassroomClassDurationMinutes,
        joinOpenOffsetMinutes: deps.config.zoomClassroomJoinOpenOffsetMinutes,
        joinCloseOffsetMinutes: deps.config.zoomClassroomJoinCloseOffsetMinutes,
      });
      const result = await deps.repository.scheduleDueReminders({ actor, occurrence, now });
      return {
        occurrence_key: occurrence.occurrence_key,
        queued: result.queued,
        suppressed: result.suppressed,
        external_send_performed: false,
      };
    },
  };
}
