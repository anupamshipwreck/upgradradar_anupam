import { mkdir, writeFile } from "node:fs/promises";
import { discoverPrograms } from "../src/lib/discovery";
import { getConfig } from "../src/lib/providers";
async function main() {
  const result = await discoverPrograms("Apna Advantage", "Executive / General Management", getConfig(), AbortSignal.timeout(110000));
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/discovery.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ host: result.official_host, message: result.message, candidates: result.candidates.map(({ title, url, match, reason }) => ({ title, url, match, reason })), source_count: result.sources.length }, null, 2));
  if (!result.candidates.length) process.exitCode = 1;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Discovery failed"); process.exitCode = 1; });
