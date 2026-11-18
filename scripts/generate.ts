import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchContributions } from '../src/github.ts';
import { dateKey, normalizeDays, type ContributionDay } from '../src/metrics.ts';
import { renderSvg, renderPlaceholder } from '../src/render.ts';

const demo = process.argv.includes('--demo');
const username = process.env.GITHUB_USERNAME || 'ThiagoAciole';
const endKey = demo ? '2026-11-18' : dateKey(new Date());

function makeDemoDays(): ContributionDay[] {
  const start = normalizeDays([], endKey);
  return start.map((day, index) => ({
    date: day.date,
    contributionCount: (index * 17 + Math.floor(index / 7) * 11) % 13 < 4
      ? 0 : ((index * 7 + Math.floor(index / 13)) % 18) + 1,
  }));
}

const raw = demo ? makeDemoDays() : await fetchContributions(username, process.env.GITHUB_TOKEN ?? '', endKey);
const days = normalizeDays(raw, endKey);
const filenames = demo
  ? ['contributions-demo.svg', 'contributions-demo-mobile.svg']
  : ['contributions.svg', 'contributions-mobile.svg'];
await mkdir('assets', { recursive: true });
for (const [index, variant] of (['desktop', 'mobile'] as const).entries()) {
  const filepath = join('assets', filenames[index]);
  await writeFile(filepath, renderSvg(days, { variant, username, demo }), 'utf8');
  console.log(`Generated ${filepath} (${demo ? 'DEMO' : 'GitHub API'} data)`);
}

if (process.argv.includes('--placeholder')) {
  await writeFile(join('assets', 'contributions.svg'), renderPlaceholder('desktop'), 'utf8');
  await writeFile(join('assets', 'contributions-mobile.svg'), renderPlaceholder('mobile'), 'utf8');
}
