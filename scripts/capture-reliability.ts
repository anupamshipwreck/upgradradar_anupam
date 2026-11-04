import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { registry } from "../src/lib/registry";
import { htmlToPageText } from "../src/lib/page-text";
async function main() {
  await mkdir("artifacts/reliability/raw", { recursive: true });
  for (const [category, entries] of Object.entries(registry)) {
    for (const entry of entries) {
      let url = entry.url; const redirects: string[] = [url];
      for (let index = 0; index < 6; index++) {
        const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; UpGradRadarResearch/1.0)", Accept: "text/html", "Accept-Language": "en-IN,en;q=0.9" }, signal: AbortSignal.timeout(25000) });
        if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get("location")!, url).href; redirects.push(url); await response.body?.cancel(); continue; }
        const html = await response.text(); const $ = load(html); const text = htmlToPageText(html);
        const slug = `${category.startsWith("Data") ? "data" : "management"}-${entry.company.replace(/\W/g, "").toLowerCase()}`;
        const meta = { company: entry.company, category, requested: entry.url, final: url, redirects, status: response.status, title: $("title").text(), headings: $("h1").map((_i, el) => $(el).text().trim()).get(), canonical: $("link[rel=canonical]").attr("href"), lang: $("html").attr("lang"), locale: $("meta[property='og:locale']").attr("content"), characters: text.length };
        await writeFile(`artifacts/reliability/raw/${slug}.html`, html); await writeFile(`artifacts/reliability/raw/${slug}.txt`, text); await writeFile(`artifacts/reliability/raw/${slug}.json`, JSON.stringify(meta, null, 2));
        console.log(JSON.stringify(meta)); break;
      }
    }
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
