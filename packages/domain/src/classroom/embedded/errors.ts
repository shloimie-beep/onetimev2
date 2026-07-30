import type { EmbeddedJoinDenialCode } from '../../../../contracts/src/classroom/embedded/index.ts';

export class EmbeddedClassroomError extends Error {
  constructor(
    readonly code: EmbeddedJoinDenialCode | 'invalid_contract' | 'stale_write',
    message: string,
  ) {
    super(message);
    this.name = 'EmbeddedClassroomError';
  }
}
