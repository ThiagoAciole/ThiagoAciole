import { calculateMetrics, intensity, intensityReference, type ContributionDay } from './metrics.ts';

type Variant = 'desktop' | 'mobile';
type RenderOptions = { variant: Variant; username: string; demo?: boolean };
const COLORS = ['#21262d', '#302051', '#583c8e', '#8957e5', '#c297ff'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_MS = 86_400_000;
const xml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const fmt = (number: number): string => new Intl.NumberFormat('en-US').format(number);

function styles(): string {
  return `<style>
    .heading{fill:#f0f6fc}.muted{fill:#8b949e}.accent{fill:#c297ff}
    .card{fill:#161b22;fill-opacity:.74;stroke:#30363d;stroke-width:1}
    .rule{stroke:#30363d;stroke-width:1}.inactive{fill:#21262d}
    text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
    @media(prefers-color-scheme:light){
      .heading{fill:#24292f}.muted{fill:#57606a}.accent{fill:#8250df}
      .card{fill:#f6f8fa;fill-opacity:.85;stroke:#d0d7de}
      .rule{stroke:#d0d7de}.inactive{fill:#eaeef2}
    }
  </style>`;
}
function metricCard(x: number, y: number, w: number, title: string, value: string, foot: string, mobile: boolean): string {
  const h = mobile ? 93 : 91;
  const pad = mobile ? 16 : 22;
  return `<g>
    <rect class="card" x="${x}" y="${y}" width="${w}" height="${h}" rx="13"/>
    <text class="muted" x="${x + pad}" y="${y + 23}" font-size="${mobile ? 12 : 13}">${xml(title)}</text>
    <text class="heading" x="${x + pad}" y="${y + 59}" font-size="${mobile ? 27 : 31}" font-weight="650">${xml(value)}</text>
    <text class="muted" x="${x + pad}" y="${y + 78}" font-size="${mobile ? 10 : 11}">${xml(foot)}</text>
  </g>`;
}
function monthsAndTiles(days: ContributionDay[], startX: number, y: number, step: number, cell: number, fontSize: number): string {
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const startSunday = first.getTime() - first.getUTCDay() * DAY_MS;
  const high = intensityReference(days);
  const monthLabels: string[] = [];
  let lastMonth = '';
  for (const day of days) {
    const currentMonth = day.date.slice(0, 7);
    if (currentMonth === lastMonth) continue;
    lastMonth = currentMonth;
    const ms = Date.parse(`${day.date}T00:00:00Z`);
    const week = Math.floor((ms - startSunday) / (7 * DAY_MS));
    monthLabels.push(`<text class="muted" x="${(startX + week * step).toFixed(1)}" y="${y - 15}" font-size="${fontSize}">${MONTHS[Number(day.date.slice(5, 7)) - 1]}</text>`);
  }
  const tileTags = days.map(day => {
    const ms = Date.parse(`${day.date}T00:00:00Z`);
    const weekday = new Date(ms).getUTCDay();
    const week = Math.floor((ms - startSunday) / (7 * DAY_MS));
    const level = intensity(day.contributionCount, high);
    const x = (startX + week * step).toFixed(1);
    const yy = (y + weekday * step).toFixed(1);
    const fill = level === 0 ? 'class="inactive"' : `fill="${COLORS[level]}"`;
    const caption = `${day.date}: ${day.contributionCount} contributions`;
    return `<rect x="${x}" y="${yy}" width="${cell}" height="${cell}" rx="${Math.max(2, cell * .25)}" ${fill}><title>${xml(caption)}</title></rect>`;
  }).join('');
  return monthLabels.join('') + '\n' + tileTags;
}
function legend(x: number, y: number, step: number, mobile: boolean): string {
  const size = mobile ? 10 : 12;
  const cubes = COLORS.map((color, index) => index === 0
    ? `<rect class="inactive" x="${x + 30 + index * step}" y="${y - 10}" width="${size}" height="${size}" rx="3"/>`
    : `<rect x="${x + 30 + index * step}" y="${y - 10}" width="${size}" height="${size}" rx="3" fill="${color}"/>`).join('');
  return `<g><text class="muted" x="${x}" y="${y}" font-size="11">Less</text>${cubes}<text class="muted" x="${x + 38 + 5 * step}" y="${y}" font-size="11">More</text></g>`;
}
function formattedMonth(key: string | null): string {
  return key ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}` : '—';
}
function label(x: number, y: number, caption: string, value: string, mobile = false): string {
  return `<text class="muted" x="${x}" y="${y}" font-size="${mobile ? 10.5 : 11.5}">${xml(caption)}</text>
    <text class="heading" x="${x}" y="${y + (mobile ? 21 : 23)}" font-size="${mobile ? 14 : 16}" font-weight="600">${xml(value)}</text>`;
}

export function renderSvg(days: ContributionDay[], { variant, username, demo = false }: RenderOptions): string {
  const mobile = variant === 'mobile';
  const width = mobile ? 620 : 1040;
  const height = mobile ? 477 : 486;
  const metrics = calculateMetrics(days);
  const left = mobile ? 24 : 36;
  const right = width - left;
  const xGrid = mobile ? 74 : 105;
  const chartY = mobile ? 261 : 272;
  const step = mobile ? 9.5 : 16;
  const cell = mobile ? 7.6 : 12.8;
  const gridWidth = 53 * step;
  const period = `${days[0].date} → ${days.at(-1)?.date}`;
  const titleY = mobile ? 38 : 45;
  const captionY = mobile ? 57 : 67;
  const cardY = mobile ? 85 : 100;
  const gap = mobile ? 10 : 16;
  const cardW = (width - left * 2 - gap * 2) / 3;
  const cards = [
    ['Contributions', fmt(metrics.total), 'Last 365 days'],
    ['Active days', String(metrics.activeDays), `${metrics.activeRate}% of the year`],
    ['Longest streak', `${metrics.longestStreak} days`, 'Consecutive days'],
  ].map(([heading, number, foot], index) => metricCard(left + index * (cardW + gap), cardY, cardW, heading, number, foot, mobile)).join('\n');
  const sectionY = mobile ? 215 : 231;
  const legendY = mobile ? 372 : 398;
  const dividerY = mobile ? 394 : 420;
  const footerY = mobile ? 423 : 450;
  const footXs = mobile ? [24, 230, 433] : [36, 360, 694];
  const summary = [
    label(footXs[0], footerY, 'Most active month', formattedMonth(metrics.busiestMonth), mobile),
    label(footXs[1], footerY, 'Most active weekday', metrics.busiestWeekday === null ? '—' : DAYS[metrics.busiestWeekday], mobile),
    label(footXs[2], footerY, 'Active day rate', `${metrics.activeRate}%`, mobile),
  ].join('\n');
  const roundedPeriod = mobile ? 'PAST 365 DAYS' : period;
  const monthSize = mobile ? 8.6 : 10.5;
  const weekdays = [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].map(([day, name]) => `<text class="muted" x="${left}" y="${chartY + Number(day) * step + cell - 1}" font-size="${mobile ? 10 : 11}">${name}</text>`).join('\n');
  const demoNotice = demo ? `<text x="${right}" y="${captionY}" font-size="11" font-weight="700" text-anchor="end" fill="#c297ff">DEMO DATA</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">${xml(username)} — Contribution Activity${demo ? ' (demo)' : ''}</title>
  <desc id="desc">Purple contribution heatmap: ${metrics.total} contributions, ${metrics.activeDays} active days, longest streak ${metrics.longestStreak} days, over the last 365 days.${demo ? ' Synthetic example data, not actual account statistics.' : ''}</desc>
  ${styles()}
  <g>
    <circle cx="${left + 8}" cy="${titleY - 6}" r="6" fill="#8957e5"/>
    <circle cx="${left + 8}" cy="${titleY - 6}" r="2.6" fill="#e9d8fd"/>
    <text class="heading" x="${left + 24}" y="${titleY}" font-size="${mobile ? 21 : 23}" font-weight="650" letter-spacing="-.5">Contribution Activity</text>
    <text class="muted" x="${left}" y="${captionY}" font-size="${mobile ? 11 : 12}">${xml(username)} / your year in code</text>
    ${demoNotice}
    ${cards}
    <text class="heading" x="${left}" y="${sectionY}" font-size="${mobile ? 13 : 14}" font-weight="600">Activity overview</text>
    <text class="muted" x="${right}" y="${sectionY}" font-size="${mobile ? 9.5 : 11.5}" text-anchor="end">${xml(roundedPeriod)}</text>
    ${weekdays}
    ${monthsAndTiles(days, xGrid, chartY, step, cell, monthSize)}
    ${legend(right - (mobile ? 172 : 205), legendY, mobile ? 15 : 19, mobile)}
    <line class="rule" x1="${left}" y1="${dividerY}" x2="${right}" y2="${dividerY}"/>
    ${summary}
  </g>
</svg>`;
}

export function renderPlaceholder(variant: Variant): string {
  const mobile = variant === 'mobile';
  const width = mobile ? 620 : 1040;
  const height = mobile ? 477 : 486;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
    <title id="title">Contribution Activity — awaiting first sync</title>
    <desc id="desc">The heatmap will appear after the first successful GitHub Actions workflow.</desc>
    ${styles()}
    <text class="heading" x="35" y="57" font-family="Arial,sans-serif" font-size="24" font-weight="600">Contribution Activity</text>
    <text class="muted" x="35" y="89" font-family="Arial,sans-serif" font-size="15">Awaiting first GitHub Actions sync.</text>
    <rect class="card" x="35" y="115" width="${width - 70}" height="${height - 160}" rx="14"/>
    <text class="accent" x="${width/2}" y="${height/2}" font-family="Arial,sans-serif" text-anchor="middle" font-size="${mobile ? 16 : 20}">Run “Update contribution heatmap” in Actions</text>
  </svg>`;
}
