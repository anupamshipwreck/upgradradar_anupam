"use client";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, CircleAlert, Globe2, LoaderCircle, Plus, Search, X } from "lucide-react";
import { InfoButton } from "./radar-help";
import { type Category, type DiscoveryCandidate, type DiscoveryResult } from "@/lib/contracts";

export default function CompetitorSearch({ category, disabled, selected, onSelect, onClear }: {
  category: Category; disabled: boolean; selected: DiscoveryCandidate | null;
  onSelect: (candidate: DiscoveryCandidate) => void; onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [company, setCompany] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  async function search(event: React.FormEvent) {
    event.preventDefault(); if (searching || disabled) return;
    setSearching(true); setError(""); setResult(null); setConfirmed(false);
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: company.trim(), category }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Search failed.");
      setResult(payload);
    } catch (error) { setError(error instanceof Error ? error.message : "Search failed. Try again."); }
    finally { setSearching(false); }
  }

  return <section className={`competitor-search ${expanded ? "expanded" : ""}`} aria-label="Find a new competitor">
    <div className="discovery-heading"><div><span className="discovery-icon"><Globe2 size={18} /></span><div><h2 className="heading-with-help">Go beyond the usual competitors.<InfoButton topic="competitor" /></h2><p>Find another provider and bring its official program into your brief.</p></div></div><button className="discovery-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} disabled={disabled}><Plus size={16} />{expanded ? "Close search" : "New competitor"}</button></div>
    {selected && <div className="selected-competitor"><Check size={15} /><span><strong>{selected.company}</strong> added · {selected.title}</span><button onClick={onClear} disabled={disabled} aria-label="Remove added competitor"><X size={15} /></button></div>}
    {expanded && <div className="discovery-body"><form onSubmit={(event) => void search(event)}><label htmlFor="new-competitor">COMPETITOR NAME</label><div className="discovery-input"><Search size={17} /><input id="new-competitor" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Try Apna Advantage, Scaler, Coursera…" minLength={2} maxLength={80} required disabled={searching || disabled} /><button className="primary-button" disabled={searching || disabled || company.trim().length < 2} type="submit">{searching ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}{searching ? "Searching…" : "Find programs"}</button></div><p className="discovery-focus">Looking for: <strong>{category}</strong>. Change the category above to search another area.</p></form>
      {searching && <p className="discovery-loading" role="status">Searching the web for official program pages. You’ll choose the match before any research runs.</p>}
      {error && <div className="error-banner" role="alert"><CircleAlert size={16} />{error}</div>}
      {result && <div className="discovery-results"><div className="discovery-result-intro"><span className="tiny-label">{result.candidates.length} PROGRAM MATCH{result.candidates.length !== 1 ? "ES" : ""}</span><p>{result.message}</p></div>{result.candidates.length > 0 && <div className="domain-confirmation-wrap"><label className="domain-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={disabled} /><span>I confirm <strong>{result.official_host}</strong> is the competitor’s official website. I’ll select the program to compare.</span></label><InfoButton topic="domain" /></div>}
        <div className="candidate-grid">{result.candidates.map((candidate) => <article className="candidate-card" key={candidate.url}><span className={`match-badge ${candidate.match === "Adjacent" ? "adjacent" : ""}`}>{candidate.match === "Adjacent" ? "ADJACENT PROGRAM · CHECK FIT" : "CATEGORY MATCH"}</span><h3>{candidate.title}</h3><p>{candidate.reason}</p><a href={candidate.url} target="_blank" rel="noreferrer">{candidate.url}<ArrowUpRight size={13} /></a><button disabled={!confirmed || disabled} onClick={() => { onSelect(candidate); setExpanded(false); }}><Plus size={15} />Add & research<ArrowRight size={14} /></button></article>)}</div>
        {result.sources.length > 0 && <details className="discovery-sources"><summary>Search sources · {result.sources.length}</summary><div>{result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={12} /></a>)}</div></details>}
        {result.search_suggestions && <iframe className="search-suggestions" title="Google search suggestions" srcDoc={result.search_suggestions} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />}
      </div>}
    </div>}
  </section>;
}
