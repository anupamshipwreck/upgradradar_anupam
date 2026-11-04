# Part 3 — Prototype evaluation: upGrad Radar

Date: 4 November 2026. Scope: the existing eight programs in Data Science & Analytics and Executive / General Management. No new features or UI redesign.

## Reference and method

Compared the two user-exported `competitor-brief-*-2026-11-04.md` files with the local Part 2 research: **Competitive Research Pricing**, **Competitive Research Positioning**, **Critical Evidence Audit**, **Source Traceability Audit**, and **Finalizing the Eight Programs**. These reference documents and their fee values are acceptance inputs only; production never imports them.

Fresh runs fetch the configured official pages and use the existing Gemini service. Both categories were rerun locally and on the production Vercel application. Raw development captures, updated Markdown briefs, JSON evidence and machine-readable acceptance results are stored in ignored `artifacts/reliability/`. Fetched quotes still require whitespace-only mechanical matching; rejected model claims remain recorded as unverified extraction issues.

## Results against the known discrepancies

| Case | Expected reliable treatment | Result |
| --- | --- | --- |
| US upGrad redirects and USD-only Great Learning offers in the old exports | Do not compare international offers as Indian prices | International responses are quarantined with citations; production Mumbai retrieval returns the intended India pages and INR fees. No currency conversion. |
| upGrad Data Science | ₹1,80,000; six months versus six–nine months unresolved | Both durations retained and marked Conflicting. Fee retained from the actual fee section. |
| Great Learning Data Science | ₹2,10,000 + GST versus ₹1.95 lakhs + GST | Both quotes retained; Conflicting for the same apparent offer. |
| Simplilearn Data Science | ₹1,34,999 including taxes; IIT Kanpur identity checked | Fee and actual credential retained. Canonical metadata unexpectedly points to a different IIT Madras program path: Needs review, without fetching or substituting it. |
| Emeritus Data Science | FAQ fee ₹1,32,000 + GST | FAQ price recovered; supplementary IBM credentials do not create false conflicts. |
| upGrad Management | ₹2,92,640 including taxes; eleven months | Fee and duration retained; certificate and alumni status do not create false conflicts. |
| Great Learning Management fees | ₹2,35,000 headline; ₹2,25,000 single and ₹2,55,000 dual specialization | Variant prices retained separately; headline remains Needs review. Single and dual options are not labeled contradictory prices. |
| Great Learning Management credential | Management award versus stray Data Science & Analytics certificate copy | Incorrect-subject wording retained with a credential mismatch review issue. |
| Simplilearn Management | Do not promote historical IIM Indore Batch 8 research to current verified pricing | Current landing page now displays ₹2,62,550, but Batch 8 / Admission Date Announcing Soon remains unresolved. Fee is Needs review. Historical ₹2,22,500 is not imported. |
| Emeritus Management | ₹2,48,500 + GST; AED price/referral excluded; past orientation flagged | INR retained, AED excluded from comparison but cited in evidence, 11 October 2026 orientation Historical. Equivalent ten-month duration wording is not contradictory. |
| Missing core fields and irrelevant content | Recover published titles, credentials and positioning without invented values | Targeted missing-field extraction plus literal source fallbacks. A rejected model candidate cannot suppress a grounded fallback. Four broad curriculum topics maximum; login/OTP, unrelated courses, ratings and testimonial clutter filtered. |

## Validation

- TypeScript checks and optimized Next.js build pass.
- 34 automated tests pass, including foreign redirects, incorrect program/institution/path, canonical discrepancies, fee conflicts, EMI, tax treatment, specialization variants, complementary awards, literal recovery, citation/export retention, retries and partial failures.
- Final production acceptance: **61/61 checks passed**, completed at 2026-11-04 03:06:09 UTC. Both categories completed with all eight providers retrieved and validated, including published title, credential and positioning fields. Checks cover comparable currencies, citation provenance, content limits, ad-count omissions and the Part 2 discrepancies. The earlier production rerun exposed two missing core fields; the literal fallback fix was deployed before this final rerun.
- Public acceptance results: [evaluation JSON](evaluation-results.json). Full generated Markdown briefs and raw captures remain in the ignored local `artifacts/reliability/` directory; rerunning the acceptance command regenerates both briefs.

## Practical limits

Source-backed means published on the fetched page, not independent verification or a confirmed payable quote. Publisher price contradictions, incorrect certificate copy, canonical errors and unconfirmed cohorts remain explicit review items. No historical reference prices are used to fill missing live evidence. The application does not fetch the separate institutional Batch 8 page or verify paid advertising. Optional Firecrawl remains available but was not exercised live because this project has no Firecrawl key.

Repeat the automated suite with `npm test`. Repeat production acceptance with `node --import tsx scripts/evaluate-reliability.ts https://upgrad-radar.vercel.app`; each run incurs the existing Gemini API usage and saves fresh evidence rather than reusing reference data.
