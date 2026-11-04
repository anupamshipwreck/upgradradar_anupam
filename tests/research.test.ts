import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRecords, parsedCohortDate } from "../src/lib/verify";
import { categories, fieldStatus, type Candidate, type ResearchEvent } from "../src/lib/contracts";
import { runResearch } from "../src/lib/research";
import { scrapePage, safeSourceUrl, missingConfig, type ResearchConfig } from "../src/lib/providers";
import { htmlToPageText } from "../src/lib/page-text";
import { registry, programExpectations } from "../src/lib/registry";
import { toMarkdown } from "../src/lib/export";

const config: ResearchConfig = { firecrawlKey: "test-only-firecrawl", geminiKey: "test-only-gemini", model: "test-model" };
const directConfig = { ...config, firecrawlKey: "" };
const candidate = (field: Candidate["field"], value: string, quote: string, extra: Partial<Candidate> = {}): Candidate => ({ field, value, evidence_quote: quote, qualifier: "", offer_scope: "same_offer", interpretation: false, ...extra });
function verify(candidates: Candidate[], text: string) {
  return validateRecords({ candidates, text, company: "upGrad", category: categories[0], source_url: "https://www.upgrad.com/test", fetched_at: "2026-11-03T10:00:00Z", runDate: "2026-11-03" });
}

test("preserves conflicting fees and durations with exact source provenance", () => {
  const text = "Fee: INR 100,000 + GST. Fee: INR 120,000 + GST. Duration: 4 months. Duration: 4–7 months.";
  const result = verify([candidate("advertised_fee", "INR 100,000 + GST", "Fee: INR 100,000 + GST."), candidate("advertised_fee", "INR 120,000 + GST", "Fee: INR 120,000 + GST."), candidate("duration", "4 months", "Duration: 4 months."), candidate("duration", "4–7 months", "Duration: 4–7 months.")], text);
  assert.equal(result.records.length, 4);
  assert.ok(result.records.every((r) => r.status === "Conflicting" && r.source_url === "https://www.upgrad.com/test"));
  assert.equal(result.issues.filter((i) => i.kind === "Conflicting").length, 2);
});

test("variant qualifiers prevent silently merging distinct offers", () => {
  const text = "Online plan: INR 100,000. Campus plan: INR 120,000.";
  const result = verify([candidate("advertised_fee", "INR 100,000", "Online plan: INR 100,000.", { qualifier: "Online plan", offer_scope: "online" }), candidate("advertised_fee", "INR 120,000", "Campus plan: INR 120,000.", { qualifier: "Campus plan", offer_scope: "campus" })], text);
  assert.ok(result.records.every((r) => r.status === "Source-backed"));
  assert.ok(!result.issues.some((issue) => issue.kind === "Conflicting"));
});

test("rejects invented values, fabricated quotes and fabricated qualifiers", () => {
  const text = "Duration: 4 months. Eligibility: a degree.";
  const result = verify([candidate("duration", "4 months", "Duration: \n 4 months."), candidate("duration", "8 months", "Duration: 4 months."), candidate("eligibility", "a degree", "Eligibility: a degree.", { qualifier: "Scholarship available" }), candidate("title", "A program", "A program that does not appear here")], text);
  assert.equal(result.records.length, 1);
  assert.equal(result.issues.filter((i) => i.kind === "Unverified extraction").length, 3);
});

test("flags a past cohort without assuming closed admissions or invalid program", () => {
  const result = verify([candidate("cohort_date", "11 October 2026", "Orientation: 11 October 2026."), candidate("duration", "4 months", "Duration: 4 months.")], "Orientation: 11 October 2026. Duration: 4 months.");
  assert.equal(result.records[0].status, "Historical");
  assert.equal(result.records[1].status, "Source-backed");
  assert.equal(parsedCohortDate("February 31, 2026"), null);
  assert.equal(parsedCohortDate("October 11, 2026"), "2026-10-11");
});

test("only positioning may contain labeled interpretation; ad counts stay missing", () => {
  const result = verify([candidate("promise", "A flexible learning promise", "Learn at your own pace.", { interpretation: true }), candidate("duration", "Flexible duration", "Learn at your own pace.", { interpretation: true })], "Learn at your own pace.");
  assert.equal(result.records.length, 1);
  assert.ok(result.records[0].interpretation);
  assert.ok(result.issues.some((i) => i.field === "ad_count" && i.kind === "Missing"));
});

test("a fee explicitly attached to a dated older cohort retains its historical status", () => {
  const text = "October 11, 2026 cohort: INR 100,000 + GST.";
  const result = verify([candidate("advertised_fee", "INR 100,000 + GST", text, { qualifier: "October 11, 2026 cohort", offer_scope: "dated cohort" })], text);
  assert.equal(result.records[0].status, "Historical");
});

test("rejects off-domain and unsafe source URLs", () => {
  assert.throws(() => safeSourceUrl("https://untrusted.example/page", registry[categories[0]][0].url));
  assert.throws(() => safeSourceUrl("javascript:alert(1)", registry[categories[0]][0].url));
  assert.equal(safeSourceUrl(undefined, registry[categories[0]][0].url), registry[categories[0]][0].url);
});

test("Gemini alone enables research; HTML evidence excludes script data and decodes entities", () => {
  assert.deepEqual(missingConfig(directConfig), []);
  const text = htmlToPageText('<html><body><nav>Other program: INR 5</nav><main><h1>Data &amp; AI</h1><p>Fee: <span>INR 100,000</span> + GST</p><p>Duration: 4 months.</p></main><script>Fake fee: INR 10</script></body></html>');
  assert.ok(text.includes("Data & AI"));
  assert.ok(text.includes("INR 100,000"));
  assert.ok(!text.includes("INR 10\n") && !text.includes("Fake fee"));
  assert.ok(!text.includes("Other program"));
});

