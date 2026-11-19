import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchActivity, type GithubProfile } from '../src/github.ts';
import { dateKey, normalizeDays, type ContributionDay } from '../src/metrics.ts';
import { renderSvg, renderPlaceholder } from '../src/render.ts';

const demo = process.argv.includes('--demo');
const username = process.env.GITHUB_USERNAME || 'ThiagoAciole';
const endKey = demo ? '2026-11-18' : dateKey(new Date());

function makeDemoDays(): ContributionDay[] {
  return normalizeDays([], endKey).map((day, index) => ({
    date: day.date,
    contributionCount: (index * 17 + Math.floor(index / 7) * 11) % 13 < 4
      ? 0 : ((index * 7 + Math.floor(index / 13)) % 18) + 1,
  }));
}

const activity = demo
  ? {
    days: makeDemoDays(),
    profile: {
      publicRepos: 45,
      createdAt: '2020-04-01T00:00:00Z',
      location: 'Campina Grande, Brazil',
    } satisfies GithubProfile,
  }
  : await fetchActivity(username, process.env.GITHUB_TOKEN ?? '', endKey);

const days = normalizeDays(activity.days, endKey);
await mkdir('assets', { recursive: true });
for (const variant of ['desktop', 'mobile', 'detailed'] as const) {
  const file = demo
    ? variant === 'desktop' ? 'contributions-demo.svg' : `contributions-demo-${variant}.svg`
    : variant === 'desktop' ? 'github-activity.svg' : variant === 'mobile' ? 'github-activity-mobile.svg' : 'contributions-detailed.svg';
  const filepath = join('assets', file);
  await writeFile(filepath, renderSvg(days, { variant, username, profile: activity.profile, demo }), 'utf8');
  console.log(`Generated ${filepath} (${demo ? 'DEMO' : 'GitHub API'} data)`);
}

if (process.argv.includes('--placeholder')) {
  await writeFile(join('assets', 'github-activity.svg'), renderPlaceholder('desktop'), 'utf8');
  await writeFile(join('assets', 'github-activity-mobile.svg'), renderPlaceholder('mobile'), 'utf8');
  await writeFile(join('assets', 'contributions-detailed.svg'), renderPlaceholder('detailed'), 'utf8');
}
