import { calculateMetrics, intensity, monthlyContributionCounts, type ContributionDay } from './metrics.ts';
import type { GithubProfile } from './github.ts';

type Variant = 'desktop' | 'mobile';
type RenderOptions = { variant: Variant; username: string; profile: GithubProfile; demo?: boolean };
type Geometry = {
  width: number;
  height: number;
  infoY: number[];   // baselines for the profile rows
  divider: string;   // path separating the info panel from the heatmap
  heatX: number;
  heatY: number;
  dx: number;
  dy: number;
  cell: number;
};

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const BORDER_Y = 8.5; // y of the TUI box's top edge; the title sits on it
const TITLE_CHAR = 7.4; // approximate monospace advance, pinned with textLength
const xml = (s: string): string => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const format = (value: number): string => new Intl.NumberFormat('en-US').format(value);

// Transparent canvas: no background fill, so the card inherits the page behind it.
// Colors follow the viewer's theme via prefers-color-scheme (GitHub does the same).
const styles = `<style>
  text{font-family:'JetBrains Mono','Fira Code',Consolas,'Liberation Mono',monospace}
  .line{stroke:#30363d;fill:none}
  .title{fill:#e6edf3}
  .text{fill:#e6edf3}
  .muted{fill:#8b949e}
  .c0{fill:#161b22}.c1{fill:#0e4429}.c2{fill:#006d32}.c3{fill:#26a641}.c4{fill:#39d353}
  @media (prefers-color-scheme: light){
    .line{stroke:#d0d7de}
    .title{fill:#1f2328}
    .text{fill:#1f2328}
    .muted{fill:#656d76}
    .c0{fill:#ebedf0}.c1{fill:#9be9a8}.c2{fill:#40c463}.c3{fill:#30a14e}.c4{fill:#216e39}
  }
</style>`;

// Single-line TUI box: square corners, with the title set into the top edge.
function frame(width: number, height: number, title: string): string {
  const titleX = 18;
  const titleLength = title.length * TITLE_CHAR;
  const gapEnd = titleX + titleLength + 6;
  return `<path class="line" d="M0.5 ${BORDER_Y}H12M${gapEnd} ${BORDER_Y}H${width - 0.5}V${height - 0.5}H0.5V${BORDER_Y}"/>
  <text class="title" x="${titleX}" y="${BORDER_Y + 4}" font-size="12" textLength="${titleLength}" lengthAdjust="spacingAndGlyphs">${xml(title)}</text>`;
}

// "Joined GitHub N years/months ago", measured against the last day of the data
// so the output is deterministic for a given generation.
export function joinedText(createdAt: string, referenceKey: string): string {
  const start = new Date(createdAt);
  const end = new Date(`${referenceKey}T00:00:00Z`);
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `Joined GitHub ${years} year${years === 1 ? '' : 's'} ago`;
  }
  return `Joined GitHub ${months} month${months === 1 ? '' : 's'} ago`;
}

function geometry(variant: Variant, years: number): Geometry {
  if (variant === 'mobile') {
    const heatX = 52, dx = 27, cell = 16, dy = 18.5, heatY = 146;
    return {
      width: heatX + 11 * dx + cell + 18,
      height: Math.ceil(heatY + years * dy + 16),
      infoY: [40, 62, 84, 106],
      divider: 'M0.5 116H{W}',
      heatX, heatY, dx, dy, cell,
    };
  }
  const heatX = 336, dx = 26, cell = 17, dy = 19.5, heatY = 36;
  return {
    width: heatX + 11 * dx + cell + 18,
    height: Math.ceil(Math.max(heatY + years * dy + 16, 150)),
    infoY: [50, 76, 102, 128],
    divider: 'M260 ' + BORDER_Y + 'V{H}',
    heatX, heatY, dx, dy, cell,
  };
}

// A tile represents a MONTH, not a day. Every account year stays visible.
function monthlyHeatmap(days: ContributionDay[], g: Geometry, mobile: boolean): string {
  const firstYear = Number(days[0].date.slice(0,4));
  const lastYear = Number(days.at(-1)!.date.slice(0,4));
  const counts = monthlyContributionCounts(days);
  const nonzero = [...counts.values()].filter(n => n > 0).sort((a,b) => a - b);
  const high = nonzero.length ? nonzero[Math.floor((nonzero.length - 1)*0.85)] : 1;
  const labels = MONTHS.map((m,i) => `<text class="muted" x="${g.heatX+i*g.dx+g.cell/2}" y="${g.heatY-10}" text-anchor="middle" font-size="${mobile?9:10}">${m}</text>`).join('');
  const tiles: string[] = [labels];
  for(let year=firstYear;year<=lastYear;year++) {
    const row=year-firstYear;
    const yy=g.heatY+row*g.dy;
    tiles.push(`<text class="muted" x="${g.heatX-10}" y="${yy+g.cell-4}" text-anchor="end" font-size="${mobile?10:11}">${year}</text>`);
    for(let month=1;month<=12;month++) {
      const key=`${year}-${String(month).padStart(2,'0')}`;
      if(!counts.has(key)) continue; // Before joining or after today: genuinely out of range
      const count=counts.get(key)!;
      const level=intensity(count, high);
      tiles.push(`<rect class="c${level}" x="${g.heatX+(month-1)*g.dx}" y="${yy}" width="${g.cell}" height="${g.cell}" rx="2"><title>${xml(key)}: ${count} contributions</title></rect>`);
    }
  }
  return tiles.join('\n');
}

export function renderSvg(days: ContributionDay[], { variant, username, profile, demo=false }: RenderOptions): string {
  if (!days.length) throw new Error('Empty GitHub contribution history');
  const mobile = variant === 'mobile';
  const firstYear = Number(days[0].date.slice(0,4));
  const lastKey = days.at(-1)!.date;
  const lastYear = Number(lastKey.slice(0,4));
  const g = geometry(variant, lastYear - firstYear + 1);
  const total = calculateMetrics(days).total;
  const since = profile.createdAt.slice(0,4);
  const period = `${since}–${lastYear}`;
  const info = [
    `${format(total)} Contributions on GitHub`,
    `${format(profile.publicRepos)} Public Repos`,
    joinedText(profile.createdAt, lastKey),
    profile.location,
  ].filter((line): line is string => Boolean(line));
  const infoText = info.map((line, i) => `<text class="text" x="20" y="${g.infoY[i]}" font-size="${mobile?12:13}">${xml(line)}</text>`).join('\n  ');
  const divider = g.divider.replace('{W}', String(g.width - 0.5)).replace('{H}', String(g.height - 0.5));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}" role="img" aria-labelledby="title desc">
  <title id="title">${xml(username)} — GitHub activity</title>
  <desc id="desc">${format(total)} contributions and ${profile.publicRepos} public repositories. Monthly contribution heatmap from ${period}.${demo?' Synthetic example values.':''}</desc>
  ${styles}
  ${frame(g.width, g.height, `activity · ${period}`)}
  <path class="line" d="${divider}"/>
  ${infoText}
  ${monthlyHeatmap(days, g, mobile)}
</svg>`;
}

export function renderPlaceholder(variant: Variant): string {
  const g = geometry(variant, 1);
  const height = 189;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width} ${height}" width="${g.width}" height="${height}" role="img" aria-label="GitHub activity awaiting first sync">${styles}${frame(g.width, height, 'activity')}<text class="muted" x="20" y="${BORDER_Y + 30}" font-size="13">waiting for first sync</text></svg>`;
}
