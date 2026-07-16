import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { renderVisualFixtureGallery } from '../../packages/brand-system/src/fixture-gallery.ts';
import {
  componentContracts,
  visualMatrixRows,
} from '../../packages/brand-system/src/visual-contract.ts';

const root = process.cwd();
const runRoot = path.join(root, 'ops/codex-runs/OT-112');
const evidenceRoot = path.join(runRoot, 'evidence');

async function readCss(relativePath: string) {
  const css = await readFile(path.join(root, relativePath), 'utf8');
  return css
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('@import'))
    .join('\n');
}

const css = [
  await readCss('packages/brand-system/src/tokens.css'),
  await readCss('packages/brand-system/src/styles/portal.css'),
  await readCss('packages/brand-system/src/styles/react.css'),
].join('\n');

await mkdir(evidenceRoot, { recursive: true });
const galleryPath = path.join(evidenceRoot, 'visual-fixture-gallery.html');
const matrixPath = path.join(evidenceRoot, 'visual-matrix.json');
const prettierConfig = (await resolveConfig(galleryPath)) ?? {};
const galleryHtml = await format(
  renderVisualFixtureGallery({
    css,
    assetBase: pathToFileURL(path.join(root, 'apps/web/public')).href.replace(/\/$/, ''),
  }),
  { ...prettierConfig, filepath: galleryPath, parser: 'html' },
);
const visualMatrix = {
  generated_by: 'scripts/brand-system/write-visual-fixture.ts',
  component_contracts: componentContracts,
  matrix: visualMatrixRows(),
};
await writeFile(galleryPath, galleryHtml, 'utf8');
await writeFile(
  matrixPath,
  await format(JSON.stringify(visualMatrix), {
    ...prettierConfig,
    filepath: matrixPath,
    parser: 'json',
  }),
  'utf8',
);

process.stdout.write(
  JSON.stringify(
    {
      gallery: galleryPath,
      matrix: matrixPath,
      components: componentContracts.length,
      rows: visualMatrixRows().length,
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
