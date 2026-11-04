import { load } from "cheerio";
import { type PageMetadata } from "./contracts";

/** Text of retrieved HTML only; scripts and linked pages are never used as evidence. */
export function htmlToPageText(html: string): string {
  const $ = load(html);
  $("script, style, noscript, svg, template, iframe, nav, footer, [role=navigation], [data-cookieconsent], .cookie-banner").remove();
  $("br").replaceWith("\n");
  $("p, div, section, article, main, h1, h2, h3, h4, h5, h6, li, tr, dt, dd, blockquote").each((_index, element) => { $(element).prepend("\n").append("\n"); });
  $("td, th, span, a, strong, em, b, button, label").each((_index, element) => { $(element).prepend(" ").append(" "); });
  return $("body").text().replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function pageMetadata(html: string, url: string, redirects: string[]): PageMetadata {
  const $ = load(html);
  const text = (selector: string) => $(selector).first().text().replace(/\s+/g, " ").trim();
  const headings = $("h1").map((_i, node) => { const clone = $(node).clone(); clone.find("br").replaceWith(" "); clone.find("span,strong,a").prepend(" ").append(" "); return clone.text().replace(/\s+/g, " ").trim(); }).get();
  let canonical_url = "";
  try { const canonical = $("link[rel=canonical]").attr("href"); if (canonical) canonical_url = new URL(canonical, url).href; } catch { /* Invalid metadata is not a source URL. */ }
  return { title: text("title"), headings, canonical_url, language: $("html").attr("lang") || "", redirect_chain: redirects };
}

export function isAccessChallenge(text: string): boolean {
  return text.length < 150 || /just a moment|checking your browser|verify (?:that )?you are human|enable javascript and cookies to continue|access denied|request blocked|captcha/i.test(text.slice(0, 4000)) && text.length < 8000;
}
