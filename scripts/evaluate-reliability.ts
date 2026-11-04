import { mkdir, readFile, writeFile } from "node:fs/promises";
import { categories, comparisonRecords, type Brief, type Field, type ProviderResult } from "../src/lib/contracts";
import { toMarkdown } from "../src/lib/export";
import { currencyOf } from "../src/lib/source-assessment";

// Part 2 is an acceptance oracle only. This file is never imported by the app.
async function main() {
  const origin = process.argv[2];
  const directory = origin ? "artifacts/reliability/production" : "artifacts/reliability/local";
  await mkdir(directory, { recursive: true });
  const briefs: Brief[] = [];
  for (const [index, category] of categories.entries()) {
    const slug = index === 0 ? "data-science" : "management";
    let brief: Brief;
    if (origin) {
      const response = await fetch(`${origin}/api/research`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ category }), signal: AbortSignal.timeout(290000) });
      if (!response.ok) throw new Error(`Research returned HTTP ${response.status}`);
      const reader = response.body!.getReader(); let pending = ""; const decoder = new TextDecoder(); let completed: Brief | undefined;
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n"); pending = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "progress") console.log(`${slug}: ${event.company} ${event.phase}`);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "complete") completed = event.brief;
        }
      }
      if (!completed) throw new Error("Stream ended without a complete brief");
      brief = completed;
    } else brief = JSON.parse(await readFile(`artifacts/${slug}.json`, "utf8"));
    briefs.push(brief);
    await writeFile(`${directory}/${slug}.json`, JSON.stringify(brief, null, 2));
    await writeFile(`${directory}/${slug}.md`, toMarkdown(brief));
  }
  const checks: { check: string; passed: boolean; detail: string }[] = [];
  const check = (name: string, passed: boolean, detail = "") => checks.push({ check: name, passed, detail });
  const provider = (index: number, company: string) => briefs[index].providers.find((p) => p.company === company)!;
  const records = (p: ProviderResult, field: Field) => comparisonRecords(p, field);
  const values = (p: ProviderResult, field: Field) => records(p, field).map((r) => r.value).join(" / ");
  const has = (p: ProviderResult, field: Field, pattern: RegExp) => pattern.test(values(p, field));
  for (const brief of briefs) {
    check(`${brief.category}: all four pages validated`, brief.providers.length === 4 && brief.providers.every((p) => !p.errors.length && p.extraction_status === "Validated"));
    for (const p of brief.providers) {
      const prefix = `${brief.category}: ${p.company}`;
      check(`${prefix}: India market and intended program established or explicitly reviewed`, p.source_assessment?.market === "India" && !p.source_assessment.block_comparison && ["Matched", "Needs review"].includes(p.source_assessment.program), JSON.stringify(p.source_assessment));
      check(`${prefix}: title, credential and positioning present`, ["title", "credential", "positioning_audience", "promise", "differentiators"].every((field) => records(p, field as Field).length > 0));
      check(`${prefix}: only INR tuition comparable`, records(p, "advertised_fee").length > 0 && records(p, "advertised_fee").every((r) => currencyOf(r.value, r.evidence_quote) === "INR"), values(p, "advertised_fee"));
      check(`${prefix}: concise curriculum and relevant controls`, records(p, "curriculum").length <= 4 && !p.records.some((r) => r.field === "cta" && /^(continue|apply code|submit|send otp)$/i.test(r.value)));
      check(`${prefix}: citation provenance retained`, p.records.every((r) => r.source_url === p.source_url && r.fetched_at === p.fetched_at && !!r.evidence_quote && toMarkdown(brief).includes(r.id)));
      check(`${prefix}: ad counts remain unverified`, !records(p, "ad_count").length);
    }
  }
  const du = provider(0, "upGrad"), dg = provider(0, "Great Learning"), ds = provider(0, "Simplilearn"), de = provider(0, "Emeritus");
  const mu = provider(1, "upGrad"), mg = provider(1, "Great Learning"), ms = provider(1, "Simplilearn"), me = provider(1, "Emeritus");
  check("Part 2: upGrad DS INR180000 and 6 vs 6–9 months retained", has(du, "advertised_fee", /1,80,000/) && has(du, "duration", /6 Months/i) && has(du, "duration", /6[–-]9 months/i) && du.issues.some((i) => i.field === "duration" && i.kind === "Conflicting"));
  check("Part 2: complementary upGrad awards are not conflicting", !du.issues.some((i) => i.field === "credential" && i.kind === "Conflicting") && !mu.issues.some((i) => i.field === "credential" && i.kind === "Conflicting"));
  check("Part 2: GL DS INR210000 vs INR195000 is a true conflict", has(dg, "advertised_fee", /2,10,000/) && has(dg, "advertised_fee", /1\.95 lakh|1,95,000/) && records(dg, "advertised_fee").every((r) => r.status === "Conflicting"));
  check("Part 2: Simplilearn DS INR134999 retained, canonical discrepancy flagged", has(ds, "advertised_fee", /1,34,999/) && ds.issues.some((i) => /canonical/i.test(i.message)) && ds.source_assessment?.program === "Needs review");
  check("Part 2: Emeritus DS FAQ INR132000 + GST recovered", has(de, "advertised_fee", /1,32,000/));
  check("Part 2: upGrad management INR292640 and 11 months", has(mu, "advertised_fee", /2,92,640/) && has(mu, "duration", /11 months/i));
  check("Part 2: GL management headline unresolved; single/dual not contradictions", ["2,35,000", "2,25,000", "2,55,000"].every((value) => values(mg, "advertised_fee").includes(value)) && records(mg, "advertised_fee").every((r) => r.status === "Needs review") && !mg.issues.some((i) => i.field === "advertised_fee" && i.kind === "Conflicting"));
  check("Part 2: GL management wrong-subject certificate flagged", mg.records.some((r) => r.field === "credential" && /data science/i.test(r.value) && r.status === "Needs review"));
  check("Part 2: Simplilearn current landing price does not inherit historical Batch 8 verification", has(ms, "advertised_fee", /2,62,550/) && records(ms, "advertised_fee").every((r) => r.status === "Needs review") && ms.issues.some((i) => /Batch 8.*unconfirmed/i.test(i.message)) && !has(ms, "advertised_fee", /2,22,500/));
  check("Part 2: Emeritus management INR248500 retained and AED excluded", has(me, "advertised_fee", /2,48,500/) && me.records.some((r) => /AED/.test(r.value) && r.comparison_eligible === false) && !me.issues.some((i) => i.kind === "Conflicting"));
  check("Part 2: Emeritus October 11 orientation is historical", me.records.some((r) => r.field === "cohort_date" && /11.*October.*2026/i.test(r.value) && r.status === "Historical"));
  const failures = checks.filter((item) => !item.passed);
  await writeFile(`${directory}/evaluation.json`, JSON.stringify({ evaluated_at: new Date().toISOString(), origin: origin || "local live retrieval", passed: checks.length - failures.length, total: checks.length, checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length - failures.length, total: checks.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; });
