# Turnover Map: Devpost description

**Live demo:** https://turnover-map.pages.dev
**Code:** https://github.com/sja-thedude/Turnover-Map
**Demo video:** https://youtu.be/8P1POpOLhLE

## Tagline

Where does your team win the ball back, and which of those regains actually lead to a shot?

## Inspiration

Every club says it presses. Very few can show which parts of the press pay off. Most recovery maps count volume, so a regain in your own box that gets cleared looks the same as one on the edge of the opposition area that becomes a shot. Coaching staff need the value of each regain, not the count.

## What it does

Turnover Map takes every open-play turnover in the 2015/16 Premier League (26,715 across all 380 matches, from StatsBomb Open Data). For any team, it shows:

- **Where they win the ball and what it's worth.** A pitch heatmap of 24 zones, coloured by xG created within ten seconds per regain, or by comparison with the league average from the same zone.
- **Where they lose it and what it costs.** The mirrored map for turnovers conceded, in the team's own attacking direction.
- **Coach's notes in plain English.** The most and least productive regain zones, the biggest defensive vulnerability, and whether the score explains the pattern.
- **A clip list for video staff.** Every regain that became a shot, with match, minute, ball-winner and shooter, exportable to CSV.
- **Context.** A game-state split (leading, level, trailing), the team's top ball-winners, and a league-wide scatter of pressing style against reward.
- **The full table** with sample sizes, so anyone can check the work.

## Actionable impact

- **Pressing triggers:** commit runners where regains pay off, not where they merely happen.
- **Post-regain coaching:** zones where the team wins the ball often but gets less than the league from it point to the next action, not the press.
- **Rest-defence planning:** the vulnerability note names the zone where losing the ball cost the most xG across the season.
- **Faster video prep:** the clip list turns a season of footage into a ranked list of timestamps.

## How we built it

- **Python and pandas, offline.** For each new possession that starts in open play after the opponent had the ball, the pipeline finds the tackle, interception or recovery that won it (often logged a moment earlier in the opponent's possession), follows the possession for ten seconds, and combines the xG of any shots as the chance at least one scored. Results are aggregated per team and zone with standard errors and league baselines, then written to a single JSON file.
- **React, TypeScript and plain SVG.** The site only reads that file. There is no runtime analysis and no database, so it loads instantly. Pitch markings, heatmaps, chains and the scatter are hand-built SVG, with no charting library.
- **Cloudflare Pages** for hosting.

## Statistical honesty

- Zones with fewer than 30 turnovers are hatched on the map, flagged in the table and never used in the notes.
- A gap to the league is called "clear" only when it exceeds about two standard errors. Otherwise the notes say it's within normal variation.
- The page states that these are associations, not causes, and the game-state split shows how much the score shapes the numbers.

## Accomplishments

- The output matches what football people already know, which is what makes the unfamiliar findings credible. Leicester (the 2015/16 champions) lead the league in xG from regains, N'Golo Kanté is their top ball-winner, and the top regain-to-goal chains include Vardy's real counter-attacking goals at Sunderland, against Crystal Palace and at Southampton.
- It works on a phone, in light and dark mode, and is keyboard navigable.

## What's next

- 360 freeze-frame data to measure how many players were committed to the press at each regain.
- Multi-season views to separate stable pressing identity from one-season noise.
- A shrinkage (empirical Bayes) estimate per zone, so small samples borrow strength from the league.

## Built with

python, pandas, react, typescript, vite, svg, cloudflare-pages, statsbomb-open-data
