import type { ContributionDay } from './metrics.ts';

export type GithubProfile = {
  publicRepos: number;
  createdAt: string;
  location: string | null;
};

export type GithubActivity = {
  days: ContributionDay[];
  profile: GithubProfile;
};

type GithubResponse = {
  data?: {
    user?: {
      createdAt: string;
      location: string | null;
      repositories: { totalCount: number };
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: Array<{ contributionDays: ContributionDay[] }>;
        };
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
};

export async function fetchActivity(username: string, token: string, endKey: string): Promise<GithubActivity> {
  if (!token) throw new Error('GITHUB_TOKEN is required to fetch real contributions');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) throw new Error('Invalid GitHub username');
  const from = new Date(`${endKey}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 364);
  const to = `${endKey}T23:59:59.000Z`;
  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      createdAt
      location
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
      }
    }
  }`;
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aciole-contributions',
    },
    body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), to } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status} (${response.statusText})`);
  const payload = await response.json() as GithubResponse;
  if (payload.errors?.length) throw new Error(payload.errors.map(error => error.message).join('; '));
  const user = payload.data?.user;
  const weeks = user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!user || !weeks) throw new Error(`GitHub activity not available for ${username}`);
  if (!Number.isInteger(user.repositories.totalCount) || !Number.isFinite(Date.parse(user.createdAt))) {
    throw new Error('Invalid public profile metadata in GitHub response');
  }
  return {
    days: weeks.flatMap(week => week.contributionDays),
    profile: {
      publicRepos: user.repositories.totalCount,
      createdAt: user.createdAt,
      location: user.location,
    },
  };
}
