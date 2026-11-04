import { type Candidate } from "./contracts";

const make = (field: Candidate["field"], value: string, quote: string, variant = ""): Candidate => ({ field, value, evidence_quote: quote.trim(), qualifier: "", offer_scope: "same_offer", interpretation: false, context: { section: "", variant, cohort: "", price_basis: field === "advertised_fee" ? "total" : "unknown", credential_role: "unknown", relation: "main_program" } });
const money = /(?:₹\s*|INR\s*)(?:\d[\d,]*(?:\.\d+)?)(?:\s*(?:lakhs?|lacs?))?(?:\s*\+\s*GST)?/gi;

/** Recover literal numeric evidence from explicit tuition/duration contexts, never a reference fee. */
export function groundedNumeric(text: string): Candidate[] {
  const result: Candidate[] = [];
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  for (let index = 0; index < paragraphs.length; index++) {
    const part = paragraphs[index];
    const before = paragraphs.slice(Math.max(0, index - 2), index).join("\n\n");
    const next = paragraphs[index + 1] || "";
    const local = `${before}\n\n${part}`;
    if (/^(?:course fee|program(?:me)? duration|duration)\s*:?$/i.test(part) && /^\d+(?:\s*[–-]\s*\d+)?\s*months?\b/i.test(next)) {
      const duration = next.match(/^\d+(?:\s*[–-]\s*\d+)?\s*months?\b/i)![0];
      result.push(make("duration", duration, `${part}\n\n${next}`));
    }
    for (const match of part.matchAll(money)) {
      const left = part.slice(Math.max(0, match.index! - 110), match.index);
      const right = part.slice(match.index! + match[0].length, match.index! + match[0].length + 35);
      const feeContext = /(?:program(?:me)?|course|total|tuition)\s*(?:fee|cost)|fee\s*(?:for|of|is)|cost\s*(?:for|of|is)|total (?:program|programme|course) fee/i.test(part.length < 750 ? part : left) || /^Total(?:ly)?\s+(?:INR|₹)/i.test(part);
      const standaloneFee = part.length < 110 && /^(?:program(?:me)? fee|course fee|tuition fee|fee|total(?:ly)?(?:\s*\([^)]*\))?)\s*:?(?:\s|$)/i.test(before.split("\n\n").at(-1) || "");
      if (!(feeContext || standaloneFee) || /\/\s*month|per\s+month|monthly|\/mo\b/i.test(right) || /(?:save|savings|waiver|discount|application|admission|processing|block|EMI|salary)\s*(?:(?:fee|payment|of|from|at|starts|:)|\s)*$/i.test(left)) continue;
      // Quote a single source paragraph (or the directly adjacent fee label), not stitched passages.
      const quote = part.length <= 650 ? part + (/^(?:\(?\*?\s*)?(?:incl|inclusive|including|no tax|plus gst|\+\s*gst)/i.test(next) ? `\n\n${next}` : "") : part.slice(Math.max(0, match.index! - 110), Math.min(part.length, match.index! + match[0].length + 100));
      const value = match[0].trim();
      if (!result.some((record) => record.field === "advertised_fee" && record.value === value)) result.push(make("advertised_fee", value, quote));
    }
  }
  // Some provider tables render two specialization headings before their two amounts.
  const variantTable = /((?:With\s+(?:a\s+)?)?single\s+speciali[sz]ation)\s+((?:With\s+)?dual\s+speciali[sz]ation)\s+(₹\s*[\d,]+(?:\s*\+\s*GST)?)\s+(₹\s*[\d,]+(?:\s*\+\s*GST)?)/gi;
  for (const match of text.matchAll(variantTable)) {
    result.push(make("advertised_fee", match[3], match[0], match[1]));
    result.push(make("advertised_fee", match[4], match[0], match[2]));
  }
  return result;
}
