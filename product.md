> Implementation update: the user requested the name **upGrad Radar**, a readable red-and-black theme, and new-competitor discovery (including Apna Advantage). Direct official HTML retrieval is now the default so the app works without a Firecrawl account; Firecrawl remains optional. These requests supersede the original optional-discovery priority and mandatory Firecrawl implementation below.

# Product Specification — AI Competitor Research Brief

**Context:** upGrad AI Program Manager take-home, Problem C — Competitive Intelligence  
**Goal:** A small Vercel-hosted web tool that researches official program pages and generates a traceable competitor brief.  
**Build priority:** Complete Mode 1; Mode 2 is optional and must not delay the working prototype.

## 1. Problem and objective

Manual competitor research across pricing, programs, positioning and marketing is slow and error-prone. Build an **AI-assisted research workflow**, not a dashboard or strategic recommendation engine. The tool must retrieve current public-source text at run time, extract comparable facts, reveal gaps/conflicts and produce a cited brief. The prior Part 2 research is a **test reference only**; never hardcode its findings or fees as generated results.

## 2. Inputs, outputs and user workflow

**Core input:** Choose one category: **Data Science & Analytics** or **Executive / General Management**. No URLs need to be pasted for configured competitors.

**Core workflow:** Select category → click **Research now** → see per-company retrieval/extraction statuses → inspect comparison and flagged issues → **Export Markdown** (optional JSON export).

**Output:** One concise brief covering upGrad, Great Learning, Simplilearn and Emeritus, with four sections: (1) Pricing, (2) Programs, (3) Positioning, (4) Marketing. Include an executive factual summary (no recommendations), side-by-side fields, evidence links, research timestamp, source-access status, and a **Missing / Conflicting / Outdated** section. Each finding must link to the exact source page and show a short supporting extract. Display **Not publicly verified** rather than guessing.

## 3. Core features and research modes

### Mode 1 — Configured research (must work)

A version-controlled registry maps each category to one official program URL per provider:

| Category | Provider | Official URL |
|---|---|---|
| Data Science & Analytics | upGrad | https://www.upgrad.com/data-science-pgc-iiitb/ |
| Data Science & Analytics | Great Learning | https://utaustin.mygreatlearning.com/pg-program-data-science-and-business-analytics-course |
| Data Science & Analytics | Simplilearn | https://www.simplilearn.com/iitk-professional-certificate-course-data-analytics |
| Data Science & Analytics | Emeritus | https://programs.eictiitg.com/iitg-dsba-tech-certificate-programme |
| Executive / General Management | upGrad | https://www.upgrad.com/iim-bangalore-general-management-certificate-for-young-leaders/ |
| Executive / General Management | Great Learning | https://www.mygreatlearning.com/pg-program-management-executive |
| Executive / General Management | Simplilearn | https://iimi.simplilearn.com/executive-general-management-program |
| Executive / General Management | Emeritus | https://iimk.emeritus.org/iimk-general-management-programme-for-business-excellence |

Fetch **only the four configured program pages for the selected category** on each run. Do not assume a live landing page guarantees a currently open cohort. Do not silently replace or discover different programs.

### Mode 2 — New-program discovery (optional, after MVP)

Input competitor name + category → search candidate **official-domain** program pages → show 2–3 candidates with URLs and short match reasons → require user confirmation → research the selected URL with the same workflow. Never auto-select a program or search arbitrary sites without domain validation. If not implemented, omit the feature rather than simulate results.

## 4. AI research and verification workflow

1. **Retrieve:** Server calls Firecrawl Scrape (Markdown) for each configured URL; capture requested URL, returned/final URL, fetch timestamp, text and errors. Retry a transient failure once; otherwise mark **Source unavailable**. Limit concurrency to ~2.
2. **Extract:** Send each page's retrieved text to an LLM separately. Request schema-validated structured JSON, including **candidate values, verbatim short evidence quotes, and context/qualifiers**. The model must rely only on supplied page text, not its general knowledge.
3. **Fields:**
   - **Pricing:** advertised amount and currency, GST included/excluded/unknown, application/seat-block charges, discounts, EMI/financing, restrictions and cohort association.
   - **Programs:** title, duration, eligibility, target audience, key curriculum topics, live/recorded/campus format, credential type, issuing institution, advertised career support.
   - **Positioning:** explicit audience, core promise and stated differentiators; label any synthesized interpretation as **Interpretation**.
   - **Marketing:** **on-page** promotional headlines, calls to action, offers and claims. Label the channel **official program landing page**. Do not infer paid advertising, social-media priority, ad counts, spend or results.
