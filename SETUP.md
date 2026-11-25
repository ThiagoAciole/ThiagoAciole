# GitHub Activity Card — Terminal Style

Self-hosted GitHub profile card rendered as SVG with TypeScript and the GitHub GraphQL API. No npm dependencies or third-party image services.

## Output

- `assets/github-activity.svg` — desktop card (785 px wide), shown in the README on wide viewports.
- `assets/github-activity-mobile.svg` — stacked mobile layout (420 px wide), shown on viewports up to 520 px.

The README uses `<picture>` to switch between the two.

## Data and definitions

`src/github.ts` fetches `user.createdAt`, `user.location` and the public owner repository count, then fetches the full contribution calendar in windows of at most 365 days (GitHub's limit per query). `src/metrics.ts` builds the all-time day series and the monthly totals.

- **lifetime contributions**: sum of every day since the account was created.
- **repos**: public repositories owned by the user.
- **member since**: the year of the account's creation.
- **Heatmap**: one tile per month, from the account's first year through the current year. Tile intensity is relative to the 85th-percentile month.

GitHub visibility rules apply: the token can generally count public contributions, and private contribution visibility may differ from the signed-in profile.

## Workflows

- `.github/workflows/aciole-contributions.yml` runs `npm test`, then `npm run generate`, and commits the two activity SVGs. It runs on pushes to `src/`, `scripts/`, `package.json`, or the workflow itself, and daily at 08:13 UTC.
- `.github/workflows/update-profile-stats.yml` writes `assets/github.svg`. That file is not referenced by the README.

The workflows need `contents: write` permission. Do not commit personal access tokens.

## Local usage

Node.js 22.6 or newer (Node 24 recommended):

```bash
npm test
npm run preview   # writes assets/github-activity-demo*.svg using synthetic data

# real data: keep the token in your environment, never in git
GITHUB_TOKEN="$(gh auth token)" GITHUB_USERNAME=ThiagoAciole npm run generate
```

Production artwork fails on API errors and never substitutes fake statistics. `npm run generate -- --placeholder` writes a "waiting for sync" card instead.

## Files

```text
.github/workflows/aciole-contributions.yml
.github/workflows/update-profile-stats.yml
scripts/generate.ts
src/github.ts
src/metrics.ts
src/render.ts
tests/historical.test.ts
tests/metrics.test.ts
tests/render.test.ts
assets/github-activity.svg
assets/github-activity-mobile.svg
README.md
```
