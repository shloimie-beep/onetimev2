import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Contacts contrast tokens', () => {
  it('keeps primary and secondary text above WCAG AA on every authenticated surface', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'packages/brand-system/src/tokens.css'),
      'utf8',
    );
    const variables = new Map(
      [...source.matchAll(/(?<name>--[\w-]+):\s*(?<value>[^;]+);/gu)].map((match) => [
        match.groups!.name!,
        match.groups!.value!.trim(),
      ]),
    );
    const foregrounds = ['--ot-color-text-primary', '--ot-color-text-secondary'];
    const backgrounds = [
      '--ot-color-background',
      '--ot-color-surface',
      '--ot-color-surface-raised',
      '--ot-color-surface-muted',
    ];

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        expect(
          contrastRatio(resolveHex(foreground, variables), resolveHex(background, variables)),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('uses semantic foreground roles for Contacts list and detail copy', async () => {
    const source = await readFile(
      path.resolve(process.cwd(), 'packages/brand-system/src/styles/react.css'),
      'utf8',
    );

    expect(source).toMatch(
      /\.contact-table th\s*\{[^}]*color:\s*var\(--ot-color-text-secondary\)/u,
    );
    expect(source).toMatch(
      /\.contact-card-heading > span\s*\{[^}]*color:\s*var\(--ot-color-text-secondary\)/u,
    );
    expect(source).toMatch(/\.contact-card\s*\{[^}]*color:\s*var\(--ot-color-text-primary\)/u);
    expect(source).toMatch(/\.detail-grid dt\s*\{[^}]*color:\s*var\(--ot-color-text-secondary\)/u);
    expect(source).toMatch(
      /\.contact-table strong,[^}]*\.detail-grid dd\s*\{[^}]*color:\s*var\(--ot-color-text-primary\)/u,
    );
    expect(source).toMatch(
      /\.toolbar-filters input::placeholder,[^}]*color:\s*var\(--ot-color-text-secondary\)[^}]*opacity:\s*1/u,
    );
    expect(source).toMatch(
      /\.toolbar-filters label,[^}]*\.contact-form label\s*\{[^}]*color:\s*var\(--ot-color-text-secondary\)/u,
    );
    expect(source).toMatch(/\.filter-help\s*\{[^}]*color:\s*var\(--ot-color-text-secondary\)/u);
  });
});

function resolveHex(
  name: string,
  variables: ReadonlyMap<string, string>,
  seen = new Set<string>(),
) {
  if (seen.has(name)) throw new Error(`Circular CSS variable: ${name}`);
  seen.add(name);
  const value = variables.get(name);
  if (!value) throw new Error(`Missing CSS variable: ${name}`);
  const reference = value.match(/^var\((--[\w-]+)\)$/u)?.[1];
  if (reference) return resolveHex(reference, variables, seen);
  if (!/^#[\da-f]{6}$/iu.test(value)) throw new Error(`Expected a six-digit color for ${name}`);
  return value;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function luminance(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/gu)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
