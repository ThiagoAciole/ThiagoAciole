import assert from 'node:assert/strict';
import test from 'node:test';
import { dayRange } from '../src/metrics.ts';
import { joinedText, renderSvg, renderPlaceholder } from '../src/render.ts';

const days = dayRange('2026-11-18').map((date, i) => ({ date, contributionCount: i % 3 }));
const profile = { publicRepos: 45, location: 'Campina Grande, Brazil', createdAt: '2020-04-01T00:00:00Z' };

test('desktop SVG shows profile rows beside a transparent TUI heatmap', () => {
  const svg = renderSvg(days, { variant: 'desktop', username: 'ThiagoAciole', profile });
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /activity · 2020–2026/);
  assert.doesNotMatch(svg, /<rect class="body"/); // no background fill
  assert.doesNotMatch(svg, /\$|gh profile/); // no prompt line
  assert.match(svg, />\d[\d,]* Contributions on GitHub</);
  assert.match(svg, />45 Public Repos</);
  assert.match(svg, />Joined GitHub 6 years ago</);
  assert.match(svg, />Campina Grande, Brazil</);
  assert.equal((svg.match(/<rect class="c\d"/g) ?? []).length, 13); // Nov 2025 through Nov 2026
});

test('mobile SVG keeps the same rows and marks synthetic data in demo mode', () => {
  const svg = renderSvg(days, { variant: 'mobile', username: 'ThiagoAciole', profile, demo: true });
  assert.match(svg, />45 Public Repos</);
  assert.match(svg, /Synthetic example values/);
});

test('location row is omitted when the profile has none', () => {
  const svg = renderSvg(days, { variant: 'desktop', username: 'ThiagoAciole', profile: { ...profile, location: null } });
  assert.doesNotMatch(svg, /Campina/);
  assert.match(svg, />Joined GitHub/);
});

test('joined text uses whole years, months, and singular forms', () => {
  assert.equal(joinedText('2025-11-19T00:00:00Z', '2026-11-18'), 'Joined GitHub 11 months ago');
  assert.equal(joinedText('2020-05-01T00:00:00Z', '2026-11-18'), 'Joined GitHub 6 years ago');
  assert.equal(joinedText('2025-10-01T00:00:00Z', '2026-11-18'), 'Joined GitHub 1 year ago');
  assert.equal(joinedText('2026-11-01T00:00:00Z', '2026-11-18'), 'Joined GitHub 0 months ago');
});

test('username is XML escaped in the title and description', () => {
  const svg = renderSvg(days, { variant: 'desktop', username: '<b>x</b>', profile });
  assert.doesNotMatch(svg, /<b>x<\/b>/);
  assert.match(svg, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('placeholder has no synthetic statistics', () => {
  const svg = renderPlaceholder('desktop');
  assert.doesNotMatch(svg, /45 Public Repos/);
  assert.match(svg, /waiting for first sync/);
});