test("direct retrieval follows only approved official redirects and never calls Firecrawl", async () => {
  const requested = registry[categories[0]][1].url;
  const redirected = "https://www.mygreatlearning.com/pg-program-data-science-and-business-analytics-course";
  const calls: string[] = [];
  const page = await scrapePage(requested, directConfig, new AbortController().signal, (async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return new Response(null, { status: 302, headers: { Location: redirected } });
    return new Response(`<html><body><h1>Example Certificate</h1><p>${"Official program curriculum and course information. ".repeat(6)}</p></body></html>`, { headers: { "Content-Type": "text/html" } });
  }) as typeof fetch);
  assert.deepEqual(calls, [requested, redirected]);
  assert.equal(page.method, "Direct HTML");
  assert.equal(page.source_url, redirected);
});

test("direct retrieval rejects unrelated redirects before fetching the destination", async () => {
  let calls = 0;
  await assert.rejects(() => scrapePage(registry[categories[0]][0].url, directConfig, new AbortController().signal, (async () => {
    calls++; return new Response(null, { status: 302, headers: { Location: "https://untrusted.example/program" } });
  }) as typeof fetch), /outside the configured official host/);
  assert.equal(calls, 1);
});

test("access challenge HTML is reported as unavailable rather than extracted", async () => {
  await assert.rejects(() => scrapePage(registry[categories[0]][0].url, directConfig, new AbortController().signal, (async () => new Response('<html><body><h1>Just a moment</h1><p>Verify you are human</p></body></html>', { headers: { "Content-Type": "text/html" } })) as typeof fetch), /access challenge/);
});

test("retries transient retrieval exactly once, with fresh fetch semantics", async () => {
  let calls = 0;
  await assert.rejects(() => scrapePage(registry[categories[0]][0].url, config, new AbortController().signal, (async (_url, init) => {
    calls++;
    assert.equal(JSON.parse(String(init?.body)).maxAge, 0);
    return new Response("{}", { status: 503 });
  }) as typeof fetch));
  assert.equal(calls, 2);
});

for (const category of categories) test(`pipeline: ${category}, streaming, two workers, partial errors, no fallback facts`, async () => {
  const events: ResearchEvent[] = [];
  let retrievalActive = 0; let maxActive = 0;
  const seenUrls: string[] = [];
  const page = "Program: Example Certificate. Duration: 4 months. Apply now for the program.";
  const mockFetch: typeof fetch = async (input, init) => {
    if (String(input).includes("firecrawl")) {
      const body = JSON.parse(String(init?.body)); seenUrls.push(body.url);
      retrievalActive++; maxActive = Math.max(maxActive, retrievalActive);
      await new Promise((resolve) => setTimeout(resolve, 5)); retrievalActive--;
      if (body.url === registry[category][3].url) return new Response("{}", { status: 403 });
      const source = registry[category].find((entry) => entry.url === body.url)!;
      return Response.json({ success: true, data: { markdown: page, metadata: { sourceURL: body.url, title: programExpectations[category][source.company].name, statusCode: 200 } } });
    }
    assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/interactions");
    assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], config.geminiKey);
    const body = JSON.parse(String(init?.body)); assert.equal(body.store, false); assert.equal(body.model, config.model);
    return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ records: [candidate("title", "Example Certificate", "Program: Example Certificate."), candidate("duration", "4 months", "Duration: 4 months."), candidate("cta", "Apply now", "Apply now for the program.")] }) }] }] });
  };
  const brief = await runResearch(category, config, new AbortController().signal, (event) => events.push(event), mockFetch);
  assert.equal(brief.providers.length, 4); assert.equal(maxActive, 2);
  assert.deepEqual([...seenUrls].sort(), registry[category].map((p) => p.url).sort());
  assert.equal(brief.providers[3].records.length, 0);
  assert.equal(fieldStatus(brief.providers[3], "advertised_fee"), "Source unavailable");
  assert.equal(fieldStatus(brief.providers[0], "advertised_fee"), "Not publicly verified");
  assert.equal(events.filter((e) => e.type === "provider").length, 4);
  assert.equal(events.at(-1)?.type, "complete");
  const markdown = toMarkdown(brief);
  assert.ok(markdown.includes("Not publicly verified"));
  assert.ok(markdown.includes("Source unavailable"));
  assert.ok(markdown.includes("Duration: 4 months."));
  assert.ok(markdown.includes("official program landing page"));
  for (const source of registry[category]) assert.ok(markdown.includes(source.url));
});

test("invalid model JSON causes provider failure without discarding other providers", async () => {
  let extractions = 0;
  const mockFetch: typeof fetch = async (input, init) => {
    if (String(input).includes("firecrawl")) return Response.json({ success: true, data: { markdown: "Program: Example Certificate.", metadata: { sourceURL: JSON.parse(String(init?.body)).url } } });
    extractions++;
    return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: extractions === 1 ? "invalid JSON" : JSON.stringify({ records: [] }) }] }] });
  };
  const brief = await runResearch(categories[0], config, new AbortController().signal, () => {}, mockFetch);
  assert.equal(brief.providers.filter((p) => p.extraction_status === "Failed").length, 1);
  assert.equal(brief.providers.filter((p) => p.extraction_status === "Validated").length, 3);
  assert.equal(brief.providers.flatMap((p) => p.records).length, 0);
});
