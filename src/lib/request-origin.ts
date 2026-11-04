/** Compare against the browser-facing Host header; Next may use an internal request URL. */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    return ["http:", "https:"].includes(source.protocol) && source.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}
