import { z } from "zod";
import { categories } from "@/lib/contracts";
import { getConfig, missingConfig } from "@/lib/providers";
import { runResearch } from "@/lib/research";
import { verifySelection } from "@/lib/discovery";
import { assertPublicHttpsUrl } from "@/lib/public-url";
import { registry } from "@/lib/registry";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
let running = 0;

export async function GET() {
  return Response.json({ ready: missingConfig().length === 0, missing: missingConfig(), provider: "Gemini", model: getConfig().model, retrieval: getConfig().firecrawlKey ? "Firecrawl" : "Direct official pages" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Research must be started from this app." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 8000) return Response.json({ error: "Request too large." }, { status: 413 });
  let category, selectionToken;
  try { ({ category, selectionToken } = z.object({ category: z.enum(categories), selectionToken: z.string().max(6000).optional() }).strict().parse(await request.json())); }
  catch { return Response.json({ error: "Choose one of the two configured categories." }, { status: 400 }); }
  const config = getConfig();
  const missing = missingConfig(config);
  if (missing.length) return Response.json({ error: `Research is not configured. Add ${missing.join(" and ")} to the server environment.`, missing }, { status: 503 });
  let selectedSources: { company: string; url: string; comparison_note?: string }[] = registry[category];
  if (selectionToken) {
    try {
      const selected = verifySelection(selectionToken, category, config.geminiKey);
      await assertPublicHttpsUrl(selected.url);
      selectedSources = [...selectedSources.filter((source) => source.company.toLowerCase() !== selected.company.toLowerCase()), { company: selected.company, url: selected.url, comparison_note: selected.match === "Adjacent" ? "Adjacent program selected: compare its credential level, format, audience and scope before interpreting its fees or duration against executive/general-management certificates." : undefined }];
    } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid competitor selection." }, { status: 400 }); }
  }
  if (running >= 2) return Response.json({ error: "Research is already running. Please try again after the current run finishes." }, { status: 429 });
  running++;
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(260000)]);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(streamController) {
      let closed = false;
      const send = (event: unknown) => { if (!closed && !controller.signal.aborted) { try { streamController.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { closed = true; controller.abort(); } } };
      try { await runResearch(category, config, signal, send, fetch, selectedSources); }
      catch { send({ type: "error", message: "Research could not finish. Completed provider results remain available; rerun to create a complete export." }); }
      finally { running--; if (!closed && !controller.signal.aborted) { closed = true; streamController.close(); } }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