4. **Verify mechanically:** Require each factual value to carry its exact source URL and evidence quote. Verify the quote against fetched text (allow whitespace normalization); discard or mark **Unverified extraction** if it cannot be located. Set URLs in server code from the actual fetched source, **not model-generated URLs**.
5. **Flag issues:** Preserve multiple candidate fees/durations and their qualifiers. Flag **Conflicting** when incompatible values refer to the same apparent offer; flag **Needs review** when different prices may be for different variants. Dates clearly earlier than the run date are **Historical / outdated cohort**, not automatically invalid program information. Never normalize a historical fee to a current one.
6. **Synthesize:** Create comparison text **only from validated extracted records**. Deterministic template rendering is preferred; a secondary LLM summary, if used, may not add new factual claims. Each output field carries status: `Source-backed`, `Conflicting`, `Historical`, `Not publicly verified`, `Source unavailable`, or `Needs review`. `Source-backed` means the claim appears on an official page—not independent truth.

**Minimum evidence record:** `company`, `category`, `program`, `dimension`, `field`, `value`, `qualifier`, `evidence_quote`, `source_url`, `fetched_at`, `status`. Store multiple records per field where necessary. The output should retain an issues list and per-page retrieval errors.

## 5. Recommended stack and architecture

- **UI:** Next.js App Router + TypeScript + Tailwind CSS; one clean page with a category selector, Research button, loading/error statuses, four-provider comparison, evidence drawer/expanders and Markdown export.
- **Backend:** Next.js Node.js route handler (`POST /api/research`), deployed to Vercel. Server-side API keys only. Configure an appropriate function timeout; handle partial results instead of failing the entire run.
- **Retrieval:** Firecrawl Scrape API returning Markdown. **LLM:** Direct Google Gemini Interactions API, reusing the CookMyHook setup, with structured JSON/JSON Schema; configurable model in environment variables. Validate generated data with Zod or equivalent.
- **Environment:** `FIRECRAWL_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`. Include `.env.example`, `README.md` with local/deployment instructions, and clear provider-error messages.
- **Flow:** Browser → `/api/research` → registry → Firecrawl (four pages) → per-page LLM extraction → quote/status checks → comparison JSON → browser renders/export.
- **Storage:** None for MVP. No login, database, background jobs or scheduled scraping. A new run performs a fresh fetch; show timestamps and partial failures. No Part 2 reference data in production response generation.

## 6. Evaluation and demo plan

Use the **previous Part 2 audit as an external manual test oracle**, not seeded output. Test both categories live; review generated values against official pages. Include these specific cases:

| Test | Expected behavior |
|---|---|
| Data Science — upGrad duration | If both `6 months` and `6–9 months` appear in newly retrieved text, show both and flag discrepancy; do not choose one. |
| Data Science — Great Learning price | If both `₹1,95,000 + GST` and `₹2,10,000 + GST` remain on the page, preserve both and mark conflict. |
| Management — Emeritus older cohort | If `11 October 2026` appears as orientation date, label **Historical** relative to November 2026, not current admissions. |
| Management — Great Learning certificate | If management vs data-science credential wording conflicts, show **Needs review** with both quotes. |
| One page unavailable or extraction fails | Display **Source unavailable** for that provider; show the other three; do not insert prior-research values. |
| Model returns a claim without a matching quote | Reject or mark **Unverified extraction**; never present as verified. |
| Marketing page lacks ad data | Show on-page messaging only; active ad count = **Not publicly verified**, never zero. |

**Acceptance criteria:** Both category runs work from configured URLs without pasted input; four providers are shown (including failures); all displayed factual fields have exact page URLs and located evidence quotes; contradictions are preserved; Markdown export contains evidence/statuses; production data is retrieved live, not fabricated from the Part 2 reference.

**Interview demo:** Select Data Science → run → open a conflicting fee/duration with supporting quote and URL → export brief → switch to Management → show an older cohort flag. Explain that extraction is automated but independent verification is limited by public-source quality.

## 7. Scope boundaries and limitations

**In scope:** Two categories, eight configured pages, retrieval, structured extraction, source-linked evidence, issue detection, side-by-side brief, downloadable Markdown, transparent failures.

**Out of scope:** Strategic recommendations or five final insights, ad-library scraping, verified ad counts/spend/performance, authenticated/private content, broad internet crawling, source-independent claims, real-time admission verification, accuracy guarantees, accounts/database, history, scheduled monitoring, analytics dashboard. Mode 2 is optional.

**Known limitations:** Some websites block scrapers or render incomplete text; page content can be stale or self-contradictory; quote matching proves provenance in fetched text, not real-world truth; dates/fees may apply to older cohorts; competitors' on-page messaging is not a comprehensive audit of their marketing. Do not fabricate missing data or conceal these limitations.

**Implementation priority:** (1) live fetch of one configured page → (2) grounded structured extraction → (3) validate quotes and statuses → (4) four-page category comparison → (5) export and deployment → (6) optional Mode 2 only if all previous items work.
