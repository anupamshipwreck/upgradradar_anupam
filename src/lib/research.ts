import { type Brief, type Category, type Field, type ProviderResult, type ResearchEvent } from "./contracts";
import { registry, programExpectations } from "./registry";
import { extractPage, ProviderError, scrapePage, type ResearchConfig } from "./providers";
import { validateRecords } from "./verify";
import { assessSource } from "./source-assessment";
import { coreFallbacks } from "./core-fallbacks";
import { groundedNumeric } from "./grounded-numeric";

export async function runResearch(category: Category, config: ResearchConfig, signal: AbortSignal, emit: (event: ResearchEvent) => void, fetchImpl: typeof fetch = fetch, selectedSources: { company: string; url: string; comparison_note?: string }[] = registry[category]): Promise<Brief> {
  const started_at = new Date().toISOString();
  // Cohort comparisons use the same India calendar date displayed by the UI.
  const runDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(started_at));
  const providers = new Array<ProviderResult>(selectedSources.length);
  let next = 0;
  async function worker() {
    while (next < selectedSources.length) {
      if (signal.aborted) throw new Error("Research cancelled or time limit reached.");
      const index = next++;
      const { company, url, comparison_note } = selectedSources[index];
      const result: ProviderResult = { company, requested_url: url, source_url: url, fetched_at: "", retrieval_status: "Source unavailable", extraction_status: "Skipped", attempts: 0, characters: 0, truncated: false, retrieval_method: config.firecrawlKey ? "Firecrawl" : "Direct HTML", errors: [], records: [], issues: [] };
      try {
        emit({ type: "progress", company, phase: "Retrieving" });
        const page = await scrapePage(url, config, signal, fetchImpl);
        Object.assign(result, { source_url: page.source_url, fetched_at: page.fetched_at, attempts: page.attempts, characters: page.text.length, retrieval_status: "Retrieved", retrieval_method: page.method, page_metadata: page.metadata });
        emit({ type: "progress", company, phase: "Extracting" });
        result.extraction_status = "Failed";
        // Explicitly disclose any context cap; never hide that extraction saw only part of a page.
        const text = page.text.slice(0, 160000);
        result.truncated = text.length < page.text.length;
        const options = { intendedProgram: programExpectations[category][company]?.name };
        const extracted = await extractPage(text, config, signal, fetchImpl, options);
        emit({ type: "progress", company, phase: "Validating" });
        let candidates = coreFallbacks([...extracted.records, ...groundedNumeric(text)], text, page.metadata);
        const validate = () => validateRecords({ candidates, text, company, category, source_url: page.source_url, fetched_at: page.fetched_at, runDate });
        let validated = validate();
        result.source_assessment = assessSource({ company, category, requested: url, final: page.source_url, text, metadata: page.metadata, candidates: validated.records });
        const critical: Field[] = ["title", "credential", "positioning_audience", "promise", "differentiators"];
        const missing = critical.filter((field) => !validated.records.some((record) => record.field === field));
        if (missing.length && !result.source_assessment.block_comparison) {
          try {
            const repaired = await extractPage(text, config, signal, fetchImpl, { ...options, fields: missing });
            candidates = coreFallbacks([...candidates, ...repaired.records.filter((record) => missing.includes(record.field))], text, page.metadata);
            extracted.rejections.push(...repaired.rejections);
            validated = validate();
          } catch {
            result.issues.push({ company, field: null, kind: "Needs review", message: "The targeted completeness check could not finish. Other validated records were retained; unsupported fields remain missing.", record_ids: [] });
          }
        }
        const additionalIssues = result.issues;
        Object.assign(result, validated, { extraction_status: "Validated" });
        result.issues.push(...additionalIssues);
        if (result.source_assessment.block_comparison) {
          result.records.forEach((record) => { record.comparison_eligible = false; record.exclusion_reason = result.source_assessment!.reasons.join(" "); if (record.status !== "Historical") record.status = "Needs review"; });
        } else if (result.source_assessment.program === "Needs review") {
          result.records.forEach((record) => { if (record.status === "Source-backed") record.status = "Needs review"; });
        }
        for (const reason of result.source_assessment.reasons) result.issues.push({ company, field: null, kind: "Needs review", message: reason, record_ids: [] });
        const batch = text.match(/\bBatch\s+\d+\b/i)?.[0];
        if (batch && /Announcing Soon|admissions? closed|applications? closed/i.test(text)) {
          const affected = result.records.filter((record) => ["advertised_fee", "discounts", "additional_charges"].includes(record.field));
          for (const record of affected) if (record.status === "Source-backed") record.status = "Needs review";
          result.issues.push({ company, field: "advertised_fee", kind: "Needs review", message: `The page advertises ${batch} with an unconfirmed or closed admission date. Published fees are not verified for a new/current cohort; historical reference fees have not been imported.`, record_ids: affected.map((record) => record.id) });
        }
        result.issues.push(...extracted.rejections.map((rejection) => ({ company, field: rejection.field, kind: "Unverified extraction" as const, message: rejection.message, record_ids: [] })));
        if (comparison_note) result.issues.push({ company, field: null, kind: "Needs review", message: comparison_note, record_ids: [] });
        if (new URL(page.source_url).pathname.replace(/\/$/, "") !== new URL(url).pathname.replace(/\/$/, "") || new URL(page.source_url).hostname !== new URL(url).hostname) {
          result.issues.push({ company, field: null, kind: "Needs review", message: "The configured page redirected to a different official URL. Check the disclosed returned source and program identity before comparing it.", record_ids: [] });
        }
        if (result.truncated) result.issues.push({ company, field: null, kind: "Needs review", message: "The page exceeded the extraction context limit. Only the first 160,000 characters were analyzed.", record_ids: [] });
        emit({ type: "progress", company, phase: "Complete" });
      } catch (error) {
        if (!result.attempts) result.attempts = typeof (error as { attempts?: number })?.attempts === "number" ? (error as { attempts: number }).attempts : 1;
        const message = error instanceof ProviderError ? error.message : signal.aborted ? "Research time limit reached or request cancelled." : result.retrieval_status === "Retrieved" ? "Gemini extraction failed validation or timed out. No unvalidated claims were included." : "Source retrieval failed.";
        result.errors.push(message);
        result.issues.push({ company, field: null, kind: "Source unavailable", message, record_ids: [] });
        emit({ type: "progress", company, phase: "Failed" });
      }
      providers[index] = result;
      emit({ type: "provider", provider: result });
    }
  }
  await Promise.all([worker(), worker()]);
  const brief: Brief = { category, started_at, completed_at: new Date().toISOString(), model: config.model, providers };
  emit({ type: "complete", brief });
  return brief;
}
