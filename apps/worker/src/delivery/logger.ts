import type { DeliveryLogger } from '../../../../packages/contracts/src/delivery/types.ts';
import { safeLogFields } from '../../../../packages/domain/src/delivery/redaction.ts';
import {
  logger as baseLogger,
  sanitizeTelemetryFields,
} from '../../../../packages/observability/src/index.ts';

type PinoLikeLogger = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
};

export function createDeliveryLogger(logger: PinoLikeLogger = baseLogger): DeliveryLogger {
  return {
    info(event, fields = {}) {
      logger.info(sanitizeTelemetryFields(safeLogFields(fields)), event);
    },
    warn(event, fields = {}) {
      logger.warn(sanitizeTelemetryFields(safeLogFields(fields)), event);
    },
    error(event, fields = {}) {
      logger.error(sanitizeTelemetryFields(safeLogFields(fields)), event);
    },
  };
}
