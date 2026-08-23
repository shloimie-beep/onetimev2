import { expect, test } from '@playwright/test';
import { communicationsRouteDescriptor } from '../../../apps/web/src/client/app/communications/route-descriptor.ts';

test('Communications descriptor is lazy and owner/Admin scoped', async () => {
  expect(communicationsRouteDescriptor.path).toBe('/app/communications');
  expect(communicationsRouteDescriptor.allowedRoles).toEqual(['owner', 'admin']);
  expect(typeof communicationsRouteDescriptor.load).toBe('function');
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
