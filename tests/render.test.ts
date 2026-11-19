import assert from 'node:assert/strict';
import test from 'node:test';
import { dayRange } from '../src/metrics.ts';
import { joinedYears, renderSvg, renderPlaceholder } from '../src/render.ts';

const days = dayRange('2026-11-18').map((date, i) => ({ date, contributionCount: i % 3 }));
const profile = { publicRepos: 45, location: 'Campina Grande, Brazil', createdAt: '2020-04-01T00:00:00Z' };

test('compact SVG includes public profile data and 112 heatmap tiles', () => {
  const svg = renderSvg(days, { variant: 'desktop', username: 'ThiagoAciole', profile });
  assert.match(svg, /viewBox="0 0 785 226"/);
  assert.match(svg, /45 Public Repos/);
  assert.match(svg, /Campina Grande, Brazil/);
  assert.match(svg, /Joined GitHub 6 years ago/);
  assert.equal((svg.match(/<rect x="/g) ?? []).length, 16 * 7);
  assert.doesNotMatch(svg, /Most active month/);
  assert.match(svg, /fill-opacity:\.94/);
});

test('detailed SVG adds compact bottom summary', () => {
  const svg = renderSvg(days, { variant: 'detailed', username: 'ThiagoAciole', profile });
  assert.match(svg, /viewBox="0 0 785 307"/);
  assert.match(svg, /Most active month/);
  assert.match(svg, /Active day rate/);
});

test('mobile SVG fits 420px viewBox with stacked heatmap', () => {
  const svg = renderSvg(days, { variant: 'mobile', username: 'ThiagoAciole', profile, demo: true });
  assert.match(svg, /viewBox="0 0 420 342"/);
  assert.match(svg, /DEMO DATA/);
});

test('date formatting handles years and months', () => {
  assert.equal(joinedYears('2025-11-19T00:00:00Z', '2026-11-18'), 'Joined GitHub 11 months ago');
  assert.equal(joinedYears('2020-05-01T00:00:00Z', '2026-11-18'), 'Joined GitHub 6 years ago');
});

test('untrusted public profile text is XML escaped', () => {
  const svg = renderSvg(days, { variant: 'desktop', username: 'ThiagoAciole', profile: { ...profile, location: '<script>alert(1)</script>' } });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('placeholder has no synthetic statistics', () => {
  assert.doesNotMatch(renderPlaceholder('desktop'), /45 Public Repos/);
});
