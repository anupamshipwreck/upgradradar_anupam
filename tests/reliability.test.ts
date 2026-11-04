import { test } from "node:test";
import assert from "node:assert/strict";
import { assessSource } from "../src/lib/source-assessment";
import { validateRecords } from "../src/lib/verify";
import { comparisonRecords, fieldStatus, type Candidate, type PageMetadata, type ProviderResult } from "../src/lib/contracts";
import { coreFallbacks } from "../src/lib/core-fallbacks";
import { toMarkdown } from "../src/lib/export";
import { runResearch } from "../src/lib/research";
import { groundedNumeric } from "../src/lib/grounded-numeric";

const category = "Data Science & Analytics";
const candidate = (field: Candidate["field"], value: string, evidence_quote: string, context?: Partial<NonNullable<Candidate["context"]>>): Candidate => ({ field, value, evidence_quote, qualifier: "", offer_scope: "same_offer", interpretation: false, ...(context ? { context: { section: "", variant: "", cohort: "", price_basis: "unknown", credential_role: "unknown", relation: "main_program", ...context } } : {}) });
const verify = (records: Candidate[], text: string, selectedCategory: typeof category | "Executive / General Management" = category) => validateRecords({ candidates: records, text, company: "Example", category: selectedCategory, source_url: "https://example.com/program", fetched_at: "2026-11-04T02:00:00Z", runDate: "2026-11-04" });
const metadata: PageMetadata = { title: "IIIT Bangalore Data Science certificate", headings: ["Data Science & AI from IIIT Bangalore"], canonical_url: "", language: "en", redirect_chain: ["https://www.upgrad.com/data-science-pgc-iiitb/"] };

test("US redirect quarantines the whole regional offer, not only the dollar fee", () => {
  const assessment = assessSource({ company: "upGrad", category: category as typeof category, requested: metadata.redirect_chain[0], final: "https://www.upgrad.com/us/data-science-pgc-iiitb/", metadata: { ...metadata, redirect_chain: [...metadata.redirect_chain, "https://www.upgrad.com/us/data-science-pgc-iiitb/"] }, text: "Tuition: USD 3000.", candidates: [candidate("advertised_fee", "USD 3000", "Tuition: USD 3000.")] });
  assert.equal(assessment.program, "Matched"); assert.equal(assessment.market, "International"); assert.equal(assessment.block_comparison, true);
});

test("en_US metadata alone does not reject a genuine INR program; USD-only tuition does", () => {
  const input = { company: "upGrad", category: category as typeof category, requested: metadata.redirect_chain[0], final: metadata.redirect_chain[0], metadata: { ...metadata, language: "en-US" } };
  assert.equal(assessSource({ ...input, text: "Fee: INR 100,000.", candidates: [candidate("advertised_fee", "INR 100,000", "Fee: INR 100,000.")] }).market, "India");
  assert.equal(assessSource({ ...input, metadata: { ...metadata, title: metadata.title + " in India" }, text: "Fee: USD 3000.", candidates: [candidate("advertised_fee", "USD 3000", "Fee: USD 3000.")] }).block_comparison, true);
});

test("incorrect program identity blocks comparison and a different canonical program is flagged", () => {
  const input = { company: "Simplilearn", category: category as typeof category, requested: "https://www.simplilearn.com/iitk-professional-certificate-course-data-analytics", final: "https://www.simplilearn.com/iitk-professional-certificate-course-data-analytics", text: "IIT Madras program. Fee: INR 100,000.", candidates: [candidate("advertised_fee", "INR 100,000", "Fee: INR 100,000.")] };
  assert.equal(assessSource({ ...input, metadata: { ...metadata, title: "IIT Madras Data Analytics", headings: ["IIT Madras Data Analytics"] } }).program, "Mismatch");
  const result = assessSource({ ...input, text: "IIT Kanpur Data Analytics. Fee: INR 100,000.", metadata: { ...metadata, title: "IIT Kanpur Data Analytics", headings: ["IIT Kanpur Data Analytics"], canonical_url: "https://www.simplilearn.com/iitm-ai-data-analytics-program" } });
  assert.equal(result.program, "Needs review"); assert.ok(result.reasons.some((reason) => reason.includes("canonical")));
});

test("a different program slug cannot silently replace the intended program at the same institution", () => {
  const result = assessSource({ company: "upGrad", category, requested: metadata.redirect_chain[0], final: "https://www.upgrad.com/another-iiitb-data-science-program/", text: "IIIT Bangalore Data Science. Fee: INR 100,000.", metadata, candidates: [candidate("advertised_fee", "INR 100,000", "Fee: INR 100,000.")] });
  assert.equal(result.program, "Mismatch"); assert.equal(result.block_comparison, true);
});

