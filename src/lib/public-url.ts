import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isPublicAddress(address: string): boolean {
  if (address.includes(":")) {
    const ip = address.toLowerCase();
    if (ip.startsWith("::ffff:")) return isPublicAddress(ip.slice(7));
    return !/^(::|fc|fd|fe[89ab]|ff)/i.test(ip) && isIP(ip) === 6;
  }
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b));
}

export function parsePublicHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || isIP(url.hostname.replace(/^\[|\]$/g, "")) || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) throw new Error("Choose a public HTTPS page on the competitor's official domain.");
  return url;
}

export async function assertPublicHttpsUrl(value: string) {
  const url = parsePublicHttpsUrl(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("The candidate domain does not resolve exclusively to public internet addresses.");
  return url;
}
