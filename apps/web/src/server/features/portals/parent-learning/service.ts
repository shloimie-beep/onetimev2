import {
  PARENT_LEARNING_ERROR_CODES,
  type ParentLearningMutationContext,
  type ParentLearningPrincipal,
  type ParentLearningRepository,
  type RecordParentAttendanceEvidence,
  type RecordParentContentProgressCommand,
  type SubmitParentQuestionCommand,
} from '../../../../../../../packages/contracts/src/portals/parent-learning/index.ts';
import {
  buildParentLearningSnapshot,
  buildParentContentPlaybackAction,
  buildParentLearningProductionBasicActor,
  ParentLearningError,
  prepareParentAttendance,
  prepareParentContentProgress,
  prepareParentQuestion,
} from '../../../../../../../packages/domain/src/portals/parent-learning/index.ts';

export function createParentLearningService(input: { repository: ParentLearningRepository }) {
  async function load(principal: ParentLearningPrincipal) {
    const record = await input.repository.loadOwnedParticipant(principal);
    if (!record) {
      throw new ParentLearningError(
        PARENT_LEARNING_ERROR_CODES.missing,
        'Parent learning is unavailable for this household.',
      );
    }
    return record;
  }

  return {
    async overview(principal: ParentLearningPrincipal) {
      return buildParentLearningSnapshot({ principal, record: await load(principal) });
    },

    async productionBasicActor(principal: ParentLearningPrincipal) {
      return buildParentLearningProductionBasicActor({
        principal,
        record: await load(principal),
      });
    },

    async openContent(principal: ParentLearningPrincipal, contentId: string) {
      const record = await load(principal);
      const target = await input.repository.loadContentOpenTarget({
        principal,
        participant_id: record.participant_id,
        content_id: contentId,
      });
      if (!target) {
        throw new ParentLearningError(
          PARENT_LEARNING_ERROR_CODES.targetUnavailable,
          'This Parent content is unavailable.',
        );
      }
      return buildParentContentPlaybackAction(target);
    },

    async recordAttendance(
      principal: ParentLearningPrincipal,
      command: RecordParentAttendanceEvidence,
      context: ParentLearningMutationContext,
    ) {
      const record = await load(principal);
      return input.repository.recordAttendance({
        principal,
        write: prepareParentAttendance({ principal, record, command, context }),
      });
    },

    async recordContentProgress(
      principal: ParentLearningPrincipal,
      command: RecordParentContentProgressCommand,
      context: ParentLearningMutationContext,
    ) {
      const record = await load(principal);
      const target = await input.repository.loadContentProgressTarget({
        principal,
        participant_id: record.participant_id,
        content_id: command.content_id,
        content_version_id: command.content_version_id,
      });
      if (!target) {
        throw new ParentLearningError(
          PARENT_LEARNING_ERROR_CODES.targetUnavailable,
          'This Parent content version is unavailable.',
        );
      }
      return input.repository.recordContentProgress({
        principal,
        write: prepareParentContentProgress({ principal, record, target, command, context }),
      });
    },

    async submitQuestion(
      principal: ParentLearningPrincipal,
      command: SubmitParentQuestionCommand,
      context: ParentLearningMutationContext,
    ) {
      const record = await load(principal);
      return input.repository.submitQuestion({
        principal,
        write: prepareParentQuestion({ principal, record, command, context }),
      });
    },
  };
}

export type ParentLearningService = ReturnType<typeof createParentLearningService>;