test("format words do not turn the same duration into a contradiction", () => {
  const result = verify([candidate("duration", "10 Months Live Online", "Duration: 10 Months Live Online."), candidate("duration", "10 Months", "Duration: 10 Months.")], "Duration: 10 Months Live Online. Duration: 10 Months.");
  assert.ok(!result.issues.some((issue) => issue.kind === "Conflicting"));
});

test("mixed currencies, EMI and GST-inclusive totals are not contradictory Indian tuition", () => {
  const text = "Tuition: INR 100,000 + GST. Including GST: INR 118,000. Programme fee: AED 5,000. EMI: INR 4,000/month. Invite and save AED 100.";
  const { records, issues } = verify([candidate("advertised_fee", "INR 100,000 + GST", "Tuition: INR 100,000 + GST."), candidate("advertised_fee", "INR 118,000", "Including GST: INR 118,000."), candidate("advertised_fee", "AED 5,000", "Programme fee: AED 5,000."), candidate("advertised_fee", "INR 4,000/month", "EMI: INR 4,000/month."), candidate("offers", "AED 100", "Invite and save AED 100.")], text);
  assert.ok(!issues.some((issue) => issue.kind === "Conflicting"));
  assert.equal(records.find((record) => record.value === "AED 5,000")?.comparison_eligible, false);
  assert.equal(records.find((record) => record.value === "AED 100")?.comparison_eligible, false);
  assert.equal(records.find((record) => record.value === "INR 4,000/month")?.field, "financing");
  assert.equal(records.find((record) => record.value === "INR 100,000 + GST")?.status, "Source-backed");
});

test("known GL fee discrepancy conflicts; single/dual variants require headline review without conflicting with each other", () => {
  const text = "Program fee: INR 210,000 + GST. FAQ fee: INR 195,000 + GST.";
  assert.ok(verify([candidate("advertised_fee", "INR 210,000 + GST", "Program fee: INR 210,000 + GST."), candidate("advertised_fee", "INR 195,000 + GST", "FAQ fee: INR 195,000 + GST.")], text).records.every((record) => record.status === "Conflicting"));
  const management = "Headline: INR 235,000 + GST. Single specialization: INR 225,000 + GST. Dual specialization: INR 255,000 + GST.";
  const result = verify([candidate("advertised_fee", "INR 235,000 + GST", "Headline: INR 235,000 + GST."), candidate("advertised_fee", "INR 225,000 + GST", "Single specialization: INR 225,000 + GST.", { variant: "Single specialization" }), candidate("advertised_fee", "INR 255,000 + GST", "Dual specialization: INR 255,000 + GST.", { variant: "Dual specialization" })], management);
  assert.ok(result.records.every((record) => record.status === "Needs review")); assert.ok(!result.issues.some((issue) => issue.kind === "Conflicting"));
});

test("generic inclusions do not imply tax-inclusive fees", () => {
  const text = "Programme fee: INR 100,000 + GST, includes mentorship. FAQ fee: INR 90,000 + GST, includes career support.";
  const result = verify([candidate("advertised_fee", "INR 100,000 + GST", "Programme fee: INR 100,000 + GST, includes mentorship."), candidate("advertised_fee", "INR 90,000 + GST", "FAQ fee: INR 90,000 + GST, includes career support.")], text);
  assert.ok(result.records.every((record) => record.status === "Conflicting"));
});

test("complementary and alumni credentials are not conflicts; wrong primary subject is flagged", () => {
  const text = "Certificate from IIIT Bangalore. Microsoft certificate. NSDC certificate. Alumni status from IIIT Bangalore.";
  const result = verify([candidate("credential", "Certificate from IIIT Bangalore", "Certificate from IIIT Bangalore.", { credential_role: "primary" }), candidate("credential", "Microsoft certificate", "Microsoft certificate."), candidate("credential", "NSDC certificate", "NSDC certificate."), candidate("credential", "Alumni status from IIIT Bangalore", "Alumni status from IIIT Bangalore.")], text);
  assert.ok(!result.issues.some((issue) => issue.kind === "Conflicting" || issue.kind === "Needs review"));
  const management = "Executive PG Program in Management certificate. Certificate in Data Science & Analytics.";
  const wrong = verify([candidate("credential", "Executive PG Program in Management certificate", "Executive PG Program in Management certificate."), candidate("credential", "Certificate in Data Science & Analytics", "Certificate in Data Science & Analytics.")], management, "Executive / General Management");
  assert.ok(wrong.issues.some((issue) => issue.field === "credential" && issue.kind === "Needs review"));
});

