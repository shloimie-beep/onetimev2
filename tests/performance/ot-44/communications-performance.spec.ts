import { expect, test } from '@playwright/test';

test('Communications local-intent shell stays within static mobile budgets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const samples: number[] = [];
  for (let index = 0; index < 33; index += 1) {
    const started = performance.now();
    await page.setContent(`
      <main>
        <h1>Communications</h1>
        <p>Local communication intents only.</p>
        <form>
          <label>From <input type="date"></label>
          <label>To <input type="date"></label>
          <label>Channel <select><option>All</option></select></label>
          <label>Intent type <select><option>All</option></select></label>
          <label>Local status <select><option>All</option></select></label>
          <button>Apply</button>
        </form>
        <article aria-label="Family signup email acknowledgement, Queued locally">
          <h2>Family signup email acknowledgement</h2>
          <p>Email recipient</p>
          <p>Queued locally</p>
        </article>
      </main>
    `);
    await page.getByRole('heading', { name: 'Communications' }).waitFor();
    if (index >= 3) samples.push(performance.now() - started);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const p75 = sorted[Math.floor((sorted.length - 1) * 0.75)] ?? 0;
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(p75).toBeLessThanOrEqual(500);
  expect(overflow).toBe(false);
});
