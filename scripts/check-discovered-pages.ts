import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { type DiscoveryResult } from "../src/lib/contracts";
async function main() {
  const discovery = JSON.parse(await readFile("artifacts/discovery.json", "utf8")) as DiscoveryResult;
  const home = await fetch("https://" + discovery.official_host, { signal: AbortSignal.timeout(20000) });
  const homeHtml = await home.text(); const homeDoc = load(homeHtml);
  console.log(JSON.stringify({ homepage: home.url, title: homeDoc("title").text(), links: [...new Set(homeDoc("a[href]").map((_i, a) => homeDoc(a).attr("href")).get())].filter((url) => /mba|business|management|analytics|degree|course|program/i.test(url)).slice(0, 70) }, null, 2));
  await Promise.all(discovery.candidates.map(async (candidate) => {
    try {
      const response = await fetch(candidate.url, { signal: AbortSignal.timeout(20000) });
      const html = await response.text(); const $ = load(html);
      console.log(JSON.stringify({ url: candidate.url, status: response.status, final: response.url, title: $("title").text(), heading: $("h1").first().text(), chars: html.length }));
    } catch (error) { console.log(candidate.url, error instanceof Error ? error.message : "Failed"); }
  }));
}
void main();
