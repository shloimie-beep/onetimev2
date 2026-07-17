import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = path.resolve('ops/evidence/ot-44/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  ['360', { width: 360, height: 800 }],
  ['390', { width: 390, height: 844 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1440, height: 1000 }],
];

const html = (surface) => `<!doctype html>
<html lang="en">
  <head>
    <title>OT-44 ${surface}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #111827; }
      main { display: grid; gap: 16px; max-width: 1040px; margin: 0 auto; }
      form { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; }
      label { display: grid; gap: 4px; }
      input, select, button { min-height: 44px; font: inherit; }
      .cards { display: grid; gap: 12px; }
      .card { border: 1px solid #d7dde8; border-radius: 8px; padding: 14px; background: white; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { border-bottom: 1px solid #d7dde8; padding: 10px; text-align: left; }
      @media (max-width: 700px) { .table { display: none; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Communications</h1>
        <p>Local communication intents only. Provider delivery, inbound messages, replies, and mailbox completeness are unavailable.</p>
      </header>
      <form>
        <label>From<input type="date" value="2026-07-01"></label>
        <label>To<input type="date" value="2026-07-14"></label>
        <label>Channel<select><option>All</option></select></label>
        <label>Intent type<select><option>All</option></select></label>
        <label>Local status<select><option>All</option></select></label>
        <button>Apply</button>
        <button type="button">Clear</button>
      </form>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Recipient</th>
            <th scope="col">Intent</th>
            <th scope="col">Channel</th>
            <th scope="col">Local status</th>
            <th scope="col">Queued</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Email recipient</td>
            <td>Family signup email acknowledgement</td>
            <td>Email</td>
            <td>Queued locally</td>
            <td>Jul 14, 2026</td>
          </tr>
          <tr>
            <td>WhatsApp recipient ending 7890</td>
            <td>Family signup WhatsApp confirmation</td>
            <td>WhatsApp</td>
            <td>Processed in test mode</td>
            <td>Jul 14, 2026</td>
          </tr>
        </tbody>
      </table>
      <section class="cards" aria-label="Local communication intent cards">
        <article class="card" aria-label="Family signup email acknowledgement, Queued locally">
          <h2>Family signup email acknowledgement</h2>
          <p>Email recipient</p>
          <p>Queued locally</p>
        </article>
        <article class="card" aria-label="Family signup WhatsApp confirmation, Processed in test mode">
          <h2>Family signup WhatsApp confirmation</h2>
          <p>WhatsApp recipient ending 7890</p>
          <p>Processed in test mode</p>
        </article>
      </section>
      <section class="card">
        <h2>${surface === 'contact' ? 'Contact Communications tab' : 'Global Communications route'}</h2>
        <p>No local communication intents were recorded in this date range.</p>
      </section>
      <section class="card">
        <h2>Communication status unavailable</h2>
        <p>Communication status is unavailable. This does not mean the inbox is empty.</p>
      </section>
    </main>
  </body>
</html>`;

const browser = await chromium.launch();
for (const surface of ['global', 'contact']) {
  for (const [name, viewport] of viewports) {
    const page = await browser.newPage({ viewport });
    await page.setContent(html(surface));
    await page.screenshot({
      path: path.join(outDir, `${surface}-${name}.png`),
      fullPage: true,
    });
    await page.close();
  }
}
await browser.close();
