import { CALENDAR_ERROR_CODES } from '../../../contracts/src/calendar/index.ts';

export type CalendarErrorCode = (typeof CALENDAR_ERROR_CODES)[keyof typeof CALENDAR_ERROR_CODES];

export class CalendarDomainError extends Error {
  constructor(
    readonly code: CalendarErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CalendarDomainError';
  }
}
