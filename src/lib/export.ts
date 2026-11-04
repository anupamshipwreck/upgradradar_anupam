import { dimensions, fields, fieldNames, fieldStatus, comparisonRecords, type Brief } from "./contracts";

const plain = (s: string) => s.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&").replace(/\r?\n/g, " ");
export function toMarkdown(brief: Brief): string {
  const lines = ["# upGrad Radar — Competitor research brief", "", `Category: ${brief.category}`, `Research started: ${brief.started_at}`, `Completed: ${brief.completed_at}`, `Extraction: Gemini / ${brief.model}`, "", "## Executive factual summary", ""];
  for (const provider of brief.providers) {
    const fact = (field: keyof typeof fields) => {
      const records = comparisonRecords(provider, field);
      return records.length ? records.map((record) => `${plain(record.value)} [${record.status}; ${record.id}]`).join(" / ") : fieldStatus(provider, field);
    };
    lines.push(`- **${provider.company}:** ${fact("title")}`, `  - Pricing: ${fact("advertised_fee")}. Duration: ${fact("duration")}.`, `  - Positioning: ${fact("promise")}.`, `  - On-page marketing: ${fact("headline")}.`, `  - Access: ${provider.retrieval_status}; extraction ${provider.extraction_status}; ${provider.issues.filter((issue) => issue.kind !== "Missing").length} review issues. Evidence extracts and source links appear below.`);
  }
  for (const dimension of dimensions) {
    lines.push("", `## ${dimension}`, "");
    if (dimension === "Marketing") lines.push("Channel: official program landing page. Ad activity, spend and performance are not publicly verified by this research.", "");
    lines.push(`| Field | ${brief.providers.map((p) => p.company).join(" | ")} |`, `| --- | ${brief.providers.map(() => "---").join(" | ")} |`);
    for (const field of fieldNames.filter((f) => fields[f].dimension === dimension)) {
      lines.push(`| ${fields[field].label} | ${brief.providers.map((p) => { const records = comparisonRecords(p, field); return records.length ? records.map((r) => `${r.interpretation ? "Interpretation: " : ""}${plain(r.value)} [${r.status}] (${r.id})`).join("; ") : fieldStatus(p, field); }).join(" | ")} |`);
    }
  }
  lines.push("", "## Evidence & source access", "");
  for (const provider of brief.providers) {
    lines.push(`### ${provider.company}`, "");
    if (provider.source_assessment) lines.push(`Market: India intended; observed ${provider.source_assessment.market}. Program match: ${provider.source_assessment.program}. Expected: ${plain(provider.source_assessment.expected_program)}.`, ...(provider.source_assessment.reasons.map((reason) => `Source review: ${plain(reason)}`)), `Redirect chain: ${(provider.page_metadata?.redirect_chain || []).map((url) => `<${url}>`).join(" -> ")}`, "");
    lines.push(`Requested URL: <${provider.requested_url}>`, `Fetched source: <${provider.source_url}>`, `Fetched at: ${provider.fetched_at || "Not retrieved"}`, `Retrieval: ${provider.retrieval_status} via ${provider.retrieval_method}; extraction: ${provider.extraction_status}; attempts: ${provider.attempts}.`, `Text: ${provider.characters} characters. Context truncated: ${provider.truncated ? "yes" : "no"}.`, ...provider.errors.map((e) => `Error: ${plain(e)}`), "");
    for (const record of provider.records) {

      lines.push(`- **${record.id} — ${fields[record.field].label}**: ${plain(record.value)} [${record.status}]${record.interpretation ? " — Interpretation" : ""}`, `  - Program: ${plain(record.program)}`, ...(record.comparison_eligible === false ? [`  - **EXCLUDED FROM INDIA COMPARISON:** ${plain(record.exclusion_reason || "Source/program applicability needs review")}`] : []), `  - Qualifier: ${record.qualifier ? plain(record.qualifier) : "None extracted"}`, `  - Offer scope: ${plain(record.offer_scope)}`, `  - Evidence: “${plain(record.evidence_quote)}”`, `  - Source: <${record.source_url}>; fetched ${record.fetched_at}`);
    }
    lines.push("");
  }
  lines.push("## Missing / Conflicting / Outdated", "");
  for (const provider of brief.providers) for (const issue of provider.issues) lines.push(`- **${provider.company} — ${issue.kind}:** ${plain(issue.message)}${issue.record_ids.length ? ` (${issue.record_ids.join(", ")})` : ""}`);
  lines.push("", "## Method & limitations", "", "The listed official program pages were requested at run time using direct HTML retrieval or optional Firecrawl. Discovered programs were selected by the user; adjacent programs may not be directly comparable. Source-backed means a claim appears in fetched official text; it is not independent verification. Quotes and literal factual values are mechanically matched after whitespace normalization. Positioning interpretations are labeled. Missing information is not guessed. Historical cohort dates do not establish current admissions. No strategic recommendations or comprehensive marketing audit are generated.", "");
  return lines.join("\n");
}
