// Optional paid live integration check; does not fetch competitor pages or seed the UI.
import assert from "node:assert/strict";
import { extractPage, getConfig } from "../src/lib/providers";
import { validateRecords } from "../src/lib/verify";
const config = getConfig();
if (!config.geminiKey) throw new Error("Set GEMINI_API_KEY before running this check.");
const text = "TEST FIXTURE ONLY. Program title: Example Research Certificate. Duration: 4 months. Fee: INR 100,000 + GST. Apply now for the program.";
async function main() {
  const diagnosticFetch: typeof fetch = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.clone().json().catch(() => null) as { error?: { message?: string } } | null;
      const message = body?.error?.message;
      if (message) console.error(message.replaceAll(config.geminiKey, "[redacted]").slice(0, 1600));
    }
    return response;
  };
  const extracted = await extractPage(text, config, new AbortController().signal, diagnosticFetch);
  const result = validateRecords({ candidates: extracted.records, text, company: "upGrad", category: "Data Science & Analytics", source_url: "https://www.upgrad.com/test-fixture", fetched_at: new Date().toISOString(), runDate: new Date().toISOString().slice(0, 10) });
  assert.ok(result.records.some((r) => r.field === "duration" && r.value === "4 months"));
  assert.ok(result.records.some((r) => r.field === "advertised_fee"));
  assert.equal(result.issues.filter((i) => i.kind === "Unverified extraction").length, 0);
  console.log(`Gemini live check passed (${config.model}): ${result.records.length} source-grounded records from an isolated test fixture. No findings were saved.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Gemini check failed"); process.exitCode = 1; });
