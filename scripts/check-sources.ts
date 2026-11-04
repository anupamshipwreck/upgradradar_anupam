import { registry } from "../src/lib/registry";

async function main() {
  for (const [category, sources] of Object.entries(registry)) {
    const results = await Promise.all(sources.map(async ({ company, url }) => {
      try {
        const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; UpGradRadarResearch/1.0)", Accept: "text/html" }, signal: AbortSignal.timeout(25000) });
        const html = await response.text();
        return { company, status: response.status, url: response.url, characters: html.length, title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0, 180) };
      } catch (error) { return { company, error: error instanceof Error ? error.message : "Fetch failed" }; }
    }));
    console.log(JSON.stringify({ category, results }, null, 2));
  }
}
void main();
