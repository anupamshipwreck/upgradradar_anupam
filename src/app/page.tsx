"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, CircleAlert, Clock3, FileText, Layers3, LoaderCircle, Radar, RefreshCw, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { categories, companies, dimensions, fields, fieldNames, fieldStatus, comparisonRecords, type Brief, type Category, type Company, type Dimension, type EvidenceRecord, type DiscoveryCandidate, type Field, type Phase, type ProviderResult, type ResearchEvent, type Status } from "@/lib/contracts";
import { registry } from "@/lib/registry";
import { toMarkdown } from "@/lib/export";
import CompetitorSearch from "./competitor-search";
import { InfoButton } from "./radar-help";

type Config = { ready: boolean; missing: string[]; model: string; retrieval: string };
const initials: Record<Company, string> = { upGrad: "u", "Great Learning": "GL", Simplilearn: "s", Emeritus: "E" };
const date = (value: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
function Badge({ status }: { status: Status }) { return <span className={`badge ${status === "Source-backed" ? "good" : status === "Conflicting" || status === "Historical" || status === "Needs review" ? "warn" : "neutral"}`}><span />{status}</span>; }

export default function Home() {
  const [category, setCategory] = useState<Category>(categories[0]);
  const [customSource, setCustomSource] = useState<DiscoveryCandidate | null>(null);
  const visibleCompanies = customSource ? [...companies.filter((company) => company.toLowerCase() !== customSource.company.toLowerCase()), customSource.company] : [...companies];
  const visibleSources = customSource ? [...registry[category].filter((source) => source.company.toLowerCase() !== customSource.company.toLowerCase()), { company: customSource.company, url: customSource.url }] : registry[category];
  const [dimension, setDimension] = useState<Dimension>("Pricing");
  const [providers, setProviders] = useState<ProviderResult[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [phases, setPhases] = useState<Partial<Record<Company, Phase>>>({});
  const [running, setRunning] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<{ company: Company; field: Field } | null>(null);
  const [issueFilter, setIssueFilter] = useState<"Review" | "Missing">("Review");
  const [showMethod, setShowMethod] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const abort = useRef<AbortController | null>(null);
  const sources = useRef<HTMLElement>(null);
  const issuesRef = useRef<HTMLElement>(null);

  async function checkConfig() {
    try { const response = await fetch("/api/research", { cache: "no-store" }); if (!response.ok) throw new Error(); setConfig(await response.json()); }
    catch { setError("Could not check the research service. Refresh the page to try again."); }
  }
  useEffect(() => { void checkConfig(); return () => abort.current?.abort(); }, []);
  useEffect(() => { if (evidence && !dialog.current?.open) dialog.current?.showModal(); }, [evidence]);
  useEffect(() => { if (showMethod) document.getElementById("research-method")?.scrollIntoView({ behavior: "smooth" }); }, [showMethod]);

  const records = providers.flatMap((p) => p.records);
  const issues = providers.flatMap((p) => p.issues);
  const review = issues.filter((i) => i.kind !== "Missing");
  const completed = Object.values(phases).filter((p) => p === "Complete" || p === "Failed").length;
  const fetched = providers.filter((p) => p.retrieval_status === "Retrieved").length;

  function applyEvent(event: ResearchEvent) {
    if (event.type === "progress") setPhases((old) => ({ ...old, [event.company]: event.phase }));
    if (event.type === "provider") setProviders((old) => [...old.filter((p) => p.company !== event.provider.company), event.provider]);
    if (event.type === "complete") { setBrief(event.brief); setProviders(event.brief.providers); }
    if (event.type === "error") setError(event.message);
  }

  async function research(selection?: DiscoveryCandidate) {
    if (running) return;
    const selected = selection ?? customSource;
    const targetCompanies = selected ? [...companies.filter((company) => company.toLowerCase() !== selected.company.toLowerCase()), selected.company] : [...companies];
    setRunning(true); setError(""); setBrief(null); setProviders([]); setPhases(Object.fromEntries(targetCompanies.map((c) => [c, "Queued"])));
    abort.current = new AbortController();
    let finished = false;
    let started = false;
    try {
      const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, ...(selected ? { selectionToken: selected.token } : {}) }), signal: abort.current.signal });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || "Research could not start."); }
      if (!response.body) throw new Error("The research stream is unavailable.");
      started = true;
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() || "";
        if (done && buffer.trim()) { lines.push(buffer); buffer = ""; }
        for (const line of lines) if (line.trim()) { const event = JSON.parse(line) as ResearchEvent; applyEvent(event); if (event.type === "complete") finished = true; }
        if (done) break;
      }
      if (!finished) throw new Error("The run ended before all providers completed. Available results are shown; rerun to create an export.");
    } catch (err) { if (!started) setPhases({}); setError(err instanceof Error && err.name === "AbortError" ? "Research cancelled. Completed results remain visible; run again for a complete brief." : err instanceof Error ? err.message : "Research failed. Please retry."); }
    finally { setRunning(false); setPhases((old) => Object.fromEntries(Object.entries(old).map(([company, phase]) => [company, phase === "Complete" || phase === "Failed" ? phase : "Failed"]))); }
  }

  function download(format: "md" | "json") {
    if (!brief) return;
    const blob = new Blob([format === "md" ? toMarkdown(brief) : JSON.stringify(brief, null, 2)], { type: format === "md" ? "text/markdown;charset=utf-8" : "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url;
    link.download = `competitor-brief-${category === categories[0] ? "data-science" : "management"}-${brief.completed_at.slice(0, 10)}.${format}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function closeEvidence() { dialog.current?.close(); setEvidence(null); }
  const selectedRecords: EvidenceRecord[] = evidence ? records.filter((r) => r.company === evidence.company && r.field === evidence.field) : [];
  const selectedProvider = providers.find((p) => p.company === evidence?.company);

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#" className="brand" aria-label="upGrad Radar home"><span className="brand-icon"><Layers3 size={21} /></span>upGrad<span className="brand-word">radar</span></a>
      <div className="workspace-label">UPGRAD / RESEARCH WORKSPACE</div>
      <nav aria-label="Workspace"><a className="nav-item active" href="#brief"><ScanLine size={18} />Competitor brief<ArrowUpRight size={14} /></a><button className="nav-item" onClick={() => sources.current?.scrollIntoView({ behavior: "smooth" })}><BookOpen size={18} />Source registry<span className="nav-count">08</span></button><button className="nav-item" onClick={() => setShowMethod((v) => !v)}><ShieldCheck size={18} />Research method</button></nav>
      <div className="sidebar-note"><span className="tiny-label"><span className="lime-dot" /> EVIDENCE FIRST</span><h3>Good research leaves a trail.</h3><p>Every finding, connected to the words behind it.</p><div className="note-lines"><span /><span /><span /></div></div>
      <div className="sidebar-bottom"><span className="avatar">u</span><div><strong>upGrad</strong><small>Competitive intelligence</small></div><span className="v-label">V1.0</span></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div><span className="breadcrumb">upGrad Radar</span><span className="slash">/</span><span>Competitor research</span></div><span className="topbar-label"><span className="live-dot" />LIVE-SOURCE RESEARCH</span></header>
      <main id="brief">
        <div className="page-heading"><div><div className="eyebrow">THE COMPETITIVE LANDSCAPE, IN FOCUS</div><div className="title-with-help"><h1>Competitor brief<span>.</span></h1><InfoButton topic="overview" /></div><p>Your market, in focus. Current program facts. Evidence you can inspect.</p></div><div className="export-actions"><button className="export-button" disabled={!brief || running} onClick={() => download("md")}><ArrowDownToLine size={16} />Export Markdown</button><InfoButton topic="export" /></div></div>

        <section className="research-controls" aria-label="Research controls"><div className="category-control"><div className="control-label"><label htmlFor="category">PROGRAM CATEGORY</label><InfoButton topic="category" /></div><div className="select-wrap"><select id="category" value={category} disabled={running} onChange={(event) => { setCategory(event.target.value as Category); setCustomSource(null); setBrief(null); setProviders([]); setPhases({}); setError(""); }}><option>{categories[0]}</option><option>{categories[1]}</option></select><ChevronDown size={16} /></div></div><div className="research-control-note"><ShieldCheck size={17} /><span>Official pages only<br /><strong>A fresh fetch on every run</strong></span></div><div className="research-action"><button className="primary-button" onClick={() => void research()} disabled={running || !config?.ready}>{running ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{running ? "Researching…" : "Research now"}{!running && <ArrowRight size={16} />}</button><InfoButton topic="research" /></div></section>

        {config && !config.ready && <div className="setup-banner"><CircleAlert size={19} /><div><strong>One step before your first research run</strong><p>Add <code>{config.missing.join(" and ")}</code> to <code>.env.local</code>, then restart the dev server. Gemini uses the CookMyHook setup. No research findings have been generated.</p></div><button onClick={() => void checkConfig()} aria-label="Recheck configuration"><RefreshCw size={16} /></button></div>}
        {error && <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

        <CompetitorSearch key={category} category={category} disabled={running || !config?.ready} selected={customSource} onSelect={(candidate) => { setCustomSource(candidate); void research(candidate); }} onClear={() => { setCustomSource(null); setBrief(null); setProviders([]); setPhases({}); }} />

        <div className="section-line"><div className="section-title">Research coverage<span className="quiet-count">{visibleCompanies.length} PROVIDERS</span><InfoButton topic="coverage" /></div><span className="subtle">{running ? `${completed} of ${visibleCompanies.length} providers complete` : brief ? `Researched ${date(brief.completed_at)} IST` : "Ready when you are"}</span></div>
        <section className="provider-grid" aria-label="Provider research status" aria-live="polite">{visibleCompanies.map((company, index) => {
          const provider = providers.find((p) => p.company === company); const phase = phases[company]; const active = running && phase && !["Queued", "Complete", "Failed"].includes(phase);
          return <article className={`provider-card ${index === 0 ? "baseline" : ""}`} key={company}><div className="provider-top"><span className={`provider-logo logo-${index}`}>{initials[company] || company.slice(0, 2).toUpperCase()}</span><span className="provider-type">{index === 0 ? "YOUR BASELINE" : `COMPETITOR 0${index}`}</span></div><h3>{company}</h3><div className={`provider-status ${phase === "Complete" ? "success-text" : phase === "Failed" ? "warning-text" : ""}`}>{active ? <LoaderCircle size={13} className="spin" /> : phase === "Complete" ? <CheckCheck size={14} /> : phase === "Failed" ? <CircleAlert size={13} /> : <span className="status-dot" />}{phase === "Complete" ? `${provider?.records.length ?? 0} evidence records` : phase === "Failed" ? "Source unavailable · review" : phase || "Awaiting research"}</div></article>;
        })}</section>

        {running && <div className="run-progress" role="status"><div><span style={{ width: `${completed / 4 * 100}%` }} /></div><p>Retrieving official pages and checking every extract. This can take a few minutes.<button onClick={() => abort.current?.abort()}>Cancel run</button></p></div>}

        {brief && <section className="factual-summary"><div className="summary-heading"><FileText size={17} /><strong>What the pages say</strong><InfoButton topic="summary" /><span>EVERY SUMMARY ITEM LINKS TO EVIDENCE</span></div><p>{fetched} of {visibleCompanies.length} official pages retrieved. {records.length} evidence records located; {review.length} issues need attention.</p><div className="summary-facts">{visibleCompanies.map((company) => { const p = providers.find((v) => v.company === company)!; return <div key={company}><strong>{company}</strong>{(["advertised_fee", "duration", "promise", "headline"] as const).map((field) => { const matched = comparisonRecords(p, field); return <button key={field} onClick={() => setEvidence({ company, field })}><span>{{ advertised_fee: "PRICING", duration: "PROGRAM", promise: "POSITIONING", headline: "MARKETING" }[field]}</span>{matched.length ? matched.map((r) => r.value).join(" / ") : fieldStatus(p, field)}<ArrowUpRight size={12} /></button>; })}</div>; })}</div></section>}

        <section className="comparison-section" aria-label="Provider comparison"><div className="comparison-header"><div><h2 className="heading-with-help">Side by side<InfoButton topic="comparison" /></h2><p>Comparable facts, with the context intact.</p></div><div className="comparison-tools"><span className="source-hint"><ShieldCheck size={14} />{records.length ? `${records.length} linked evidence records` : "Source-linked by design"}</span><span className="tab-guide">{dimension}<InfoButton topic={dimension} /></span></div></div><div className="tabs" role="tablist" aria-label="Research dimensions">{dimensions.map((item, index) => <button key={item} id={`tab-${item}`} role="tab" aria-selected={dimension === item} aria-controls="comparison-panel" className={dimension === item ? "selected" : ""} onClick={() => setDimension(item)} onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? 3 : (index + (event.key === "ArrowRight" ? 1 : -1) + 4) % 4; setDimension(dimensions[nextIndex]); document.getElementById(`tab-${dimensions[nextIndex]}`)?.focus(); } }} tabIndex={dimension === item ? 0 : -1}><span className="tab-number">0{index + 1}</span>{item}</button>)}</div>
          {dimension === "Marketing" && <div className="marketing-note">Channel: official program landing page. Ad activity, spend and performance are not established by these pages.</div>}
          <div className="table-scroll" id="comparison-panel" role="tabpanel" aria-labelledby={`tab-${dimension}`}><table style={{ minWidth: `${180 * (visibleCompanies.length + 1)}px` }}><thead><tr><th scope="col">{dimension.toUpperCase()} AT A GLANCE</th>{visibleCompanies.map((company, index) => <th scope="col" key={company}><span className={`table-dot company-${index}`} />{company}{index === 0 && <small>BASELINE</small>}</th>)}</tr></thead><tbody>{fieldNames.filter((f) => fields[f].dimension === dimension).map((field) => <tr key={field}><th scope="row">{fields[field].label}</th>{visibleCompanies.map((company) => {
              const provider = providers.find((p) => p.company === company); const values = provider ? comparisonRecords(provider, field) : [];
              return <td key={company}>{provider ? <button className="cell-button" onClick={() => setEvidence({ company, field })}>{values.length ? <>{values.map((record) => <div className="cell-record" key={record.id}>{record.interpretation && <span className="interpretation">INTERPRETATION</span>}<span className="cell-value">{record.value}</span>{record.qualifier && <span className="cell-qualifier">{record.qualifier}</span>}<Badge status={record.status} /></div>)}<span className="evidence-link">View evidence<ArrowUpRight size={12} /></span></> : <span className="missing-value">{fieldStatus(provider, field)}<ArrowUpRight size={12} /></span>}</button> : <div className="pending-cell"><span className={running ? "skeleton-line" : "placeholder-line"} /><small>{running ? "Research in progress" : "Awaiting research"}</small></div>}</td>;
            })}</tr>)}</tbody></table></div>
          {!providers.length && !running && <div className="empty-message"><span><Radar size={21} /></span><div><strong>Your next brief starts here.</strong><p>Select a category and run research to fill this comparison with current, source-linked findings.</p></div></div>}
          <div className="table-footer"><span><ShieldCheck size={13} />Source-backed means found on the page, not independently verified.</span><span>{visibleCompanies.length} providers · {fieldNames.filter((f) => fields[f].dimension === dimension).length} fields</span></div>
        </section>

        <section className="issues-section" ref={issuesRef}><div className="section-line"><div><h2>Gaps & things to check<span className="count-badge">{issues.length}</span><InfoButton topic="issues" /></h2><p>Conflicting claims, older cohorts, and information the pages don’t establish.</p></div>{providers.length > 0 && <div className="issue-toggle"><button className={issueFilter === "Review" ? "chosen" : ""} onClick={() => setIssueFilter("Review")}>Review {review.length}</button><button className={issueFilter === "Missing" ? "chosen" : ""} onClick={() => setIssueFilter("Missing")}>Missing {issues.filter((i) => i.kind === "Missing").length}</button></div>}</div>{!providers.length ? <div className="issues-empty"><CircleAlert size={19} /><p>Issues will appear here after research. Missing information stays visible.</p><span>NO RUN YET</span></div> : <div className="issue-list">{issues.filter((i) => issueFilter === "Missing" ? i.kind === "Missing" : i.kind !== "Missing").map((issue, index) => <div className="issue-row" key={`${issue.company}-${index}`}><CircleAlert size={16} /><div><strong>{issue.company}<span>{issue.kind}</span></strong><p>{issue.message}</p></div>{issue.field && <button onClick={() => { setEvidence({ company: issue.company, field: issue.field! }); }} aria-label={`View ${issue.company} ${issue.field} evidence`}><ArrowUpRight size={17} /></button>}</div>)}{!issues.some((i) => issueFilter === "Missing" ? i.kind === "Missing" : i.kind !== "Missing") && <div className="issues-empty"><Check size={18} /><p>No {issueFilter.toLowerCase()} issues detected in the validated records. This is not an accuracy guarantee.</p></div>}</div>}</section>

        <section className="sources-section" ref={sources}><details><summary><div><BookOpen size={17} /><strong>Official source registry</strong><InfoButton topic="sources" /><span>{visibleSources.length} pages for this category</span></div><ChevronDown size={17} /></summary><div className="source-list">{visibleSources.map((source) => { const result = providers.find((p) => p.company === source.company); return <div key={source.company}><strong>{source.company}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url}<ArrowUpRight size={13} /></a>{result && <p>{result.retrieval_status} via {result.retrieval_method} · Extraction {result.extraction_status} · {result.attempts} retrieval attempt(s){result.fetched_at ? ` · ${date(result.fetched_at)} IST` : ""}{result.truncated ? " · Text truncated" : ""}{result.source_url !== result.requested_url && <><br />Returned URL: <a href={result.source_url} target="_blank" rel="noreferrer">{result.source_url}</a></>}{result.errors.map((e) => <span className="source-error" key={e}>{e}</span>)}</p>}</div>; })}</div></details></section>

        {showMethod && <section className="method-section" id="research-method"><div><h2 className="heading-with-help">How this brief is researched<InfoButton topic="method" /></h2><button onClick={() => setShowMethod(false)} aria-label="Close research method"><X size={18} /></button></div><ol><li>Fetch the four configured official pages directly, two at a time. Firecrawl is optional. Retry transient retrieval failures once.</li><li>Ask Gemini to extract structured facts from each page separately, without general knowledge.</li><li>Locate evidence quotes and literal factual values in the fetched text. Reject unsupported extractions.</li><li>Preserve competing values, flag older cohort dates, and render the brief from validated records.</li></ol><p>Pages may be blocked, incomplete, stale or self-contradictory. A live page does not establish open admissions. On-page promotion is not a comprehensive marketing audit. No independent truth verification or recommendations are provided.</p></section>}

        <footer><span className="footer-brand"><Layers3 size={14} />upGrad Radar<span> / </span>Built for a clearer view.</span><div>{brief && <button onClick={() => download("json")}>Download JSON<ArrowDownToLine size={12} /></button>}<button onClick={() => setShowMethod((v) => !v)}>Method & limitations<ArrowUpRight size={12} /></button></div></footer>
      </main>
    </div>

    <dialog ref={dialog} className="evidence-dialog" onCancel={() => setEvidence(null)} onClick={(event) => { if (event.target === event.currentTarget) closeEvidence(); }} aria-labelledby="evidence-heading"><div className="dialog-inner"><div className="dialog-top"><span className="eyebrow">FOLLOW THE EVIDENCE</span><button onClick={closeEvidence} aria-label="Close evidence"><X size={20} /></button></div><h2 id="evidence-heading">{evidence?.company}</h2><p className="dialog-field">{evidence && fields[evidence.field].label}<InfoButton topic="evidence" /></p>{selectedRecords.length ? selectedRecords.map((record) => <article className="evidence-card" key={record.id}><Badge status={record.status} />{record.comparison_eligible === false && <p className="evidence-qualifier"><strong>Excluded from India comparison</strong>{record.exclusion_reason}</p>}{record.interpretation && <span className="interpretation">INTERPRETATION</span>}<h3>{record.value}</h3><span className="tiny-label">VERBATIM SOURCE EXTRACT</span><blockquote>{record.evidence_quote}</blockquote>{record.qualifier && <p className="evidence-qualifier"><strong>Qualifier</strong>{record.qualifier}</p>}<a href={record.source_url} target="_blank" rel="noreferrer">Open official source<ArrowUpRight size={15} /></a><small><Clock3 size={12} />Fetched {date(record.fetched_at)} IST</small><p className="source-url">{record.source_url}</p></article>) : <div className="evidence-unavailable"><CircleAlert size={25} /><h3>{selectedProvider && evidence ? fieldStatus(selectedProvider, evidence.field) : "Not publicly verified"}</h3><p>{selectedProvider?.errors.join(" ") || "No validated supporting extract was found for this field in the retrieved page. No value has been inferred."}</p>{selectedProvider && <a href={selectedProvider.source_url} target="_blank" rel="noreferrer">Inspect configured source<ArrowUpRight size={14} /></a>}</div>}<div className="dialog-footnote"><ShieldCheck size={16} /><p>Quote matching establishes provenance in fetched text. It does not independently verify the claim.</p></div></div></dialog>
  </div>;
}
