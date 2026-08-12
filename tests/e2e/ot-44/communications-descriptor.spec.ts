import { expect, test } from '@playwright/test';
import {
  communicationsRouteDescriptor,
  contactCommunicationsTabDescriptor,
} from '../../../apps/web/src/client/app/communications/route-descriptor.ts';

test('Communications descriptors are lazy and Rabbi/Admin scoped', async () => {
  expect(communicationsRouteDescriptor.path).toBe('/app/communications');
  expect(communicationsRouteDescriptor.allowedRoles).toEqual(['owner', 'admin', 'rabbi']);
  expect(contactCommunicationsTabDescriptor.allowedRoles).toEqual(['owner', 'admin', 'rabbi']);
  expect(typeof communicationsRouteDescriptor.load).toBe('function');
  expect(typeof contactCommunicationsTabDescriptor.load).toBe('function');
  expect(communicationsRouteDescriptor.load).toBe(contactCommunicationsTabDescriptor.load);
});

test('CRM overview does not request Communications without explicit descriptor load', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.setContent(`
    <main>
      <h1>CRM Contact Overview</h1>
      <section id="overview">Overview remains selected by default.</section>
    </main>
  `);
  expect(requested.filter((url) => url.includes('/api/v1/communications'))).toHaveLength(0);
  expect(requested.filter((url) => url.includes('/communications'))).toHaveLength(0);
});
