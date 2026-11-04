import { type Candidate, type Category, type EvidenceRecord, type Issue } from "./contracts";
import { currencyOf } from "./source-assessment";

const normal = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
export function classifyCandidate(raw: Candidate): Candidate {
  let field = raw.field;
  const quote = normal(raw.evidence_quote), value = normal(raw.value);
  const offset = quote.indexOf(value);
  const context = `${raw.value} ${offset >= 0 ? quote.slice(Math.max(0, offset - 65), offset) : raw.qualifier}`;
  if (field === "advertised_fee") {
    if (/\/\s*(?:mo(?:nth)?|mth)\b|per\s+month|\bEMI\b|monthly installment/i.test(raw.value) || raw.context?.price_basis === "installment") field = "financing";
    else if (/\b(?:you save|savings|save up to|fee waiver|referral discount)\b/i.test(context) || raw.context?.price_basis === "discount") field = "discounts";
    else if ((raw.context?.price_basis !== "total" && /\b(?:seat.?block|block amount|application (?:fee|charge)|admission (?:payment|fee)|processing fee|deposit)\b/i.test(context)) || ["deposit", "application"].includes(raw.context?.price_basis || "")) field = "additional_charges";
  }
  if (field === "credential" && /\bmba\b.*equivalent|equivalent.*\bmba\b/i.test(raw.value)) field = "differentiators";
  return { ...raw, field };
}

export function irrelevantCandidate(candidate: Candidate): boolean {
  if (candidate.context?.relation === "other_program" && !(candidate.field === "credential" && /certificate|awarded/i.test(candidate.evidence_quote) && !/recommended|related (?:course|program)/i.test(candidate.context.section))) return true;
  if (candidate.field === "cta" && /^(?:continue|next|submit|apply code|sign in|log ?in|verify|send otp|accept all|read more|learn more)$/i.test(candidate.value.trim())) return true;
  if (["headline", "cta", "offers", "claims"].includes(candidate.field) && /cookie consent|privacy policy|terms of use|sign in to|password reset|\bOTP\b/i.test(candidate.value)) return true;
  if (candidate.field === "claims" && /rated|\brating|trustpilot|course report|google reviews|average salary|median salary|job openings/i.test(candidate.value + " " + candidate.evidence_quote)) return true;
  return false;
}

function amount(value: string): number | null {
  const match = value.match(/\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|million|[kK]\b)?/);
  if (!match) return null;
  const numeric = Number(match[0].replace(/,/g, "").match(/[\d.]+/)?.[0]);
  return numeric * (/lakh|lac/i.test(match[0]) ? 100000 : /crore/i.test(match[0]) ? 10000000 : /million/i.test(match[0]) ? 1000000 : /k$/i.test(match[0].trim()) ? 1000 : 1);
}

function taxBasis(record: EvidenceRecord): string {
  const basis = (text: string) => {
    if (/no tax|no taxes|tax.?free/i.test(text)) return "none";
    if (/(?:includ(?:e[sd]?|ing)|inclusive|incl\.?)\s*(?:of\s*)?(?:all\s*)?(?:applicable\s*)?(?:tax|gst)/i.test(text)) return "inclusive";
    if (/\+\s*gst|plus\s*(?:applicable\s*)?(?:gst|tax)|(?:excluding|exclusive|before)\s*(?:of\s*)?(?:gst|tax)/i.test(text)) return "exclusive";
    return "unknown";
  };
  const explicit = basis(record.value); if (explicit !== "unknown") return explicit;
  const quote = normal(record.evidence_quote), value = normal(record.value), offset = quote.indexOf(value);
  const nearby = offset >= 0 ? quote.slice(Math.max(0, offset - 30), offset + value.length + 45) : "";
  const local = basis(nearby); if (local !== "unknown") return local;
  if (record.qualifier) return basis(record.qualifier);
  return "unknown";
}

function scope(record: EvidenceRecord): string {
  const cohort = /batch|cohort|intake|20\d{2}/i.test(record.context?.cohort || "") ? record.context?.cohort : "";
  const explicit = [record.context?.variant, cohort].filter(Boolean).map((value) => normal(value!)).join("|");
  if (explicit) return explicit;
  const label = record.qualifier.match(/single speciali[sz]ation|dual speciali[sz]ation|online plan|campus plan|part.?time|full.?time|batch\s*\d+/i)?.[0];
  return label ? normal(label) : "";
}

function credentialRole(record: EvidenceRecord): string {
  if (/alumni|alumnus/i.test(record.value)) return "alumni";
  if (/microsoft|\bnsdc\b|\bibm\b|harvard.*(?:online|business publishing)/i.test(record.value)) return "additional";
  if (/participation|attendance|not.*complete|unable to/i.test(record.value + " " + record.qualifier)) return "conditional";
  return record.context?.credential_role || "unknown";
}

