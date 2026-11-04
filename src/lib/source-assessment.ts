import { type Candidate, type Category, type PageMetadata, type SourceAssessment } from "./contracts";
import { programExpectations } from "./registry";

export function explicitForeignRegion(value: string): boolean {
  try {
    const url = new URL(value);
    if (/^\/(?:us|usa|uk|gb|ae|uae|sg|au|ca|en-us|en-gb)(?:\/|$)/i.test(url.pathname)) return true;
    return [...url.searchParams].some(([key, entry]) => /^(?:country|region|market|locale)$/i.test(key) && /^(?:us|usa|uk|gb|ae|uae|sg|au|ca|en-us|en-gb)$/i.test(entry));
  } catch { return true; }
}

export function currencyOf(value: string, quote = ""): string {
  const find = (text: string) => [...new Set((text.match(/₹|\bINR\b|\bRs\.?|\bUSD\b|US\$|\bAED\b|\bGBP\b|£|\bEUR\b|€|\bAUD\b|\bCAD\b|\bSGD\b|\$/gi) || []).map((token) => /₹|^inr$|^rs/i.test(token) ? "INR" : /^aed$/i.test(token) ? "AED" : /^gbp$|£/i.test(token) ? "GBP" : /^eur$|€/i.test(token) ? "EUR" : /^(aud|cad|sgd)$/i.test(token) ? token.toUpperCase() : "USD"))];
  const direct = find(value); if (direct.length === 1) return direct[0];
  const context = find(quote); return direct.length === 0 && context.length === 1 ? context[0] : "Unknown";
}

export function assessSource(input: { company: string; category: Category; requested: string; final: string; text: string; metadata: PageMetadata; candidates: Candidate[] }): SourceAssessment {
  const expected = programExpectations[input.category][input.company];
  const reasons: string[] = [];
  const primary = [input.metadata.title, ...input.metadata.headings].join(" ");
  const identity = primary || input.candidates.filter((record) => record.field === "title").map((record) => record.value).join(" ");
  let program: SourceAssessment["program"] = "Matched";
  if (expected) {
    if (!identity || !expected.subject.test(identity)) { program = identity ? "Mismatch" : "Needs review"; reasons.push(`The main page title/heading does not establish the intended program: ${expected.name}.`); }
    else if (!expected.institution.test(primary + " " + input.text.slice(0, 12000))) { program = "Mismatch"; reasons.push(`The intended institution is not established for ${expected.name}.`); }
    if (/\b(?:iit\s+(?:madras|kanpur|guwahati|bombay|roorkee)|iiit\s*bangalore|iim\s+(?:bangalore|indore|kozhikode|lucknow|calcutta)|ut austin|great lakes)\b/i.test(primary) && !expected.institution.test(primary)) {
      program = "Mismatch"; reasons.push("The primary page heading names a different institution from the configured intended program.");
    }
    const requestedPath = new URL(input.requested).pathname.replace(/\/$/, "");
    const finalPath = new URL(input.final).pathname.replace(/\/$/, "");
    if (requestedPath !== finalPath && !explicitForeignRegion(input.final)) {
      program = "Mismatch"; reasons.push("The configured URL redirected to a different program path. The replacement has not been approved and is excluded from comparison.");
    }
    if (/\b(?:master of|bachelor of|mba degree|msc degree|post.?graduate diploma)\b/i.test(primary) && !/equivalent|equivalence/i.test(primary)) {
      program = "Mismatch"; reasons.push("The primary page advertises a different qualification type from the intended certificate program.");
    }
    if (input.metadata.canonical_url) {
      const canonical = new URL(input.metadata.canonical_url);
      const actual = new URL(input.final);
      const path = (value: string) => value.replace(/\/index\.php\/?$/, "").replace(/\/$/, "");
      if (path(canonical.pathname) !== path(actual.pathname)) {
        if (program === "Matched") program = "Needs review";
        reasons.push("The canonical page metadata points to a different program path; the actual fetched title and URL must be reviewed. No replacement page was fetched.");
      }
    }
  } else if (!identity) { program = "Needs review"; reasons.push("The selected program identity could not be established from the fetched page heading."); }
  const feeCandidates = input.candidates.filter((record) => record.field === "advertised_fee" && input.text.replace(/\s+/g, " ").includes(record.evidence_quote.replace(/\s+/g, " ").trim()));
  const currencies = feeCandidates.map((record) => currencyOf(record.value, record.evidence_quote));
  const foreignPath = input.metadata.redirect_chain.some(explicitForeignRegion) || explicitForeignRegion(input.final);
  let market: SourceAssessment["market"] = foreignPath ? "International" : currencies.includes("INR") ? "India" : currencies.some((currency) => currency !== "Unknown") ? "International" : /\bIndia\b/i.test(primary) ? "India" : "Unclear";
  if (foreignPath) reasons.push("Regional redirect/page mismatch: an international URL was returned for the intended India market. Its claims are excluded from the India comparison.");
  else if (market === "International") reasons.push("The retrieved primary tuition evidence is international currency without a verified INR offer. It is excluded from the India comparison.");
  if (market === "Unclear") reasons.push("India market applicability is not established. Currency-unknown prices cannot be compared as Indian fees.");
  return { market, program, expected_program: expected?.name || "User-selected official program", reasons, block_comparison: foreignPath || market === "International" || program === "Mismatch" || !identity };
}
