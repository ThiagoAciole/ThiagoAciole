import type { ContributionDay } from './metrics.ts';

export type GithubProfile = {
  publicRepos: number;
  createdAt: string;
  location: string | null;
};
export type GithubActivity = { days: ContributionDay[]; profile: GithubProfile };

type UserPayload = {
  data?: { user?: {
    createdAt?: string;
    location?: string | null;
    repositories?: { totalCount: number };
    contributionsCollection?: {
      contributionCalendar?: {
        weeks?: Array<{ contributionDays: ContributionDay[] }>;
      };
    };
  } | null };
  errors?: Array<{ message: string }>;
};

const DAY = 86_400_000;
const dateKey = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

async function graphql(token: string, query: string, variables: Record<string, string>): Promise<UserPayload> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'github-activity-svg',
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}`);
  const payload = await response.json() as UserPayload;
  if (payload.errors?.length) throw new Error(payload.errors.map(e => e.message).join('; '));
  return payload;
}

const PROFILE = `query($login: String!) {
  user(login: $login) {
    createdAt location
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
  }
}`;
const CALENDAR = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

// GitHub's contributionsCollection accepts a maximum one-year interval.
// Splitting by <=365 calendar days avoids crossing that limit, including leap years.
export function historicalWindows(startKey: string, endKey: string): Array<{ from: string; to: string }> {
  const start = Date.parse(`${startKey}T00:00:00Z`);
  const end = Date.parse(`${endKey}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('Invalid historical interval');
  const windows: Array<{ from: string; to: string }> = [];
  for (let first = start; first <= end; first += DAY * 365) {
    const last = Math.min(first + DAY * 364, end);
    windows.push({ from: dateKey(first), to: dateKey(last) });
  }
  return windows;
}

export async function fetchActivity(username: string, token: string, endKey: string): Promise<GithubActivity> {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) throw new Error('Invalid GitHub username');
  const result = (await graphql(token, PROFILE, { login: username })).data?.user;
  if (!result?.createdAt || !result.repositories || !Number.isFinite(Date.parse(result.createdAt))) {
    throw new Error(`Missing profile data for ${username}`);
  }
  const startKey = result.createdAt.slice(0, 10);
  const windows = historicalWindows(startKey, endKey);
  const byDate = new Map<string, number>();
  // Avoid multi-year GraphQL queries, deduplicate weekly spillover days.
  for (const window of windows) {
    const calendar = (await graphql(token, CALENDAR, {
      login: username,
      from: `${window.from}T00:00:00Z`,
      to: `${window.to}T23:59:59Z`,
    })).data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar?.weeks) throw new Error(`Missing contribution calendar for ${window.from}–${window.to}`);
    for (const week of calendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.date >= window.from && day.date <= window.to) {
          if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0) throw new Error(`Invalid daily contribution: ${day.date}`);
          if (byDate.has(day.date)) throw new Error(`Repeated contribution date ${day.date}`);
          byDate.set(day.date, day.contributionCount);
        }
      }
    }
  }
  return {
    days: [...byDate].map(([date, contributionCount]) => ({ date, contributionCount })).sort((a,b) => a.date.localeCompare(b.date)),
    profile: {
      createdAt: result.createdAt,
      location: result.location ?? null,
      publicRepos: result.repositories.totalCount,
    },
  };
}
