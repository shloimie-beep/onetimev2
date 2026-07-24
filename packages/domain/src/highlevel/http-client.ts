export type HighLevelHttpClientOptions = {
  apiBaseUrl: string;
  apiVersion: string;
  privateIntegrationsToken: string | undefined;
  timeoutMs: number;
};

export class HighLevelHttpClient {
  constructor(private readonly options: HighLevelHttpClientOptions) {}

  async request(path: string, operationKey: string, init: RequestInit) {
    const token = this.options.privateIntegrationsToken;
    if (!token) throw new Error('HIGHLEVEL_PROVIDER_UNCONFIGURED');
    const response = await fetch(new URL(path, this.options.apiBaseUrl), {
      ...init,
      signal: AbortSignal.timeout(this.options.timeoutMs),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': operationKey,
        Version: this.options.apiVersion,
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`HIGHLEVEL_PROVIDER_HTTP_${response.status}`);
    return (await response.json()) as unknown;
  }
}
