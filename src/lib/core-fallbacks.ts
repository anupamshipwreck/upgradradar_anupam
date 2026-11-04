import { type Candidate, type PageMetadata } from "./contracts";

export function coreFallbacks(candidates: Candidate[], text: string, metadata: PageMetadata): Candidate[] {
  const records = [...candidates];
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const source = normalize(text);
  const grounded = (record: Candidate) => source.includes(normalize(record.evidence_quote)) && (record.interpretation || normalize(record.evidence_quote).includes(normalize(record.value))) && (!record.qualifier || source.includes(normalize(record.qualifier))) && [record.context?.variant, record.context?.cohort].filter(Boolean).every((value) => source.includes(normalize(value!)));
  if (!records.some((record) => record.field === "title" && grounded(record))) {
    const heading = metadata.headings.find((value) => /programme?|certificate|general management|course/i.test(value) && !/\bequivalent\b|transform your career|unlock|accelerate/i.test(value));
    const line = text.split("\n").map((value) => value.trim()).find((value) => value.length > 20 && value.length < 200 && /^(?:executive (?:post graduate|pg)|post graduate|professional certificate|pg program|general management)/i.test(value) && /programme?|certificate|management/i.test(value) && !/\bequivalent\b/i.test(value));
    const value = heading || line;
    if (value && source.includes(normalize(value))) records.unshift({ field: "title", value, evidence_quote: value, qualifier: "", offer_scope: "same_offer", interpretation: false });
  }
  if (!records.some((record) => record.field === "positioning_audience" && grounded(record))) {
    const audience = records.find((record) => record.field === "audience" && grounded(record));
    if (audience) records.push({ ...audience, field: "positioning_audience" });
    else {
      const audienceLine = text.slice(0, 15000).split("\n").map((value) => value.trim()).find((value) => value.length > 25 && value.length < 350 && /designed for|ideal for|intended for/i.test(value) && /professional|graduate|manager|leader|career/i.test(value) && !/jobassist|alums|alumni|career services|support services/i.test(value));
      if (audienceLine) records.push({ field: "positioning_audience", value: audienceLine, evidence_quote: audienceLine, qualifier: "", offer_scope: "same_offer", interpretation: false });
    }
  }
  if (!records.some((record) => record.field === "credential" && grounded(record) && !/microsoft|\bnsdc\b|\bibm\b|alumni/i.test(record.value))) {
    const award = text.split("\n").map((value) => value.trim()).find((value) => value.length > 35 && value.length < 650 && /(?:program(?:me)? completion certificate.*(?:from|issued by)|(?:receive|awarded|earn|awarding).*certificate.*from)/i.test(value) && !/jobassist|recommended|related (?:course|program)|testimonial|i received|i earned/i.test(value));
    if (award) records.push({ field: "credential", value: award, evidence_quote: award, qualifier: "", offer_scope: "same_offer", interpretation: false, context: { section: "", variant: "", cohort: "", price_basis: "unknown", credential_role: "primary", relation: "main_program" } });
  }
  if (/management|executive mba/i.test(metadata.title + " " + metadata.headings.join(" "))) {
    const mismatched = text.split("\n").map((value) => value.trim()).find((value) => value.length < 650 && /certificate.*data science.*analytics/i.test(value) && /chosen speciali[sz]ation|operations|marketing/i.test(value));
    if (mismatched) records.push({ field: "credential", value: mismatched, evidence_quote: mismatched, qualifier: "", offer_scope: "same_offer", interpretation: false, context: { section: "", variant: "", cohort: "", price_basis: "unknown", credential_role: "primary", relation: "main_program" } });
  }
  return records;
}
