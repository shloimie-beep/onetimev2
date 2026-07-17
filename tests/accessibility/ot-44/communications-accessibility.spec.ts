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
            <p>Canonical history from local intents, provider-off drafts, stored webhooks, and provider status events. Missing provider exports stay marked unavailable.</p>
          </header>
          <section aria-label="Communications source truth">
            <span>Mailbox not complete</span>
            <span>No live send controls</span>
            <span>Provider history not proven</span>
          </section>
          <form aria-label="Communications filters">
            <label>From <input type="date" value="2026-07-01"></label>
            <label>To <input type="date" value="2026-07-14"></label>
            <label>Channel <select><option>All</option></select></label>
            <label>Direction <select><option>All</option></select></label>
            <label>Intent type <select><option>All</option></select></label>
            <label>Truth status <select><option>All</option></select></label>
            <label>Source <select><option>All</option></select></label>
            <button type="submit">Apply</button>
            <button type="button">Clear</button>
          </form>
          <p role="status">Loading communication history...</p>
          <table>
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Thread</th>
                <th scope="col">Channel</th>
                <th scope="col">Direction</th>
                <th scope="col">Truth status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Email recipient</td>
                <td>Contact outbound history</td>
                <td>Email</td>
                <td>Outbound</td>
                <td>Queued</td>
              </tr>
            </tbody>
          </table>
          <article aria-label="Family signup email acknowledgement, Queued">
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
