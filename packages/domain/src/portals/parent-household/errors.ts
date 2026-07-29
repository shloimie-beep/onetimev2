import { PARENT_HOUSEHOLD_ERROR_CODES } from '../../../../contracts/src/portals/parent-household/index.ts';

export type ParentHouseholdErrorCode =
  (typeof PARENT_HOUSEHOLD_ERROR_CODES)[keyof typeof PARENT_HOUSEHOLD_ERROR_CODES];

export class ParentHouseholdError extends Error {
  constructor(
    readonly code: ParentHouseholdErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ParentHouseholdError';
  }
}
