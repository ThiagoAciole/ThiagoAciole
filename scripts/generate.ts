import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchActivity, type GithubProfile } from '../src/github.ts';
import { dateKey, normalizeDaysBetween, type ContributionDay } from '../src/metrics.ts';
import { renderSvg, renderPlaceholder } from '../src/render.ts';

const demo = process.argv.includes('--demo');
const username = process.env.GITHUB_USERNAME || 'ThiagoAciole';
const endKey = demo ? '2026-11-18' : dateKey(new Date());
const demoStart = '2020-04-01';
const exampleDays: ContributionDay[] = normalizeDaysBetween([], demoStart, endKey).map((day,index)=>({
  date:day.date,
  contributionCount:((index*13+Math.floor(index/11))%14<6?0:((index*7+Math.floor(index/13))%9)+1) * (index%365 < 70 ? 0 : (index%365 < 180 ? 1 : (index%365 < 265 ? 2 : 3))),
}));
const activity = demo ? {
  days: exampleDays,
  profile: { publicRepos:45, createdAt: `${demoStart}T00:00:00Z`, location:'Campina Grande, Brazil' } satisfies GithubProfile,
} : await fetchActivity(username, process.env.GITHUB_TOKEN ?? '', endKey);
const days = normalizeDaysBetween(activity.days, activity.profile.createdAt.slice(0,10), endKey);
await mkdir('assets', { recursive:true });
for(const variant of ['desktop','mobile'] as const) {
  const file = demo ? variant === 'desktop' ? 'github-activity-demo.svg' : 'github-activity-demo-mobile.svg'
                    : variant === 'desktop' ? 'github-activity.svg' : 'github-activity-mobile.svg';
  const filepath = join('assets',file);
  await writeFile(filepath,renderSvg(days,{variant,username,profile:activity.profile,demo}),'utf8');
  console.log(`Generated ${filepath} using ${demo?'demo':'GitHub historical'} activity`);
}
if(process.argv.includes('--placeholder')) {
  await writeFile(join('assets','github-activity.svg'),renderPlaceholder('desktop'));
  await writeFile(join('assets','github-activity-mobile.svg'),renderPlaceholder('mobile'));
}
