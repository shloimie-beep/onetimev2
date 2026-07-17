import { safeFingerprint } from '../../../../packages/domain/src/providers/shared.ts';
import type { ResendProviderClient, WapiProviderClient } from './provider-router.ts';

export type InMemoryProviderCall = {
  provider: 'resend' | 'one_time_wapi';
  destinationRef: string;
  idempotencyKey: string;
};

export class InMemoryDeliveryProviderAdapter implements ResendProviderClient, WapiProviderClient {
  readonly calls: InMemoryProviderCall[] = [];
  private readonly receipts = new Map<string, { messageId: string; acceptedAt: Date }>();

  async sendEmail(
    request: Parameters<ResendProviderClient['sendEmail']>[0],
    options: Parameters<ResendProviderClient['sendEmail']>[1],
  ): Promise<{ messageId: string; acceptedAt: Date }> {
    if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return this.accept('resend', request.to, options.idempotencyKey);
  }

  async sendWhatsApp(
    request: Parameters<WapiProviderClient['sendWhatsApp']>[0],
    options: Parameters<WapiProviderClient['sendWhatsApp']>[1],
  ): Promise<{ messageId: string; acceptedAt: Date }> {
    if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return this.accept('one_time_wapi', request.to, options.idempotencyKey);
  }

  private accept(
    provider: InMemoryProviderCall['provider'],
    destination: string,
    idempotencyKey: string,
  ): { messageId: string; acceptedAt: Date } {
    const receiptKey = `${provider}:${idempotencyKey}`;
    const existing = this.receipts.get(receiptKey);
    if (existing) return existing;
    const receipt = {
      messageId: `${provider}_mock_${safeFingerprint(receiptKey)}`,
      acceptedAt: new Date('2026-07-17T00:00:00.000Z'),
    };
    this.receipts.set(receiptKey, receipt);
    this.calls.push({
      provider,
      destinationRef: safeFingerprint(destination),
      idempotencyKey,
    });
    return receipt;
  }
}
