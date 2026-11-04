"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

const guides = {
  overview: {
    title: "Your first competitor brief",
    intro: "Radar brings official program information into one comparison, with the source behind each finding.",
    steps: ["Choose a program category, then select Research now.", "Watch the provider cards as the pages are retrieved and checked.", "Explore the four comparison tabs. Select any finding to read its supporting quote.", "Review gaps and warnings, then download the brief with Export Markdown."],
    note: "Want to add someone else? New competitor lets you find and choose another official program page.",
  },
  category: {
    title: "Choose the market to compare",
    intro: "The category decides which configured program page is researched for each provider.",
    steps: ["Data Science & Analytics compares the configured technical programs.", "Executive / General Management compares the configured management programs.", "This choice also sets the focus for New competitor searches."],
    note: "Changing category clears the current brief and added competitor. Export anything you want to keep first.",
  },
  research: {
    title: "Run fresh research",
    intro: "Research now retrieves the selected official pages, extracts program facts, and checks their supporting quotes.",
    steps: ["A run can take a few minutes. Progress appears on each provider card.", "Successful providers remain visible if another page is unavailable.", "A new run replaces the current results. Cancel run stops the work; a complete run is needed for export."],
    note: "A live page can contain old cohort details. Check the research timestamp and any Historical warnings.",
  },
  competitor: {
    title: "Add a new competitor",
    intro: "Search by company name, such as Apna Advantage, to find program pages beyond the configured providers.",
    steps: ["Choose the category above, enter the competitor name, and select Find programs.", "Inspect the proposed pages and confirm that the displayed domain belongs to the competitor.", "Choose Add & research on the program you want. Radar researches it alongside the configured providers."],
    note: "Adjacent means the program may differ in level, audience or format—for example, an MBA versus an executive certificate. Compare with that difference in mind.",
  },
  domain: {
    title: "Confirm the official website",
    intro: "Search matches are candidates for you to review. A similar company name does not establish that a website belongs to the company you mean.",
    steps: ["Open the candidate link and check the company branding, institution and program title.", "Confirm the displayed official domain only when it is the site you intend to research.", "Then choose a program. No program is selected automatically."],
    note: "An Adjacent match is available for comparison, but is not presented as an equivalent qualification.",
  },
  coverage: {
    title: "Read provider progress",
    intro: "upGrad is your baseline. The other cards represent competitors included in this run.",
    steps: ["Queued: waiting to start. Retrieving: reading the official page.", "Extracting: identifying facts. Validating: checking quotes against the retrieved text.", "An evidence-record count means individual supported claims were retained. Source unavailable means the page or extraction could not be used—check the issues for the reason."],
    note: "A larger record count does not mean a better program or a more competitive provider.",
  },
  summary: {
    title: "Read the quick factual summary",
    intro: "What the pages say gives you a short view of pricing, program duration, positioning and promotional messaging.",
    steps: ["Select a summary item to open its exact evidence.", "Multiple values stay visible when the page offers competing claims or variants.", "Use the full comparison and issue list before drawing conclusions."],
    note: "This is a factual starting point, not a ranking or strategic recommendation.",
  },
  comparison: {
    title: "Compare providers side by side",
    intro: "Each column is a provider; each row is the same research field across providers.",
    steps: ["Switch between Pricing, Programs, Positioning and Marketing to explore each dimension.", "Select a populated cell—or a Not publicly verified cell—to inspect its evidence or the reason it is missing.", "On a smaller screen, scroll the table horizontally to see the remaining providers."],
    note: "Source-backed means the claim appears on the official page. It is not independent confirmation that the claim is true.",
  },
  Pricing: {
    title: "Understand the Pricing tab",
    intro: "Compare advertised fees, stated taxes, extra charges, discounts and financing.",
    steps: ["Read the currency and tax wording before comparing amounts.", "Monthly EMI is financing, not the total program fee.", "Open the evidence to check variants, cohort restrictions and competing fee values."],
    note: "A missing price is Not publicly verified—not free, zero, or a guessed amount.",
  },
  Programs: {
    title: "Understand the Programs tab",
    intro: "Compare program titles, durations, eligibility, audience, curriculum, delivery format, credentials and advertised support.",
    steps: ["Check both the credential type and issuing institution; similar course titles may describe different qualifications.", "Multiple duration or credential claims stay visible for review.", "Historical cohort dates do not establish current admissions."],
    note: "An available landing page does not prove a cohort is currently open.",
  },
  Positioning: {
    title: "Understand the Positioning tab",
    intro: "See who the program says it is for, what it promises, and which differentiators it explicitly claims.",
    steps: ["Open a claim to read the words used on the official page.", "Interpretation labels identify synthesized positioning rather than a literal factual claim."],
    note: "These are the provider’s messages, not independent assessments of its strengths or outcomes.",
  },
  Marketing: {
    title: "Understand the Marketing tab",
    intro: "This section covers promotional headlines, calls to action, offers and claims on the official program landing page.",
    steps: ["Compare the language and offers shown on each page.", "Select a claim to inspect its context and supporting extract."],
    note: "This is not an ad-library audit. Active ad counts, spend and advertising performance are not established by these pages.",
  },
  issues: {
    title: "Review gaps and warnings",
    intro: "This section keeps uncertainty visible instead of filling it with guesses.",
    steps: ["Review shows conflicting values, older cohorts, different variants, unavailable sources and rejected extractions.", "Missing shows fields with no validated public evidence.", "Conflicting flags incompatible claims for the same apparent offer. Needs review means variants or context may explain the difference. Historical refers to an older cohort."],
    note: "Not publicly verified means no supported value was found. An issue-free run is not an accuracy guarantee.",
  },
  evidence: {
    title: "Follow a finding back to its source",
    intro: "The evidence drawer shows the claim, its status, an exact supporting extract, the official page URL and the retrieval timestamp.",
    steps: ["Read the quote and any qualifier together.", "Use Open official source to inspect the live page yourself.", "If several candidates exist, review each evidence card rather than choosing one without context."],
    note: "A matching quote establishes where a claim came from. It does not independently verify the claim.",
  },
  sources: {
    title: "Inspect the source registry",
    intro: "Expand this section to see the official URLs used for the selected category and any added competitor.",
    steps: ["Open a source link to visit the official page.", "After research, check retrieval and extraction status, attempts and timestamps.", "A returned URL different from the configured URL is disclosed so you can review redirects."],
    note: "An unavailable source stays listed; Radar does not silently substitute a different program.",
  },
  export: {
    title: "Keep a copy of your brief",
    intro: "Export Markdown downloads a readable report with the comparison, summary, quotes, links, statuses and research timestamps.",
    steps: ["The button becomes available after a run finishes, including runs with clearly reported provider failures.", "Download JSON in the footer gives you the structured research records.", "Export before changing category, rerunning research or refreshing the page if you want to keep these results."],
    note: "Your browser holds the current brief. Radar does not keep a research history.",
  },
  method: {
    title: "Understand the research method",
    intro: "Radar retrieves public official pages, extracts facts from their text, and checks the supporting quotes before displaying findings.",
    steps: ["The method section explains how retrieval, extraction and validation fit together.", "Read its limitations alongside the gaps and warnings in your results."],
    note: "Public pages can be incomplete, stale or contradictory. Quote checking proves provenance, not real-world accuracy.",
  },
} as const;

