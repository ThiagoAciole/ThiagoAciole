import type { ContributionDay } from './metrics.ts';

type GithubResponse = {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar?: {
          weeks?: Array<{ contributionDays: ContributionDay[] }>;
        };
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
};

export async function fetchContributions(username: string, token: string, endKey: string): Promise<ContributionDay[]> {
  if (!token) throw new Error('GITHUB_TOKEN is required to fetch real contributions');
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) throw new Error('Invalid GitHub username');
  const from = new Date(`${endKey}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 364);
  const to = `${endKey}T23:59:59.000Z`;
  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'aciole-contributions',
    },
    body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), to } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status} (${response.statusText})`);
  const payload = await response.json() as GithubResponse;
  if (payload.errors?.length) throw new Error(payload.errors.map(error => error.message).join('; '));
  const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error(`Contribution data not available for ${username}`);
  return weeks.flatMap(week => week.contributionDays);
}
