import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Communications owned markup has no serious or critical accessibility violations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head><title>Communications Test</title></head>
      <body>
        <main class="communications-surface">
          <header class="communications-header">
            <h1 id="communications-heading">Communications</h1>
            <p>Local communication intents only. Provider delivery, inbound messages, replies, and mailbox completeness are unavailable.</p>
          </header>
          <form aria-label="Communications filters">
            <label>From <input type="date" value="2026-07-01"></label>
            <label>To <input type="date" value="2026-07-14"></label>
            <label>Channel <select><option>All</option></select></label>
            <label>Intent type <select><option>All</option></select></label>
            <label>Local status <select><option>All</option></select></label>
            <button type="submit">Apply</button>
            <button type="button">Clear</button>
          </form>
          <p role="status">Loading local communication intents...</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Intent</th>
                <th scope="col">Channel</th>
                <th scope="col">Local status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Email recipient</td>
                <td>Family signup email acknowledgement</td>
                <td>Email</td>
                <td>Queued locally</td>
              </tr>
            </tbody>
          </table>
          <article aria-label="Family signup email acknowledgement, Queued locally">
            <h2>Family signup email acknowledgement</h2>
            <p>Email recipient</p>
          </article>
          <section aria-labelledby="communication-status-unavailable">
            <h2 id="communication-status-unavailable">Communication status unavailable</h2>
            <p>Communication status is unavailable. This does not mean the inbox is empty.</p>
          </section>
          <section role="alert">
            <h2>Communications could not load</h2>
            <p>Network error. Try again.</p>
            <button type="button">Retry</button>
          </section>
        </main>
      </body>
    </html>
  `);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  expect(serious).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
