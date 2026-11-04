# upGrad Radar — AI competitor research brief

A Next.js application that researches four configured official program pages and creates a cited comparison of upGrad, Great Learning, Simplilearn and Emeritus. Supports Data Science & Analytics and Executive / General Management.

**Live demo:** [upgrad-radar.vercel.app](https://upgrad-radar.vercel.app)

## Submission files

The existing prototype evaluation is in [docs/part3-evaluation.md](docs/part3-evaluation.md), with [machine-readable acceptance results](docs/evaluation-results.json). The original application requirements are in [product.md](product.md). [Demo information](demo/README.md) includes the live application link.

```text
upgradradar_anupam/
├── README.md
├── docs/
│   ├── part3-evaluation.md
│   └── evaluation-results.json
├── demo/
│   └── README.md
├── src/
├── scripts/
├── tests/
├── .env.example
└── project configuration files
```

The remaining submission documents and recorded demo will be added by the author. See [docs/README.md](docs/README.md) for the planned filenames. Credentials, local environment files, build output and development research captures are excluded from Git. `.env.example` contains empty API-key placeholders.

## Run locally

Requires Node.js 22.9+ (Node 24 recommended).

```powershell
npm install
Copy-Item .env.example .env.local
# Edit .env.local with your own keys.
npm run dev
```

Open http://127.0.0.1:3000. If `.env.local` already exists, edit it rather than overwriting it. Restart the dev server after changing environment values.

| Server environment | Purpose |
| --- | --- |
| `FIRECRAWL_API_KEY` | Optional: use Firecrawl instead of direct HTML retrieval; leave blank for normal use |
| `GEMINI_API_KEY` | Direct Google Gemini API key, never sent to the browser |
| `GEMINI_MODEL` | Defaults to `gemini-3.5-flash-lite`, matching the earlier CookMyHook setup |

This app uses the same direct Gemini Interactions API pattern as CookMyHook, with structured JSON output and Zod validation. OpenRouter is not required. Use a model supporting Interactions, structured outputs and minimal thinking; incompatible models return a visible extraction error.

No sample or reference findings are used by production code. Only the Gemini key is required. Missing Gemini credentials produce a setup banner and HTTP 503. With no Firecrawl key, official HTML is fetched directly and converted to readable text; no account or additional scraper key is needed. API use can incur charges in the configured provider accounts.

## Workflow

First-time users can select the **i** beside a control or section for a short guide. The **i** beside the page title gives a quick walkthrough; contextual guides cover categories, research progress, new competitors, comparison tabs, evidence, warnings, sources and exports. Guides support click, touch and keyboard, with Escape or **Got it** to close.

1. Select a category and click **Research now**.
2. Watch retrieval, extraction and validation status for each provider.
3. Compare Pricing, Programs, Positioning and Marketing.
4. Click a finding to see its exact quote, source URL, qualifiers, status and retrieval timestamp.
5. Inspect **Gaps & things to check**; switch between review issues and missing fields.
6. Export Markdown or JSON once the run completes, including partial provider failures.

The version-controlled registry is `src/lib/registry.ts`. The standard run fetches its four configured URLs. An explicitly confirmed new competitor can be added as a fifth provider. Direct retrieval disables caching; optional Firecrawl uses `maxAge: 0`. Redirects remain on the official host, except the specifically approved legacy Great Learning subdomain redirect to `www.mygreatlearning.com`. Returned URLs are disclosed. No program is silently substituted.

## Architecture and evidence rules

Browser → `POST /api/research` → registry → direct official HTML (or optional Firecrawl) → Gemini extraction → mechanical evidence and source checks → deterministic comparison and export. A targeted second extraction checks missing core identity and positioning fields. Progress uses newline-delimited JSON. Two provider workers run concurrently. Transient retrieval and extraction failures retry once. Provider failures do not erase successful providers. A run has a 260-second budget inside a 300-second Vercel function timeout.

Each accepted factual value must occur inside its evidence quote, and that quote must occur in the fetched text after whitespace normalization. Unsupported or malformed records are rejected individually and logged as **Unverified extraction** issues; they do not erase other valid findings from that provider. Short literal CTA quotes, such as Apply, are accepted when located verbatim. URLs are assigned by server code. Positioning interpretations can be synthesized from a matching quote and are explicitly labeled; quote matching cannot prove their semantic accuracy.

Fetched titles, headings, institutions, program paths, canonical metadata and redirect chains are checked against the intended program and India market. Explicit foreign regional responses and incorrect programs are excluded from comparison but retained with citations in the evidence and exports. USD/AED and currency-unknown monetary amounts cannot appear as comparable INR fees; no conversion is performed. Direct retrieval requests Indian English; optional Firecrawl requests India. Vercel research functions run in Mumbai (`bom1`) to reduce geo-redirects; source checks still apply to every response.

Conflicts compare tuition with the same currency, tax basis, variant and cohort. Monthly installments, deposits, discounts, specialization options and supplementary/alumni credentials are distinguished. Unreconciled headline/variant prices and incorrect certificate subjects require review. Literal fee sections and FAQs can recover omitted numeric evidence, without importing reference prices. Curriculum is capped at four broad topics; irrelevant controls, unrelated programs and testimonial/ratings content are filtered. These are conservative heuristics, not semantic truth verification. Past recognizable cohort dates are **Historical** relative to the run date in Asia/Kolkata. Historical dates do not establish current admission status. Tax is extracted only when stated; absent tax details remain **Not publicly verified**.

Marketing covers official program landing page messaging only. Active ad count remains **Not publicly verified**, never zero. No paid-ad, spend or performance inference is made.

The extraction context is capped at 160,000 characters per page. Any truncation is disclosed as a review issue. Fetched text is kept in request memory for validation, not persisted or exported. No login, database, history, scheduled crawling or strategy recommendations are included.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

To verify the configured Gemini key and model with a small isolated test fixture (uses the live API):

```powershell
node --env-file=.env.local --import tsx scripts/check-gemini.ts
```

Tests inject controlled provider responses to check both category registries, concurrency, live-fetch options, streaming events, conflicts, variants, historical dates, quote rejection, invalid JSON, retrieval retries, partial failures and export provenance. Test fixtures are isolated from production output. Live acceptance uses the configured Gemini key; Firecrawl is optional: inspect values and quotes against the official pages, including contradictory values or old cohorts **if present in newly fetched content**.

## Deploy to Vercel

Import this folder into a Vercel project with the **Next.js** framework preset. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` (and optionally `FIRECRAWL_API_KEY`) as server settings; do not prefix keys with `NEXT_PUBLIC_`. Deploy with the standard `npm run build` command. The research route exports `maxDuration = 300` and discovery uses `maxDuration = 120`; choose a plan/runtime supporting that duration. If the host terminates a stream early, completed provider results remain visible and export is withheld until a complete run.

Production deployment: https://upgrad-radar.vercel.app (Vercel project `upgrad-radar`, scope `anupamship`). Live research requires `GEMINI_API_KEY` to be configured in the Vercel production environment. Keep a shared demo private or add hosting-level access protection before distributing a URL: there is no application login, and research consumes the server's API credits. The in-memory concurrent-run guard is per instance, not a distributed rate limiter.

## API references

- [Firecrawl Scrape API](https://docs.firecrawl.dev/api-reference/endpoint/scrape)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions)
- [Next.js App Router](https://nextjs.org/docs/app)

`product.md` is the original assignment specification. The user's requested provider change replaces its OpenRouter recommendation with the existing CookMyHook Gemini setup.

## New competitor discovery

Click **New competitor**, enter a name (for example Apna Advantage), and click **Find programs**. Search uses Gemini?s live Google Search tool. Candidate URLs are checked on the official host, including page content checks for soft 404s. When search links are stale, discovery can inspect the official homepage and at most two linked catalogs, then validate a bounded list of candidate program pages. It does not crawl broadly.

Confirm the displayed official domain, inspect the program links and match labels, then click **Add & research**. The selected page is researched alongside the four configured providers, using the same quote checks and exports. Adjacent matches, such as online MBA degrees versus executive certificates, are explicitly labeled. No arbitrary pasted URL can be submitted to research: selections are signed server-side, expire after 30 minutes, and are bound to their category. New domains are checked for public HTTPS and public DNS addresses. A failed search returns an honest empty state.

## Live acceptance artifacts

The ignored `artifacts/` directory contains real development-time briefs and JSON from live acceptance runs; these files are never imported by production code. To repeat both categories:

```powershell
node --env-file=.env.local --import tsx scripts/check-live-research.ts
node --env-file=.env.local --import tsx scripts/check-discovery.ts
```

Reliability acceptance against the eight-program Part 2 audit (reference values are test-only):

```powershell
node --import tsx scripts/evaluate-reliability.ts
# Or rerun both categories on the deployed application:
node --import tsx scripts/evaluate-reliability.ts https://upgrad-radar.vercel.app
```

See [docs/part3-evaluation.md](docs/part3-evaluation.md) for the latest results and unresolved publisher-source issues. Generated briefs and raw captures stay in ignored `artifacts/reliability/`.
