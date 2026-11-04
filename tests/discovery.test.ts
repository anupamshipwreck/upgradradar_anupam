import { test } from "node:test";
import assert from "node:assert/strict";
import { signSelection, verifySelection } from "../src/lib/discovery";
import { isPublicAddress, parsePublicHttpsUrl } from "../src/lib/public-url";
import { validateRecords } from "../src/lib/verify";
import { extractPage } from "../src/lib/providers";
import { isSameOriginRequest } from "../src/lib/request-origin";

const category = "Executive / General Management";
const key = "test-signing-key-only";
const selection = { company: "Apna Advantage", category, url: "https://apnaadvantage.com/college/jain-university-online/online-mba-course", title: "Online MBA", match: "Adjacent" as const, expires_at: Date.now() + 60000 };

test("browser origin uses the public Host even when Next rewrites its internal URL", () => {
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/research", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } })), true);
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/research", { headers: { host: "127.0.0.1:3000", origin: "https://untrusted.example" } })), false);
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/research", { headers: { host: "127.0.0.1:3000", origin: "null" } })), false);
});

test("discovery selection is signed, category-bound and expires", () => {
  const token = signSelection(selection, key);
  assert.equal(verifySelection(token, category, key).company, "Apna Advantage");
  assert.throws(() => verifySelection(token, "Data Science & Analytics", key), /another category/);
  assert.throws(() => verifySelection(token, category, "wrong-key"), /Invalid discovery selection/);
  assert.throws(() => verifySelection(signSelection({ ...selection, expires_at: Date.now() - 1000 }, key), category, key), /expired/);
  const [payload, signature] = token.split(".");
  const tampered = Buffer.from(JSON.stringify({ ...selection, url: "https://untrusted.example/" })).toString("base64url");
  assert.notEqual(payload, tampered);
  assert.throws(() => verifySelection(tampered + "." + signature, category, key), /Invalid discovery selection/);
});

test("discovery refuses local addresses, non-HTTPS URLs and credentials", () => {
  for (const url of ["http://example.com", "https://localhost", "https://127.0.0.1/path", "https://[::1]", "https://user:pass@example.com/", "https://example.com:8080/", "https://service.internal/"]) assert.throws(() => parsePublicHttpsUrl(url));
  for (const address of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "169.254.169.254", "172.16.0.1", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("monthly EMI is displayed as financing, not a competing total program fee", () => {
  const result = validateRecords({ candidates: [
    { field: "advertised_fee", value: "INR 5,000/month", evidence_quote: "EMI starts at INR 5,000/month.", qualifier: "", offer_scope: "same_offer", interpretation: false },
    { field: "advertised_fee", value: "INR 100,000", evidence_quote: "Total program fee: INR 100,000.", qualifier: "", offer_scope: "same_offer", interpretation: false },
  ], text: "EMI starts at INR 5,000/month. Total program fee: INR 100,000.", company: "upGrad", category, source_url: "https://www.upgrad.com/test", fetched_at: new Date().toISOString(), runDate: "2026-11-03" });
  assert.equal(result.records.find((record) => record.value === "INR 5,000/month")?.field, "financing");
  assert.equal(result.records.find((record) => record.field === "advertised_fee")?.status, "Source-backed");
  assert.ok(!result.issues.some((issue) => issue.kind === "Conflicting"));
});

test("transient Gemini service failure retries once before accepting validated JSON", async () => {
  let calls = 0;
  const result = await extractPage("Example page text.", { firecrawlKey: "", geminiKey: "test", model: "test" }, new AbortController().signal, (async () => {
    calls++;
    if (calls === 1) return new Response("{}", { status: 503 });
    return Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: '{"records":[]}' }] }] });
  }) as typeof fetch);
  assert.equal(calls, 2); assert.deepEqual(result, { records: [], rejections: [] });
});

test("a malformed record cannot erase the provider's other usable findings", async () => {
  const result = await extractPage("Apply now. Duration: 4 months.", { firecrawlKey: "", geminiKey: "test", model: "test" }, new AbortController().signal, (async () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ records: [
    { field: "cta", value: "Apply", evidence_quote: "Apply", qualifier: "", offer_scope: "same_offer", interpretation: false },
    { field: "duration", value: "4 months", evidence_quote: "Duration: 4 months.", qualifier: "", offer_scope: "same_offer", interpretation: false },
    { field: "invalid_field", value: "bad", evidence_quote: "bad" },
  ] }) }] }] })) as typeof fetch);
  assert.equal(result.records.length, 2);
  assert.equal(result.rejections.length, 1);
  const validated = validateRecords({ candidates: result.records, text: "Apply now. Duration: 4 months.", company: "Example", category, source_url: "https://example.com/", fetched_at: new Date().toISOString(), runDate: "2026-11-03" });
  assert.equal(validated.records.length, 2);
});
