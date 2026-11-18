import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMetrics, dayRange, intensity, normalizeDays } from '../src/metrics.ts';

// 2026-11-15 Sunday, 2026-11-16 Monday, 2026-11-17 Tuesday, 2026-11-18 Wednesday
const sample = [
  { date: '2026-11-15', contributionCount: 2 },
  { date: '2026-11-16', contributionCount: 3 },
  { date: '2026-11-17', contributionCount: 0 },
  { date: '2026-11-18', contributionCount: 7 },
];
test('normalizes exactly 365 days and zero fills missing days', () => {
  const data = normalizeDays(sample, '2026-11-18');
  assert.equal(data.length, 365);
  assert.equal(data.at(-1)?.contributionCount, 7);
  assert.equal(data.at(-3)?.contributionCount, 3);
  assert.equal(data.at(-4)?.contributionCount, 2);
  assert.equal(data.at(-5)?.contributionCount, 0);
});
test('prevents duplicate contribution dates', () => {
  assert.throws(() => normalizeDays([...sample, sample[0]], '2026-11-18'), /Duplicate/);
});
test('calculates contribution totals, active days, streaks, peaks and weekdays', () => {
  const m = calculateMetrics(sample);
  assert.equal(m.total, 12);
  assert.equal(m.activeDays, 3);
  assert.equal(m.longestStreak, 2);
  assert.equal(m.busiestWeekday, 3); // Wednesday
  assert.equal(m.busiestMonth, '2026-11');
  assert.equal(m.peakDay?.date, '2026-11-18');
  assert.equal(m.activeRate, 75);
});
test('handles zero contributions', () => {
  const m = calculateMetrics(dayRange('2026-11-18', 7).map(date => ({ date, contributionCount: 0 })));
  assert.equal(m.total, 0);
  assert.equal(m.busiestMonth, null);
  assert.equal(m.busiestWeekday, null);
  assert.equal(m.longestStreak, 0);
});
test('intensity clamps to palette', () => {
  assert.equal(intensity(0, 10), 0);
  assert.equal(intensity(1, 10), 1);
  assert.equal(intensity(10, 10), 4);
  assert.equal(intensity(50, 10), 4);
});
