import { z } from "zod";

export const categories = ["Data Science & Analytics", "Executive / General Management"] as const;
export type Category = (typeof categories)[number];
export const companies = ["upGrad", "Great Learning", "Simplilearn", "Emeritus"] as const;
export type Company = string;
export const dimensions = ["Pricing", "Programs", "Positioning", "Marketing"] as const;
export type Dimension = (typeof dimensions)[number];

export const fields = {
  advertised_fee: { label: "Advertised fee & currency", dimension: "Pricing" },
  tax: { label: "GST / taxes", dimension: "Pricing" },
  additional_charges: { label: "Application & seat charges", dimension: "Pricing" },
  discounts: { label: "Discounts & restrictions", dimension: "Pricing" },
  financing: { label: "EMI & financing", dimension: "Pricing" },
  title: { label: "Program title", dimension: "Programs" },
  duration: { label: "Duration", dimension: "Programs" },
  eligibility: { label: "Eligibility", dimension: "Programs" },
  audience: { label: "Target audience", dimension: "Programs" },
  curriculum: { label: "Key curriculum topics", dimension: "Programs" },
  format: { label: "Learning format", dimension: "Programs" },
  credential: { label: "Credential", dimension: "Programs" },
  institution: { label: "Issuing institution", dimension: "Programs" },
  career_support: { label: "Advertised career support", dimension: "Programs" },
  cohort_date: { label: "Cohort / orientation dates", dimension: "Programs" },
  positioning_audience: { label: "Explicit audience", dimension: "Positioning" },
  promise: { label: "Core promise", dimension: "Positioning" },
  differentiators: { label: "Stated differentiators", dimension: "Positioning" },
  headline: { label: "Promotional headlines", dimension: "Marketing" },
  cta: { label: "Calls to action", dimension: "Marketing" },
  offers: { label: "On-page offers", dimension: "Marketing" },
  claims: { label: "On-page claims", dimension: "Marketing" },
  ad_count: { label: "Active ad count", dimension: "Marketing" },
} as const satisfies Record<string, { label: string; dimension: Dimension }>;
export type Field = keyof typeof fields;
export const fieldNames = Object.keys(fields) as [Field, ...Field[]];

export const candidateSchema = z.object({
  field: z.enum(fieldNames).refine((v) => v !== "ad_count", "Ad counts cannot be verified from landing pages"),
  value: z.string().trim().min(1).max(900),
  evidence_quote: z.string().trim().min(1).max(1400),
  qualifier: z.string().max(700),
  offer_scope: z.string().max(200),
  interpretation: z.boolean(),
  context: z.object({
    section: z.string().max(250), variant: z.string().max(250), cohort: z.string().max(250),
    price_basis: z.enum(["total", "installment", "deposit", "application", "discount", "unknown"]),
    credential_role: z.enum(["primary", "additional", "alumni", "conditional", "unknown"]),
    relation: z.enum(["main_program", "other_program", "unknown"]),
  }).strict().optional(),
}).strict();
export const extractionSchema = z.object({ records: z.array(candidateSchema).max(100) }).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export type ExtractionResult = { records: Candidate[]; rejections: { field: Field | null; message: string }[] };
export type Status = "Source-backed" | "Conflicting" | "Historical" | "Not publicly verified" | "Source unavailable" | "Needs review";
export type EvidenceRecord = Candidate & {
  id: string; company: Company; category: Category; program: string;
  dimension: Dimension; source_url: string; fetched_at: string; status: Status;
  comparison_eligible?: boolean; exclusion_reason?: string;
};
export type PageMetadata = { title: string; headings: string[]; canonical_url: string; language: string; redirect_chain: string[] };
export type SourceAssessment = { market: "India" | "International" | "Unclear"; program: "Matched" | "Mismatch" | "Needs review"; expected_program: string; reasons: string[]; block_comparison: boolean };
export type Issue = {
  company: Company; field: Field | null;
  kind: "Missing" | "Conflicting" | "Historical" | "Needs review" | "Source unavailable" | "Unverified extraction";
  message: string; record_ids: string[];
};
export type ProviderResult = {
  company: Company; requested_url: string; source_url: string; fetched_at: string;
  retrieval_status: "Retrieved" | "Source unavailable";
  extraction_status: "Validated" | "Failed" | "Skipped";
  attempts: number; characters: number; truncated: boolean;
  retrieval_method: "Direct HTML" | "Firecrawl";
  page_metadata?: PageMetadata; source_assessment?: SourceAssessment;
  errors: string[]; records: EvidenceRecord[]; issues: Issue[];
};
export type Brief = {
  category: Category; started_at: string; completed_at: string; model: string;
  providers: ProviderResult[];
};
export type Phase = "Queued" | "Retrieving" | "Extracting" | "Validating" | "Complete" | "Failed";
export type ResearchEvent =
  | { type: "progress"; company: Company; phase: Phase }
  | { type: "provider"; provider: ProviderResult }
  | { type: "complete"; brief: Brief }
  | { type: "error"; message: string };

export type DiscoveryCandidate = { company: string; title: string; url: string; reason: string; match: "Direct" | "Adjacent"; token: string };
export type DiscoveryResult = { official_host: string; candidates: DiscoveryCandidate[]; sources: { title: string; url: string }[]; search_suggestions: string; message: string };

export function fieldStatus(provider: ProviderResult, field: Field): Status {
  if (provider.retrieval_status === "Source unavailable" || provider.extraction_status === "Failed") return "Source unavailable";
  const all = provider.records.filter((r) => r.field === field);
  const records = all.filter((r) => r.comparison_eligible !== false);
  if (!records.length && (all.length || provider.source_assessment?.block_comparison)) return "Needs review";
  for (const status of ["Conflicting", "Needs review", "Historical", "Source-backed"] as const) {
    if (records.some((r) => r.status === status)) return status;
  }
  return "Not publicly verified";
}

export const comparisonRecords = (provider: ProviderResult, field: Field) => provider.records.filter((record) => record.field === field && record.comparison_eligible !== false).filter((record, index, all) => all.findIndex((other) => other.value.toLowerCase().replace(/[\s,*]/g, "") === record.value.toLowerCase().replace(/[\s,*]/g, "") && other.status === record.status) === index);