test("title fallback is copied from the retrieved main heading and curriculum stays concise", () => {
  const text = "Executive PG Certificate in Data Science. Apply Now. CONTINUE. APPLY CODE. Python. Statistics. SQL. Machine Learning. Deep Learning.";
  const fallback = coreFallbacks([], text, { ...metadata, headings: ["Executive PG Certificate in Data Science"] });
  assert.equal(fallback[0].value, "Executive PG Certificate in Data Science");
  const result = verify([...fallback, candidate("cta", "CONTINUE", "CONTINUE"), candidate("cta", "APPLY CODE", "APPLY CODE"), candidate("cta", "Apply Now", "Apply Now"), ...["Python", "Statistics", "SQL", "Machine Learning", "Deep Learning"].map((word) => candidate("curriculum", word, word))], text);
  assert.equal(result.records.filter((record) => record.field === "curriculum").length, 4);
  assert.equal(result.records.filter((record) => record.field === "cta").length, 1);
});

test("literal recovery retains the fee-section duration and paired specialization prices", () => {
  const text = "Course Fee\n\n6 Months\n\nStarting at\n\nINR 5,000/month\n\nTotal Program Fee\n\nINR 100,000\n\nWith a single specialization\n\nWith Dual Specialization\n\n₹ 225,000 + GST\n\n₹ 255,000 + GST\n\nFAQ: duration 6–9 months.";
  const recovered = groundedNumeric(text);
  assert.ok(recovered.some((record) => record.field === "duration" && record.value === "6 Months"));
  assert.ok(recovered.some((record) => record.field === "advertised_fee" && record.value === "INR 100,000"));
  assert.ok(!recovered.some((record) => record.field === "advertised_fee" && record.value === "INR 5,000"));
  assert.equal(recovered.filter((record) => record.context?.variant).length, 2);
  const result = verify([...recovered, candidate("duration", "6–9 months", "FAQ: duration 6–9 months.")], text);
  assert.ok(result.issues.some((issue) => issue.field === "duration" && issue.kind === "Conflicting"));
});

test("rejected model fields cannot prevent literal core-field recovery", () => {
  const text = "Professional Certificate Course in Data Analytics.\nDesigned for working professionals who want to upskill.\nGet Program completion certificate from EICTA Consortium, issued by E&ICT Academy, IIT Kanpur";
  const recovered = coreFallbacks([candidate("positioning_audience", "Working professionals", "Invented quote"), candidate("credential", "Professional certificate", "Another invented quote")], text, { ...metadata, headings: ["Professional Certificate Course in Data Analytics"] });
  const result = verify(recovered, text);
  assert.ok(result.records.some((record) => record.field === "positioning_audience" && record.value === "Designed for working professionals who want to upskill."));
  assert.ok(result.records.some((record) => record.field === "credential" && record.value.includes("issued by E&ICT Academy, IIT Kanpur")));
  assert.equal(result.issues.filter((issue) => issue.kind === "Unverified extraction").length, 2);
});

test("international claims remain cited but disappear from comparison and executive summary", async () => {
  const text = "# Data Science certificate from IIIT Bangalore\nTuition: USD 3000. Duration: 6 months.";
  const brief = await runResearch(category, { geminiKey: "test", firecrawlKey: "test", model: "test" }, new AbortController().signal, () => {}, (async (url) => String(url).includes("firecrawl") ? Response.json({ success: true, data: { markdown: text, metadata: { sourceURL: "https://www.upgrad.com/us/data-science-pgc-iiitb/", title: metadata.title } } }) : Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ records: [candidate("title", "Data Science certificate from IIIT Bangalore", "Data Science certificate from IIIT Bangalore"), candidate("advertised_fee", "USD 3000", "Tuition: USD 3000.")] }) }] }] })) as typeof fetch, [{ company: "upGrad", url: metadata.redirect_chain[0] }]);
  const provider = brief.providers[0]; assert.equal(provider.source_assessment?.block_comparison, true);
  assert.equal(comparisonRecords(provider, "advertised_fee").length, 0); assert.equal(fieldStatus(provider, "advertised_fee"), "Needs review");
  const markdown = toMarkdown(brief); assert.ok(!markdown.split("## Evidence & source access")[0].includes("USD 3000"));
  assert.ok(markdown.includes("USD 3000") && markdown.includes("EXCLUDED FROM INDIA COMPARISON") && markdown.includes(provider.source_url));
});
