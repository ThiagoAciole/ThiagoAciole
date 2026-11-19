import { calculateMetrics, intensity, monthlyContributionCounts, type ContributionDay } from './metrics.ts';
import type { GithubProfile } from './github.ts';

type Variant = 'desktop' | 'mobile' | 'detailed';
type RenderOptions = { variant: Variant; username: string; profile: GithubProfile; demo?: boolean };
const COLORS = ['#302239', '#49306c', '#6f43ab', '#9458e8', '#c393ff'];
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const xml = (s: string): string => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const format = (value: number): string => new Intl.NumberFormat('en-US').format(value);
const styles = `<style>
  text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
  .surface{fill:#1b1b1d;fill-opacity:.94}
  .primary{fill:#f0eef4}.muted{fill:#a39ca9}.accent{stroke:#a66bfa}
  .empty{fill:#32243d}
  @media(prefers-color-scheme:light){.surface{fill:#f4f1f8;fill-opacity:.92}.primary{fill:#24202b}.muted{fill:#746f7e}.empty{fill:#e7dff0}}
</style>`;

function icon(kind: 'github' | 'repo' | 'clock', x: number, y: number, size: number): string {
  const paths = {
    github: '<path d="M9 19c-5 1.5-5-2.5-7-3"/><path d="M15 22v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 19 4.77 5.07 5.07 0 0 0 18.91 1S17.73.65 15 2.48a13.38 13.38 0 0 0-7 0C5.27.65 4.09 1 4.09 1A5.07 5.07 0 0 0 4 4.77 5.44 5.44 0 0 0 2.5 8.51c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 8 18.13V22"/>',
    repo: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  };
  return `<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" class="accent" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</g>`;
}

// A tile represents a MONTH, not a day. Every account year stays visible.
function monthlyHeatmap(days: ContributionDay[], { mobile, x, y }: { mobile: boolean; x: number; y: number }): string {
  const firstYear = Number(days[0].date.slice(0,4));
  const lastYear = Number(days.at(-1)!.date.slice(0,4));
  const counts = monthlyContributionCounts(days);
  const nonzero = [...counts.values()].filter(n => n > 0).sort((a,b) => a - b);
  const high = nonzero.length ? nonzero[Math.floor((nonzero.length - 1)*0.85)] : 1;
  const dx = mobile ? 27 : 26;
  const dy = mobile ? 18.5 : 19.5;
  const cell = mobile ? 16 : 17;
  const labels = MONTHS.map((m,i) => `<text class="muted" x="${x+i*dx+cell/2}" y="${y-12}" text-anchor="middle" font-size="${mobile?9:10}">${m}</text>`).join('');
  const tiles: string[] = [labels];
  for(let year=firstYear;year<=lastYear;year++) {
    const row=year-firstYear;
    tiles.push(`<text class="muted" x="${x-13}" y="${y+row*dy+cell-4}" text-anchor="end" font-size="${mobile?10:11}">${year}</text>`);
    for(let month=1;month<=12;month++) {
      const key=`${year}-${String(month).padStart(2,'0')}`;
      if(!counts.has(key)) continue; // Before joining or after today: genuinely out of range
      const count=counts.get(key)!;
      const level=intensity(count, high);
      const shade=level===0?'class="empty"':`fill="${COLORS[level]}"`;
      const xx=x+(month-1)*dx, yy=y+row*dy;
      tiles.push(`<rect x="${xx}" y="${yy}" width="${cell}" height="${cell}" rx="5" ${shade}><title>${xml(key)}: ${count} contributions</title></rect>`);
    }
  }
  return tiles.join('\n');
}

export function renderSvg(days: ContributionDay[], { variant, username, profile, demo=false }: RenderOptions): string {
  if (!days.length) throw new Error('Empty GitHub contribution history');
  const mobile = variant==='mobile';
  const years = Number(days.at(-1)!.date.slice(0,4))-Number(days[0].date.slice(0,4))+1;
  const width = mobile ? 420 : 785;
  const rowsBottom = (mobile ? 192 : 41) + years*(mobile?18.5:19.5);
  const height = Math.ceil(mobile ? Math.max(328,rowsBottom+14) : Math.max(186,rowsBottom+8)) + (variant==='detailed'?34:0);
  const total=calculateMetrics(days).total;
  const since=profile.createdAt.slice(0,4);
  const entries: Array<{ glyph:'github'|'repo'|'clock'; label:string }> = [
    {glyph:'github',label:`${format(total)} lifetime contributions`},
    {glyph:'repo',label:`${format(profile.publicRepos)} public repositories`},
    {glyph:'clock',label:`On GitHub since ${since}`},
  ];
  const ys = mobile ? [39,78,117] : [49,101,153];
  const info = entries.map((entry,i) => `${icon(entry.glyph, mobile?24:30, ys[i]-23, mobile?22:25)}<text class="primary" x="${mobile?63:71}" y="${ys[i]}" font-size="${mobile?16:17}" font-weight="${i===0?650:500}">${xml(entry.label)}</text>`).join('\n');
  const map = monthlyHeatmap(days, { mobile, x:mobile?69:422, y:mobile?183:42 });
  const period = `${since}–${days.at(-1)!.date.slice(0,4)}`;
  const foot = mobile ? `<text class="muted" x="24" y="153" font-size="11">MONTHLY ACTIVITY · ${period}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc">
  <title id="title">${xml(username)} — GitHub activity</title>
  <desc id="desc">${format(total)} lifetime contributions and ${profile.publicRepos} public repositories. Monthly contribution heatmap from ${period}.${demo?' Synthetic example values.':''}</desc>
  ${styles}
  <rect class="surface" width="${width}" height="${height}" rx="23"/>
  ${info}
  ${map}
  ${foot}
</svg>`;
}

export function renderPlaceholder(variant: Variant): string {
  const width=variant==='mobile'?420:785;
  const height=variant==='mobile'?328:186;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="GitHub activity awaiting first sync">${styles}<rect class="surface" width="${width}" height="${height}" rx="23"/><text class="muted" x="30" y="${height/2}" font-size="15">Waiting for contribution history sync</text></svg>`;
}
