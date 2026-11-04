import { applyRecordRules, classifyCandidate, irrelevantCandidate } from "./verification-rules";
import { fields, fieldNames, type Candidate, type Company, type Category, type EvidenceRecord, type Issue } from "./contracts";

// Deliberately normalize whitespace only: punctuation and numbers must survive verbatim.
export const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();

export function parsedCohortDate(value: string): string | null {
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  let year: number, month: number, day: number;
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const long = value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/i);
  const reversed = value.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})\b/i);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (long) { year = +long[3]; month = months.indexOf(long[2].toLowerCase()) + 1; day = +long[1]; }
  else if (reversed) { year = +reversed[3]; month = months.indexOf(reversed[1].toLowerCase()) + 1; day = +reversed[2]; }
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}

export function validateRecords(input: {
  candidates: Candidate[]; text: string; company: Company; category: Category; source_url: string; fetched_at: string; runDate: string;
}): { records: EvidenceRecord[]; issues: Issue[] } {
  const records: EvidenceRecord[] = [];
  const issues: Issue[] = [];
  const text = normalize(input.text);
  for (const rawCandidate of input.candidates) {
    const candidate = classifyCandidate(rawCandidate);
    if (irrelevantCandidate(candidate)) continue;
    const quote = normalize(candidate.evidence_quote);
    // Factual values must also be verbatim within their quote. Synthesized positioning is separately labeled.
    const supported = text.includes(quote) && (candidate.interpretation || quote.includes(normalize(candidate.value)));
    const allowedInterpretation = !candidate.interpretation || fields[candidate.field].dimension === "Positioning";
    // Qualifiers are quoted text too, so an invented qualifier cannot resolve a conflict.
    const qualifierSupported = !candidate.qualifier || text.includes(normalize(candidate.qualifier));
    const contextSupported = [candidate.context?.variant, candidate.context?.cohort].filter(Boolean).every((value) => text.includes(normalize(value!)));
    if (!supported || !allowedInterpretation || !qualifierSupported || !contextSupported) {
      issues.push({ company: input.company, field: candidate.field, kind: "Unverified extraction", message: `${fields[candidate.field].label}: extraction rejected because its value, quote or qualifier could not be grounded in the fetched text.`, record_ids: [] });
      continue;
    }
    const duplicate = records.find((r) => r.field === candidate.field && normalize(r.value) === normalize(candidate.value) && r.qualifier === candidate.qualifier);
    if (duplicate && (!duplicate.context?.variant || !candidate.context?.variant || duplicate.context.variant === candidate.context.variant)) {
      if (candidate.context?.variant && !duplicate.context?.variant) duplicate.context = candidate.context;
      continue;
    }
    const cohortDate = candidate.field === "cohort_date" ? parsedCohortDate(candidate.value) : parsedCohortDate(candidate.context?.cohort || "") || (/cohort|batch|orientation|intake|start|admission/i.test(candidate.qualifier) ? parsedCohortDate(candidate.qualifier) : null);
    records.push({ ...candidate, id: `${input.company}-${records.length + 1}`, company: input.company, category: input.category,
      program: "Not publicly verified", dimension: fields[candidate.field].dimension, source_url: input.source_url,
      fetched_at: input.fetched_at, status: cohortDate && cohortDate < input.runDate ? "Historical" : "Source-backed" });
  }
  const title = records.find((r) => r.field === "title")?.value ?? "Not publicly verified";
  records.forEach((record) => { record.program = title; });
  applyRecordRules(records, issues, input.company, input.category);
  for (const record of records.filter((r) => r.status === "Historical")) {
    issues.push({ company: input.company, field: record.field, kind: "Historical", message: `Historical / outdated cohort: ${record.value}. This date precedes the research date and does not establish current admissions.`, record_ids: [record.id] });
  }
  for (const field of fieldNames) {
    if (!records.some((r) => r.field === field)) issues.push({ company: input.company, field, kind: "Missing", message: `${fields[field].label}: Not publicly verified${field === "ad_count" ? " — landing pages do not establish ad activity" : " from this page"}.`, record_ids: [] });
  }
  return { records, issues };
}
