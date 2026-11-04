import { z } from "zod";
import { categories } from "@/lib/contracts";
import { discoverPrograms } from "@/lib/discovery";
import { getConfig, ProviderError } from "@/lib/providers";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";
export const maxDuration = 120;
let running = 0;
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Start search from this app." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 2000) return Response.json({ error: "Request too large." }, { status: 413 });
  let input;
  try { input = z.object({ company: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N} .&'’()+-]+$/u), category: z.enum(categories) }).strict().parse(await request.json()); }
  catch { return Response.json({ error: "Enter a competitor name and choose a category." }, { status: 400 }); }
  const config = getConfig();
  if (!config.geminiKey) return Response.json({ error: "Gemini is not configured." }, { status: 503 });
  if (running >= 2) return Response.json({ error: "Search is busy. Please try again shortly." }, { status: 429 });
  running++;
  try { return Response.json(await discoverPrograms(input.company, input.category, config, AbortSignal.any([request.signal, AbortSignal.timeout(110000)]))); }
  catch (error) { return Response.json({ error: error instanceof ProviderError ? error.message : "Competitor search could not validate its results. Try again with the full company name." }, { status: 502 }); }
  finally { running--; }
}
