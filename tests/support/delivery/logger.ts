import type { DeliveryLogger } from '../../../packages/contracts/src/delivery/types.ts';

export type CapturedLogEvent = {
  level: 'info' | 'warn' | 'error';
  event: string;
  fields: Readonly<Record<string, unknown>>;
};

export function captureLogger() {
  const events: CapturedLogEvent[] = [];
  const logger: DeliveryLogger = {
    info(event, fields = {}) {
      events.push({ level: 'info', event, fields });
    },
    warn(event, fields = {}) {
      events.push({ level: 'warn', event, fields });
    },
    error(event, fields = {}) {
      events.push({ level: 'error', event, fields });
    },
  };
  return { logger, events };
}