export function applyRecordRules(records: EvidenceRecord[], issues: Issue[], company: string, category: Category) {
  const addIssue = (kind: Issue["kind"], field: EvidenceRecord["field"], message: string, group: EvidenceRecord[]) => issues.push({ company, field, kind, message, record_ids: group.map((record) => record.id) });
  const pricingFields = ["advertised_fee", "additional_charges", "financing", "discounts", "offers"];
  for (const record of records) {
    if (!pricingFields.includes(record.field)) continue;
    const currency = currencyOf(record.value, record.evidence_quote);
    if (currency !== "INR" && (currency !== "Unknown" || record.field === "advertised_fee" || /\d/.test(record.value))) {
      record.comparison_eligible = false;
      record.exclusion_reason = currency === "Unknown" ? "Currency is not established; this amount is excluded from comparable India pricing." : `${currency} amount is excluded from India pricing and promotional comparisons. No currency conversion was performed.`;
      if (record.status !== "Historical") record.status = "Needs review";
      addIssue("Needs review", record.field, record.exclusion_reason, [record]);
    }
  }
  for (const field of ["advertised_fee", "duration"] as const) {
    const group = records.filter((record) => record.field === field && record.comparison_eligible !== false);
    const effectiveScope = (record: EvidenceRecord) => {
      const own = scope(record); if (own || field !== "advertised_fee") return own;
      const sameAmount = group.filter((other) => amount(other.value) === amount(record.value) && currencyOf(other.value, other.evidence_quote) === currencyOf(record.value, record.evidence_quote)).map(scope).filter(Boolean);
      return new Set(sameAmount).size === 1 ? sameAmount[0] : "";
    };
    let conflict = false; let review = false;
    const implicated = new Set<EvidenceRecord>();
    for (let a = 0; a < group.length; a++) for (let b = a + 1; b < group.length; b++) {
      const left = group[a], right = group[b];
      if (field === "advertised_fee") {
        if (currencyOf(left.value, left.evidence_quote) !== currencyOf(right.value, right.evidence_quote)) continue;
        if (amount(left.value) === amount(right.value)) continue;
        const taxLeft = taxBasis(left), taxRight = taxBasis(right);
        if (taxLeft !== taxRight && taxLeft !== "unknown" && taxRight !== "unknown") continue;
        if (taxLeft !== taxRight) { review = true; implicated.add(left); implicated.add(right); continue; }
      } else {
        const signature = (value: string) => {
          const match = value.match(/(\d+(?:\.\d+)?(?:\s*[–—-]\s*\d+(?:\.\d+)?)?)\s*[- ]?\s*(months?|weeks?|years?)/i);
          return match ? match[1].replace(/\s/g, "").replace(/[–—]/g, "-") + " " + match[2].toLowerCase().replace(/s$/, "") : normal(value);
        };
        if (signature(left.value) === signature(right.value)) continue;
      }
      const leftScope = effectiveScope(left), rightScope = effectiveScope(right);
      if (leftScope && rightScope && leftScope !== rightScope) continue;
      implicated.add(left); implicated.add(right);
      if (leftScope !== rightScope || left.status === "Historical" || right.status === "Historical") review = true;
      else conflict = true;
    }
    if (conflict || review) {
      const status = conflict ? "Conflicting" : "Needs review";
      for (const record of implicated) if (record.status !== "Historical") record.status = status;
      addIssue(status, field, `${field === "advertised_fee" ? "Advertised fee" : "Duration"}: ${conflict ? "incompatible values for the same apparent offer remain unresolved." : "the headline value cannot be reconciled with the quoted variant, tax or cohort context; review is required."}`, [...implicated]);
    }
  }
  const primaryCredentials = records.filter((record) => record.field === "credential" && ["primary", "unknown"].includes(credentialRole(record)));
  const wrongSubject = category === "Executive / General Management" ? primaryCredentials.filter((record) => /data science|data analytics/i.test(record.value)) : [];
  if (wrongSubject.length) {
    primaryCredentials.forEach((record) => { if (record.status !== "Historical") record.status = "Needs review"; });
    addIssue("Needs review", "credential", "Credential subject mismatch: the management landing page also describes a Data Science/Analytics award. Exact primary certificate wording is unresolved; supplementary certificates and alumni status are not treated as contradictions.", primaryCredentials);
  }
  // Keep summaries concise without hiding fee, duration or credential discrepancies.
  const caps: Partial<Record<EvidenceRecord["field"], number>> = { curriculum: 4, headline: 2, cta: 2, offers: 2, claims: 2, positioning_audience: 2, promise: 2, differentiators: 3 };
  const counts: Record<string, number> = {};
  const retained = records.filter((record) => { counts[record.field] = (counts[record.field] || 0) + 1; return counts[record.field] <= (caps[record.field] ?? Infinity); });
  records.splice(0, records.length, ...retained);
}
