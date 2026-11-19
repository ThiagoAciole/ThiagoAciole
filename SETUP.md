# Aciole Contributions — Compact Purple

Compact, self-hosted GitHub profile graphic rendered as SVG using TypeScript and GitHub GraphQL. No npm dependencies or third-party image services.

## Variants

- `assets/contributions.svg` — main **compact** desktop card (785 × 226), based on the second visual reference.
- `assets/contributions-detailed.svg` — compact desktop card with the optional footer (785 × 307), based on the first visual reference.
- `assets/contributions-mobile.svg` — stacked mobile layout (420 × 342).

The README uses `<picture>` to display the compact desktop graphic or mobile version according to viewport width. To show the optional footer instead, change the `<img>` source to `./assets/contributions-detailed.svg`.

The SVG artwork has a transparent canvas with a rounded, translucent surface. The purple palette, texts, icons, and heatmap are native SVG. Light theme adaptation uses `prefers-color-scheme`.

## Data and definitions

All numbers and fields are fetched from the GitHub GraphQL API at generation time. `src/github.ts` retrieves `user.createdAt`, `user.location`, public owner repository `totalCount` and contribution calendar in one request. `src/metrics.ts` computes aggregations.

- **Contributions**: contributions counted over the previous 365 UTC days (including today).
- **Public Repos**: publicly visible repositories owned by the user, excluding collaborator-only repositories.
- **Joined GitHub**: complete elapsed years or months since account creation, calculated from the profile timestamp.
- **Location**: the public GitHub profile `location` field, or `Location not specified` when empty.
- **Heatmap**: last **16 calendar weeks** (up to 112 cells), with future days dimmed. It is intentionally a compact preview, not the complete 365-day calendar.
- **Detailed footer**: busiest month and weekday by contribution count within the 365-day window, plus active days divided by 365.

GitHub visibility rules apply: the Action token can generally count public contributions; private contribution visibility may differ from the signed-in GitHub profile.

## Installation

Copy the files into your **profile repository** `ThiagoAciole/ThiagoAciole` or merge the prepared PR.

1. Open **Actions → Update contribution heatmap → Run workflow** on the default branch.
2. Confirm that the workflow updates `assets/contributions.svg`, `assets/contributions-mobile.svg`, and `assets/contributions-detailed.svg`.
3. Leave the default `README.md` `<picture>` block in place, or switch to the detailed SVG if preferred.

The scheduled workflow runs each day at **08:13 UTC**. It requires repository Actions write permission for commits (`contents: write`), and branch protection must permit updating the generated assets. Do not commit personal access tokens.

## Local usage

Node.js 24 recommended (minimum 22.6 for type stripping):

```bash
npm test
npm run preview
# opens assets/contributions-demo.svg, -mobile.svg and -detailed.svg

# real data (keep the token in your environment, never in git)
GITHUB_TOKEN=... GITHUB_USERNAME=ThiagoAciole npm run generate
```

`npm run preview` uses deterministic **synthetic demo data** and labels its artwork DEMO. Production artwork fails explicitly on API errors, never substituting fake statistics. Original committed `contributions*.svg` are intentionally placeholders until the Action first succeeds.

## Files

```text
.github/workflows/aciole-contributions.yml
src/github.ts
src/metrics.ts
src/render.ts
scripts/generate.ts
tests/metrics.test.ts
tests/render.test.ts
assets/contributions.svg
assets/contributions-mobile.svg
assets/contributions-detailed.svg
README.md
```
