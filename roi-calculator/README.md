# LP Frontline — ROI Calculator & Business Case Generator

A standalone sales tool for the LP Frontline workforce-onboarding / allergen-compliance product.

- **Live ROI calculator** — workforce, turnover, onboarding hours and rates → annual savings, FTE equivalents.
- **Prospect deep-research** — enter a company name, Gemini hits Google Search, returns workforce facts, the relevant compliance regulation, recent news and sources.
- **Magazine-style business case** — the research auto-fills the calculator and renders a 2–3 page pitch deck (headline, hidden time cost, manager burden, impact table, compliance kicker, strategic outcomes, sources). Print → PDF in one click.
- **Play Makers (meeting prep)** — enter the names of the people the sales stakeholder will be meeting (one or many). Gemini + Exa.ai pull background, public quotes, priorities, talking points, conversation starters, likely objections and common ground. Wrong person matched? One click removes the card.

This app is intentionally **separate from the Medical CRM** in the parent repo's `src/` directory: it has its own `package.json`, its own server, its own deploy. Move it into a brand-new repo whenever you create one.

## Quick start

```bash
cd roi-calculator
npm install
cp .env.example .env
# paste your Gemini key from https://aistudio.google.com/apikey
npm run dev
```

- Frontend: http://localhost:5173
- API:      http://localhost:8787  (proxied automatically from the frontend)

## Stack

- **Vite + React 18 + TypeScript + Tailwind** — frontend
- **Express** — minimal API server (keeps the Gemini + Exa keys off the browser)
- **`@google/genai`** — Gemini SDK with the `googleSearch` grounding tool
- **`exa-js`** — Exa.ai semantic-search SDK for play-maker evidence
- **Node 20+** (uses `--env-file=.env`)

## How prospect research works

A two-pass Gemini pipeline:

1. **Open-ended grounded research** — `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]` produces a markdown brief about the company (workforce, sites, turnover, applicable allergen/food-safety regulation, recent news) plus grounded source URLs.
2. **Structured extraction** — a second call converts that brief into our typed `ProspectResearch` schema via `responseSchema` / `responseMimeType: "application/json"`. The schema includes `suggestedInputs` for the calculator, so the result auto-fills the form.

Why two passes? Gemini doesn't reliably combine `googleSearch` grounding with strict `responseSchema` in a single call, so we separate the steps.

## How play-maker research works

For each name (in parallel, up to 10 per batch):

1. **Exa.ai semantic search** — `searchAndContents` runs 2 queries per person (`<name> <company> executive profile interview` and `<name> LinkedIn`) and pulls article summaries + text snippets.
2. **Gemini grounded research** — `gemini-2.5-flash` with `googleSearch`, given the Exa evidence as a "use this too" block, produces a markdown briefing covering identity, background, priorities, public quotes, recent activity, plus sales-specific blocks (talking points tied to LP Frontline, conversation starters, likely objections, common ground).
3. **Structured extraction** — second Gemini call converts the briefing into the typed `PlayMaker` schema with a `confidence` rating (`high` / `medium` / `low`) and `identityNotes` explaining the disambiguation.

If `EXA_API_KEY` isn't set, step 1 is skipped and Gemini works from Google Search alone — still useful, just less deep.

If the tool matches the wrong person, each card has an **× remove** button. The card disappears immediately; re-add the name with extra context (middle initial, full title) and rerun.

## Project layout

```
roi-calculator/
├── server/
│   ├── index.ts          # Express: /api/research, /api/playmakers, /api/health
│   ├── research.ts       # Two-pass Gemini pipeline (prospect company)
│   └── playmakers.ts     # Exa + Gemini pipeline (per-person dossiers)
├── src/
│   ├── App.tsx           # Tabs: Calculator | Business Case | Play Makers
│   ├── components/
│   │   ├── CalculatorForm.tsx
│   │   ├── ResultsPanel.tsx
│   │   ├── ProspectSearch.tsx
│   │   ├── BusinessCase.tsx
│   │   ├── PlayMakers.tsx
│   │   └── PlayMakerCard.tsx
│   ├── lib/
│   │   ├── roi.ts        # The ROI math (parameterised version of the deck)
│   │   ├── types.ts      # ProspectResearch shape shared client/server
│   │   └── utils.ts
│   ├── main.tsx
│   └── styles.css
├── index.html
├── tailwind.config.js
├── vite.config.ts        # /api proxy → :8787 in dev
└── package.json
```

## The ROI model

Defaults reproduce the Greggs benchmark from the original pitch deck. All inputs are editable:

| Input | Default | Notes |
|---|---|---|
| Frontline workers | 24,000 | total UK headcount |
| Stores | 2,200 | |
| Annual turnover | 75% | UK food-retail benchmark |
| Onboarding (without) | 6 hrs | |
| Onboarding (with LP) | 3 hrs | 50% reduction |
| Manager oversight (without) | 2 hrs | |
| Manager oversight (with LP) | 0.5 hrs | 75% reduction |
| Frontline £/hr | £11.44 | UK NLW 2024 |
| Manager £/hr | £14.00 | |

Outputs: new-hire cost ↓, manager cost ↓, total saving, FTE-equivalent headcount redirected, hours saved expressed in years of working time.

## Production

```bash
npm run build   # builds the Vite client into dist/
npm start       # serves dist/ + /api on PORT (default 8787)
```

Set `GEMINI_API_KEY` in the environment (or `.env`). For Vercel/Render, run the Node start command and set `NODE_ENV=production`.

## Env vars

| Var | Required | Default |
|---|---|---|
| `GEMINI_API_KEY` | yes | — |
| `EXA_API_KEY` | recommended | — (play-maker research degrades to Gemini-only without it) |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` |
| `GEMINI_STRUCTURE_MODEL` | no | `gemini-2.5-flash` |
| `PORT` | no | `8787` |
