import { createHash } from 'node:crypto';
import type {
  DeliveryProviderRouter,
  DeliveryRequest,
  ProviderReceipt,
  ProviderSendContext,
} from '../../../../packages/contracts/src/delivery/types.ts';

export class SinkDeliveryRouter implements DeliveryProviderRouter {
  async send(_request: DeliveryRequest, context: ProviderSendContext): Promise<ProviderReceipt> {
    if (context.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return {
      provider: 'sink',
      messageId: `sink_${createHash('sha256').update(context.deliveryKey).digest('hex').slice(0, 20)}`,
      acceptedAt: new Date(),
      sink: true,
    };
  }
}
