import { calculateMetrics, intensity, intensityReference, type ContributionDay } from './metrics.ts';
import type { GithubProfile } from './github.ts';

type Variant = 'desktop' | 'mobile' | 'detailed';
type RenderOptions = { variant: Variant; username: string; profile: GithubProfile; demo?: boolean };
const COLORS = ['#302239', '#49306c', '#6f43ab', '#9458e8', '#c393ff'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;
const WEEK_COUNT = 16;
const xml = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const fmt = (number: number): string => new Intl.NumberFormat('en-US').format(number);

const styles = `<style>
  text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
  .surface{fill:#1b1b1d;fill-opacity:.94}
  .primary{fill:#eceaf1}.muted{fill:#95919d}.accent{fill:#995ee9}
  .rule{stroke:#39363d}.empty{fill:#32243d}
  @media(prefers-color-scheme:light){
    .surface{fill:#f4f1f8;fill-opacity:.92}
    .primary{fill:#24202b}.muted{fill:#746f7e}.accent{fill:#7a39d1}
    .rule{stroke:#dcd4e4}.empty{fill:#e7dff0}
  }
</style>`;

function icon(kind: 'github' | 'repo' | 'clock' | 'pin', x: number, y: number, size: number): string {
  const paths = {
    github: '<path d="M9 19c-5 1.5-5-2.5-7-3"/><path d="M15 22v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77 5.44 5.44 0 0 0 2.5 8.51c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22"/>',
    repo: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  };
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="#995ee9" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</g>`;
}

export function joinedYears(createdAt: string, endDate: string): string {
  const start = new Date(createdAt);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (!Number.isFinite(start.getTime())) return 'Joined GitHub';
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (end.getUTCMonth() < start.getUTCMonth() || (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() < start.getUTCDate())) years--;
  if (years >= 1) return `Joined GitHub ${years} year${years === 1 ? '' : 's'} ago`;
  const months = Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() - (end.getUTCDate() < start.getUTCDate() ? 1 : 0));
  return months ? `Joined GitHub ${months} month${months === 1 ? '' : 's'} ago` : 'Joined GitHub recently';
}

function short(value: string, max = 31): string { return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value; }

function heatmap(days: ContributionDay[], x: number, y: number, cell: number, step: number): string {
  const end = Date.parse(`${days.at(-1)?.date}T00:00:00Z`);
  const currentSunday = end - new Date(end).getUTCDay() * DAY_MS;
  const firstSunday = currentSunday - (WEEK_COUNT - 1) * 7 * DAY_MS;
  const byDate = new Map(days.map(day => [day.date, day.contributionCount]));
  const high = intensityReference(days);
  const tiles: string[] = [];
  for (let week = 0; week < WEEK_COUNT; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const time = firstSunday + (week * 7 + weekday) * DAY_MS;
      const date = new Date(time).toISOString().slice(0, 10);
      const count = byDate.get(date);
      const isFuture = time > end;
      const level = intensity(count ?? 0, high);
      const shade = level === 0 ? 'class="empty"' : `fill="${COLORS[level]}"`;
      const cx = x + week * step;
      const cy = y + weekday * step;
      tiles.push(`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${Math.round(cell * .28)}" ${shade}${isFuture ? ' opacity=".22"' : ''}><title>${xml(isFuture ? `${date}: future day` : `${date}: ${count ?? 0} contributions`)}</title></rect>`);
    }
  }
  return tiles.join('\n');
}

function footer(x: number, y: number, caption: string, value: string): string {
  return `<text class="muted" x="${x}" y="${y}" font-size="13">${xml(caption)}</text><text class="primary" x="${x}" y="${y + 24}" font-size="17" font-weight="650">${xml(value)}</text>`;
}

export function renderSvg(days: ContributionDay[], { variant, username, profile, demo = false }: RenderOptions): string {
  if (!days.length) throw new Error('Cannot render an empty contribution calendar');
  const mobile = variant === 'mobile';
  const detailed = variant === 'detailed';
  const width = mobile ? 420 : 785;
  const height = mobile ? 342 : (detailed ? 307 : 226);
  const metrics = calculateMetrics(days);
  const leftX = mobile ? 23 : 31;
  const rows = mobile ? [29, 66, 103, 140] : [43, 89, 135, 181];
  const iconSize = mobile ? 21 : 25;
  const textX = mobile ? 57 : 72;
  const textSize = mobile ? 14 : 15;
  const joined = joinedYears(profile.createdAt, days.at(-1)!.date);
  const lines: { glyph: 'github'|'repo'|'clock'|'pin'; label: string }[] = [
    { glyph: 'github', label: `${fmt(metrics.total)} Contributions on GitHub` },
    { glyph: 'repo', label: `${fmt(profile.publicRepos)} Public Repos` },
    { glyph: 'clock', label: joined },
    { glyph: 'pin', label: profile.location?.trim() || 'Location not specified' },
  ];
  const info = lines.map(({ glyph, label }, i) => `${icon(glyph, leftX, rows[i] - 24, iconSize)}<text class="primary" x="${textX}" y="${rows[i]}" font-size="${textSize}">${xml(short(label, mobile ? 37 : 32))}</text>`).join('\n');
  const map = mobile ? heatmap(days, 24, 176, 17, 23) : heatmap(days, 343, 25, 19.5, 24.8);
  const footerY = 245;
  const summary = detailed ? `<line class="rule" x1="24" y1="${footerY}" x2="761" y2="${footerY}" stroke-width="1"/>
    ${footer(31, 268, 'Most active month', metrics.busiestMonth ? `${MONTHS[Number(metrics.busiestMonth.slice(5, 7)) - 1]} ${metrics.busiestMonth.slice(0,4)}` : '—')}
    ${footer(340, 268, 'Most active weekday', metrics.busiestWeekday === null ? '—' : DAYS[metrics.busiestWeekday])}
    ${footer(649, 268, 'Active day rate', `${metrics.activeRate}%`)}` : '';
  const demoMark = demo ? `<text x="${mobile ? 398 : 750}" y="${mobile ? 164 : height - 9}" font-size="9" font-weight="600" text-anchor="end" fill="#c393ff">DEMO DATA</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub Activity${demo ? ' — demo' : ''}</title>
  <desc id="desc">${xml(username)}: ${metrics.total} contributions over the last 365 days, ${profile.publicRepos} public repositories, ${metrics.activeRate}% active day rate. Heatmap shows the most recent 16 calendar weeks.${demo ? ' Synthetic demo data, not actual account metrics.' : ''}</desc>
  ${styles}
  <rect class="surface" width="${width}" height="${height}" rx="${mobile ? 22 : 26}"/>
  ${info}
  ${map}
  ${summary}
  ${demoMark}
</svg>`;
}

export function renderPlaceholder(variant: Variant): string {
  const mobile = variant === 'mobile';
  const width = mobile ? 420 : 785;
  const height = mobile ? 342 : variant === 'detailed' ? 307 : 226;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="GitHub Activity awaiting data sync">
    ${styles}
    <rect class="surface" width="${width}" height="${height}" rx="25"/>
    
    <text class="muted" x="32" y="${mobile ? 98 : 134}" font-size="${mobile ? 13 : 15}">Waiting for first GitHub Actions sync</text>
    <text x="32" y="${mobile ? 130 : 165}" font-size="12" fill="#c393ff">Actions → Update contribution heatmap</text>
  </svg>`;
}