type Topic = keyof typeof guides;
const HelpContext = createContext<{ open: (topic: Topic) => void; active: Topic | null; id: string } | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Topic | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const guide = active ? guides[active] : null;
  useEffect(() => { if (active && !dialog.current?.open) dialog.current?.showModal(); }, [active]);
  function close() { dialog.current?.close(); setActive(null); }

  return <HelpContext.Provider value={{ open: setActive, active, id }}>
    {children}
    <dialog id={id} ref={dialog} className="help-dialog" aria-labelledby={`${id}-title`} onCancel={() => setActive(null)} onClose={() => setActive(null)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="help-dialog-content">
        <div className="help-dialog-top"><span className="help-kicker"><span aria-hidden="true">i</span>RADAR GUIDE</span><button type="button" onClick={close} aria-label="Close guide"><X size={19} /></button></div>
        <h2 id={`${id}-title`}>{guide?.title}</h2>
        <p className="help-intro">{guide?.intro}</p>
        <ol>{guide?.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p className="help-note">{guide?.note}</p>
        <button className="primary-button help-done" type="button" onClick={close}>Got it</button>
      </div>
    </dialog>
  </HelpContext.Provider>;
}

export function InfoButton({ topic }: { topic: Topic }) {
  const help = useContext(HelpContext);
  if (!help) return null;
  return <button type="button" className="info-button" aria-label={`Help: ${guides[topic].title}`} aria-haspopup="dialog" aria-controls={help.id} aria-expanded={help.active === topic} onClick={(event) => { event.preventDefault(); event.stopPropagation(); help.open(topic); }}><span aria-hidden="true">i</span></button>;
}
