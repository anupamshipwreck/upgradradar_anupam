import { mkdir, writeFile } from "node:fs/promises";
import { categories, type Category } from "../src/lib/contracts";
import { getConfig } from "../src/lib/providers";
import { runResearch } from "../src/lib/research";
import { toMarkdown } from "../src/lib/export";

async function main() {
  const requested = process.argv[2];
  const selected: readonly Category[] = requested === "data" ? [categories[0]] : requested === "management" ? [categories[1]] : categories;
  await mkdir("artifacts", { recursive: true });
  for (const category of selected) {
    const brief = await runResearch(category, getConfig(), AbortSignal.timeout(260000), (event) => {
      if (event.type === "progress") console.log(`${event.company}: ${event.phase}`);
    });
    const slug = category === categories[0] ? "data-science" : "management";
    await writeFile(`artifacts/${slug}.json`, JSON.stringify(brief, null, 2));
    await writeFile(`artifacts/${slug}.md`, toMarkdown(brief));
    console.log(JSON.stringify({ category, providers: brief.providers.map((p) => ({ company: p.company, method: p.retrieval_method, characters: p.characters, records: p.records.length, fields: new Set(p.records.map((r) => r.field)).size, errors: p.errors, rejected: p.issues.filter((i) => i.kind === "Unverified extraction").length, highlights: p.records.filter((r) => ["advertised_fee", "duration", "title"].includes(r.field)).map((r) => ({ field: r.field, value: r.value, status: r.status })) })) }, null, 2));
    if (brief.providers.some((p) => p.records.length < 4)) process.exitCode = 1;
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Live check failed"); process.exitCode = 1; });
