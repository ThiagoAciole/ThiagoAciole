export type ContributionDay = { date: string; contributionCount: number };
export type ActivityMetrics = {
  total: number;
  activeDays: number;
  totalDays: number;
  activeRate: number;
  longestStreak: number;
  busiestWeekday: number | null;
  busiestMonth: string | null;
  peakDay: ContributionDay | null;
};

const ONE_DAY = 86_400_000;
export const dateKey = (date: Date): string => date.toISOString().slice(0, 10);
export function dayRange(endKey: string, total = 365): string[] {
  const end = Date.parse(`${endKey}T00:00:00Z`);
  if (!Number.isFinite(end) || dateKey(new Date(end)) !== endKey) {
    throw new Error(`Invalid date: ${endKey}`);
  }
  return Array.from({ length: total }, (_, i) => dateKey(new Date(end - (total - i - 1) * ONE_DAY)));
}

// Calendar weeks can include extra days outside the requested time window.
// Normalize strictly to the requested 365-day range; never double-count.
export function normalizeDays(days: ContributionDay[], endKey: string): ContributionDay[] {
  const byDate = new Map<string, number>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isInteger(day.contributionCount) || day.contributionCount < 0) {
      throw new Error('Invalid contribution day in GitHub API response');
    }
    if (byDate.has(day.date)) throw new Error(`Duplicate contribution date: ${day.date}`);
    byDate.set(day.date, day.contributionCount);
  }
  return dayRange(endKey).map(date => ({ date, contributionCount: byDate.get(date) ?? 0 }));
}

export function calculateMetrics(days: ContributionDay[]): ActivityMetrics {
  if (!days.length) throw new Error('Cannot calculate metrics from an empty calendar');
  let total = 0;
  let activeDays = 0;
  let streak = 0;
  let longestStreak = 0;
  let peakDay: ContributionDay | null = null;
  const monthCounts = new Map<string, number>();
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of days) {
    const count = day.contributionCount;
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
    total += count;
    weekdayCounts[weekday] += count;
    monthCounts.set(day.date.slice(0, 7), (monthCounts.get(day.date.slice(0, 7)) ?? 0) + count);
    if (count > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
    if (count > (peakDay?.contributionCount ?? 0)) peakDay = day;
  }
  const busiestMonth = total ? [...monthCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] : null;
  const busiestWeekday = total ? weekdayCounts.indexOf(Math.max(...weekdayCounts)) : null;
  return {
    total, activeDays, totalDays: days.length,
    activeRate: Math.round((activeDays / days.length) * 100),
    longestStreak, busiestMonth, busiestWeekday, peakDay,
  };
}

export function intensity(count: number, high: number): number {
  if (count === 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((count / Math.max(1, high)) * 4)));
}
export function intensityReference(days: ContributionDay[]): number {
  const positives = days.map(day => day.contributionCount).filter(Boolean).sort((a, b) => a - b);
  return positives.length ? positives[Math.floor((positives.length - 1) * .85)] : 1;
}

// Full account history, inclusive, with zeroes for dates not returned by the API.
export function normalizeDaysBetween(days: ContributionDay[], startKey: string, endKey: string): ContributionDay[] {
  const start = Date.parse(`${startKey}T00:00:00Z`);
  const end = Date.parse(`${endKey}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('Invalid date interval');
  const seen = new Map<string, number>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isInteger(day.contributionCount) || day.contributionCount < 0 || seen.has(day.date)) {
      throw new Error(`Invalid or repeated contribution date ${day.date}`);
    }
    seen.set(day.date, day.contributionCount);
  }
  return Array.from({ length: Math.round((end - start) / ONE_DAY) + 1 }, (_, index) => {
    const date = dateKey(new Date(start + index * ONE_DAY));
    return { date, contributionCount: seen.get(date) ?? 0 };
  });
}

export function monthlyContributionCounts(days: ContributionDay[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + day.contributionCount);
  }
  return counts;
}
