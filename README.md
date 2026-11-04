# upGrad Radar

An AI-assisted competitive intelligence prototype for upGrad's strategy, category and marketing teams. It addresses the slow, fragmented process of comparing competitors' pricing, programs, positioning and marketing across public sources.

**Live prototype:** [upgrad-radar.vercel.app](https://upgrad-radar.vercel.app/)

Select **Data Science & Analytics** or **Executive / General Management** to research upGrad, Great Learning, Simplilearn and Emeritus. Review cited comparisons, source quotations, verification statuses and unresolved discrepancies; export Markdown or JSON. Additional competitor discovery requires the user to confirm an official program page.

## Implementation

**Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Cheerio, Zod, Google Gemini and Vercel.

**Evaluated workflow:** official HTML retrieval → Cheerio text extraction → Gemini structured extraction → Zod and literal quote/value validation → market/program checks and conflict rules → cited comparison and export. Progress streams from server routes. Gemini also supports competitor discovery through Google Search. Firecrawl is optional code only; it was **not used** in the evaluated production runs.

## Run locally and test

Use **Node.js 24** and npm.

```sh
git clone https://github.com/anupamshipwreck/upgradradar_anupam.git
cd upgradradar_anupam
npm ci
```

Copy `.env.example` to `.env.local`. Required server variable: `GEMINI_API_KEY`. Optional: `GEMINI_MODEL`. Leave `FIRECRAWL_API_KEY` unset to reproduce the evaluated retrieval workflow. Keep credentials out of Git and client code.

```sh
npm run dev
```

Open [127.0.0.1:3000](http://127.0.0.1:3000). For verification:

```sh
npm test
npm run typecheck
npm run build
```

Automated tests use controlled responses and need no API key. Live research requires Gemini access and can incur API charges. After building, `npm start` serves the production application locally.

## Assignment deliverables

**Status: Parts 1–4 and the AI process log are included; the recorded demo is pending.** All five supplied PDFs are preserved unchanged.

| Deliverable | Supplied document |
| --- | --- |
| Part 1 — Problem framing | [PDF](docs/part1-problem-framing.pdf) |
| Part 2 — Competitive research | [PDF](docs/part2-research.pdf) |
| Part 3 — Prototype and evaluation | [PDF](docs/part3-prototype-evaluation.pdf) |
| Part 4 — Recommendation | [PDF](docs/part4-recommendation.pdf) |
| AI process log | [PDF with conversation links](docs/ai-process-log.pdf) |
| Recorded walkthrough | Pending: `demo/demo.mp4` or a video link |

Supporting evidence: [technical evaluation](docs/part3-evaluation.md) and [61-check production results](docs/evaluation-results.json). `src/` contains the application, `tests/` automated checks, `scripts/` live diagnostics, `docs/` deliverables and `demo/` the future recording.

## Assumptions and limitations

Comparisons target Indian offers for the selected programs; different credentials, cohorts and tax treatments limit equivalence. “Source-backed” establishes publication, not independent truth or a confirmed payable fee. Regional mismatches, conflicting prices and historical cohorts require human review. Marketing covers landing-page messaging, not verified ad activity or performance. There is no persistent research history or application login. Scripted passes do not establish overall factual accuracy or measured time savings.
