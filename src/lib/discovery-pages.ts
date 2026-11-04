import { load } from "cheerio";
import { type Category } from "./contracts";
import { assertPublicHttpsUrl } from "./public-url";

type Page = { url: string; title: string; heading: string; links: { url: string; text: string }[] };
export async function readDiscoveryPage(value: string, host: string, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<Page | null> {
  try {
    let url = await assertPublicHttpsUrl(value);
    if (url.hostname !== host) return null;
    let response: Response | undefined;
    for (let count = 0; count < 4; count++) {
      response = await fetchImpl(url.href, { redirect: "manual", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), headers: { "User-Agent": "Mozilla/5.0 (compatible; UpGradRadarResearch/1.0)", Accept: "text/html" } });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location"); await response.body?.cancel();
      if (!location) return null;
      url = await assertPublicHttpsUrl(new URL(location, url).href);
      if (url.hostname !== host) return null;
    }
    if (!response?.ok || !response.headers.get("content-type")?.includes("html")) return null;
    const reader = response.body?.getReader(); if (!reader) return null;
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 6_000_000) { await reader.cancel(); return null; } chunks.push(value); }
    const $ = load(Buffer.concat(chunks).toString("utf8"));
    const title = $("title").text().trim();
    const heading = $("h1").first().text().replace(/\s+/g, " ").trim();
    if (/not found|404|access denied|just a moment|request blocked/i.test(title + " " + heading)) return null;
    const links: Page["links"] = [];
    $("a[href]").each((_index, anchor) => {
      try {
        const next = new URL($(anchor).attr("href")!, url);
        next.hash = "";
        if (next.protocol !== "https:" || next.hostname !== host || next.username || next.password || /\.(?:pdf|zip|png|jpg)$/i.test(next.pathname) || /blog|article|login|privacy|terms|about-us|contact/i.test(next.pathname)) return;
        if (!links.some((link) => link.url === next.href)) links.push({ url: next.href, text: $(anchor).text().replace(/\s+/g, " ").trim().slice(0, 300) });
      } catch { /* Ignore malformed site links. */ }
    });
    return { url: url.href, title, heading, links };
  } catch { return null; }
}

export async function findRealProgramPages(host: string, category: Category, proposals: { url: string; title: string; reason: string; match: "Direct" | "Adjacent" }[], signal: AbortSignal, fetchImpl: typeof fetch = fetch) {
  const confirmed: typeof proposals = [];
  const checked = new Set<string>();
  const categoryTerms = category === "Data Science & Analytics" ? /data.?science|analytics|artificial.?intelligence|machine.?learning/i : /management|business|mba|leadership|executive/i;
  async function check(url: string, reason: string, match: "Direct" | "Adjacent") {
    if (checked.has(url) || confirmed.length >= 3) return;
    checked.add(url);
    const page = await readDiscoveryPage(url, host, signal, fetchImpl);
    if (!page || !page.heading || !categoryTerms.test(page.heading + " " + page.title) || /^\/?$/.test(new URL(page.url).pathname) || /^(?:programs|courses|our programs|our courses|degree programs)$/i.test(page.heading) || /^(?:top|best)\b.*\b(?:colleges|universities)\b/i.test(page.heading)) return;
    confirmed.push({ url: page.url, title: page.heading.slice(0, 250), reason, match });
  }
  // Existence and category fit are checked against fetched page titles, not generated URL claims.
  for (let i = 0; i < proposals.length; i += 2) await Promise.all(proposals.slice(i, i + 2).map((candidate) => check(candidate.url, candidate.reason, candidate.match)));
  if (confirmed.length >= 2) return confirmed.slice(0, 3);
  const home = await readDiscoveryPage(`https://${host}/`, host, signal, fetchImpl);
  if (!home) return confirmed;
  let links = home.links;
  const catalogLinks = links.filter((link) => /course|program|degree/i.test(link.url) && !categoryTerms.test(link.url + " " + link.text)).slice(0, 2);
  const catalogs = await Promise.all(catalogLinks.map((link) => readDiscoveryPage(link.url, host, signal, fetchImpl)));
  links = [...links, ...catalogs.flatMap((page) => page?.links ?? [])];
  const relevant = links.filter((link) => categoryTerms.test(link.url + " " + link.text) && !/brochure|contact|apply|login|filter|selectedDegree|\/courses\/?(?:\?|$)/i.test(link.url)).filter((link, index, all) => all.findIndex((other) => other.url === link.url) === index).slice(0, 8);
  for (let index = 0; index < relevant.length && confirmed.length < 3; index += 2) {
    await Promise.all(relevant.slice(index, index + 2).map((link) => check(link.url, "Linked from the competitor’s live official website. Review the program level and curriculum for comparability.", "Adjacent")));
  }
  return confirmed.slice(0, 3);
}
