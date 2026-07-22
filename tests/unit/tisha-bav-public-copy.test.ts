import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const disclosure = 'By reserving, you’ll receive emails about this event.';

function htmlAttribute(source: string, pattern: RegExp) {
  const match = pattern.exec(source);
  expect(match, `missing ${String(pattern)}`).not.toBeNull();
  return (match?.[1] ?? '').replaceAll('&amp;', '&');
}

describe('Tisha BAv public generated copy', () => {
  it('keeps event-only disclosure and accepted rabbi spelling in generated HTML and public source', async () => {
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-public-pages.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PUBLIC_SITE_ORIGIN: 'https://join.onetimeonetime.com',
      },
      stdio: 'pipe',
    });

    const generatedHtml = await readFile(
      path.resolve(process.cwd(), 'dist/apps/web/public/tisha-bav.html'),
      'utf8',
    );
    const publicEntrySource = await readFile(
      path.resolve(process.cwd(), 'apps/web/src/client/public/public-entry.ts'),
      'utf8',
    );

    expect(generatedHtml).toContain(disclosure);
    expect(generatedHtml).toContain('Live class with Rabbi Eli Scheller');
    expect(generatedHtml).toContain('Rabbi Eli Scheller');
    expect(generatedHtml).not.toContain('Rabbi Elly');
    expect(generatedHtml).not.toContain('newsletter');
    expect(generatedHtml).not.toContain('marketing');

    const description = htmlAttribute(generatedHtml, /<meta name="description" content="([^"]+)">/);
    expect(description).toContain('Rabbi Eli Scheller');
    expect(description).not.toContain('Rabbi Elly');

    const whatsAppHref = htmlAttribute(
      generatedHtml,
      /<a class="button button-primary event-share-button" href="([^"]+)"[^>]*>WhatsApp share<\/a>/,
    );
    expect(decodeURIComponent(whatsAppHref)).toContain('Rabbi Eli Scheller');
    expect(decodeURIComponent(whatsAppHref)).not.toContain('Rabbi Elly');

    const emailHref = htmlAttribute(
      generatedHtml,
      /<a class="button event-share-button" href="([^"]+)"[^>]*>Email a Friend<\/a>/,
    );
    expect(decodeURIComponent(emailHref)).toContain('Rabbi Eli Scheller');
    expect(decodeURIComponent(emailHref)).not.toContain('Rabbi Elly');

    expect(publicEntrySource).toContain('Rabbi Eli Scheller');
    expect(publicEntrySource).not.toContain('Rabbi Elly');
  });
});
