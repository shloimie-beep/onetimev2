import { CLASSROOM_CORE_ERROR_CODES } from '../../../../contracts/src/classes/core/index.ts';

export type ClassroomCoreErrorCode =
  (typeof CLASSROOM_CORE_ERROR_CODES)[keyof typeof CLASSROOM_CORE_ERROR_CODES];

export class ClassroomCoreError extends Error {
  constructor(
    readonly code: ClassroomCoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ClassroomCoreError';
  }
}
