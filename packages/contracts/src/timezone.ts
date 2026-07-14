import { z } from 'zod';

export function isValidIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .superRefine((value, ctx) => {
    if (!isValidIanaTimeZone(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid IANA time zone such as America/New_York.',
      });
    }
  });
