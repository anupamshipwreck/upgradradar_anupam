import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { type Brief, type DiscoveryResult, type ResearchEvent } from "../src/lib/contracts";
import { toMarkdown } from "../src/lib/export";

async function main() {
  const base = process.argv[2] || "http://127.0.0.1:3000";
  const config = await (await fetch(base + "/api/research")).json();
  assert.equal(config.ready, true, "Research should work without Firecrawl");
  const page = await fetch(base); const html = await page.text();
  assert.equal(page.status, 200); assert.ok(html.includes("upGrad Radar") && html.includes("New competitor"));
  const category = "Executive / General Management";
  const discoveryResponse = await fetch(base + "/api/discover", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ company: "Apna Advantage", category }) });
  const discovery = await discoveryResponse.json() as DiscoveryResult & { error?: string };
  assert.equal(discoveryResponse.status, 200, discovery.error); assert.ok(discovery.candidates.length > 0, discovery.message);
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/app-discovery.json", JSON.stringify(discovery, null, 2));
  const selected = discovery.candidates[0]; console.log(`Selected confirmed test candidate: ${selected.title} (${selected.url})`);
  const response = await fetch(base + "/api/research", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ category, selectionToken: selected.token }) });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader(); const decoder = new TextDecoder(); let buffer = ""; let brief: Brief | undefined;
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done }); const lines = buffer.split("\n"); buffer = lines.pop() || "";
    for (const line of lines) if (line.trim()) {
      const event = JSON.parse(line) as ResearchEvent;
      if (event.type === "progress") console.log(`${event.company}: ${event.phase}`);
      if (event.type === "complete") brief = event.brief;
      if (event.type === "error") throw new Error(event.message);
    }
    if (done) break;
  }
  assert.ok(brief, "The streaming API must finish with a complete brief"); assert.equal(brief.providers.length, 5);
  await writeFile("artifacts/app-custom.json", JSON.stringify(brief, null, 2)); await writeFile("artifacts/app-custom.md", toMarkdown(brief));
  const summary = brief.providers.map((provider) => ({ company: provider.company, records: provider.records.length, fields: new Set(provider.records.map((r) => r.field)).size, errors: provider.errors }));
  console.log(JSON.stringify(summary, null, 2));
  assert.ok(summary.every((provider) => provider.records > 3 && !provider.errors.length), "Each provider should yield useful evidence in the live run");
  console.log("App acceptance passed: live discovery, five-provider research stream, evidence records and Markdown export.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "App check failed"); process.exitCode = 1; });
