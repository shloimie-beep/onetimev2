import { CANONICAL_TRANSITION_ORIGIN, safeAttributionQuery } from './policy.ts';

export function tishaBavEndedEventHtml(
  query?: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const currentFunnel = new URL('/', CANONICAL_TRANSITION_ORIGIN);
  currentFunnel.search = safeAttributionQuery(query).toString();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>This event has ended | One Time</title>
  </head>
  <body>
    <main>
      <h1>This event has ended</h1>
      <p>The 2026 Tisha B’Av program is no longer accepting registrations.</p>
      <p><a href="${escapeAttribute(currentFunnel.toString())}">Visit the current One Time site</a></p>
    </main>
  </body>
</html>`;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
