import type { ParentLearningErrorCode } from '../../../../contracts/src/portals/parent-learning/index.ts';

export class ParentLearningError extends Error {
  constructor(
    readonly code: ParentLearningErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ParentLearningError';
  }
}
