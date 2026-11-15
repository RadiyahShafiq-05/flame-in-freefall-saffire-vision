"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Notice from "@/components/Notice";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import type { AskResponse, DocumentsResponse } from "@/types";

const EXAMPLES = [
  "Which experiments burned materials at high oxygen?",
  "How does low pressure change flame spread?",
  "What did the smoke detection experiments test?",
];

function CitationText({ text }: { text: string }) {
  return <>{text.split(/(\[\d+\])/g).map((part, i) => /^\[\d+\]$/.test(part)
    ? <a key={i} href={`#evidence-${part.slice(1, -1)}`} className="link">{part}</a> : part)}</>;
}

export default function Research() {
  const [documents, setDocuments] = useState<DocumentsResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState("6");
  const [result, setResult] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.research.documents().then(setDocuments).catch(e => setError(e.message));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try { setResult(await api.research.ask({ question, top_k: Number(topK) })); }
    catch (err) { setError(err instanceof Error ? err.message : "The question could not be answered."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Research Assistant" subtitle="Ask about NASA combustion research using only the indexed source passages." />
      {documents && !documents.llm_configured && (
        <Notice title="Passages-only mode">No language model is configured; showing matching passages only.</Notice>
      )}
      {error && <Notice tone="warn" title="Research request failed">{error}</Notice>}
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm text-muted">
            <span>Question</span>
            <textarea required minLength={3} maxLength={500} value={question} onChange={e => setQuestion(e.target.value)}
              className="min-h-28 w-full rounded-md border border-edge-strong bg-base px-3 py-2 text-sm text-ink"
              placeholder="What did NASA learn about fire suppression?" />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Try:</span>
            {EXAMPLES.map(q => <button key={q} type="button" className="btn-ghost text-xs" onClick={() => setQuestion(q)}>{q}</button>)}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm text-muted"><span className="block">Top passages</span>
              <input type="number" min={2} max={10} value={topK} onChange={e => setTopK(e.target.value)} className="input" />
            </label>
            <button className="btn" disabled={loading || question.trim().length < 3}>{loading ? "Searching..." : "Ask"}</button>
          </div>
        </form>
      </Card>

      {!result && !loading && <EmptyState title="Ask a research question" body="Answers cite only passages retrieved from the indexed NASA sources." />}
      {result && (
        <div className="space-y-6">
          {/* Extractive mode stitches retrieved passages together; it is not a model-written answer. */}
          <Card title={result.mode === "none" ? "No matching evidence" : result.mode === "extractive" ? "Matching passages" : "Answer"}
            action={result.mode === "llm" && result.model ? <span className="text-xs text-faint">Written by SI ({result.model}) from the evidence below</span> : undefined}>
            {result.answer ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink"><CitationText text={result.answer} /></p>
              : <p className="text-sm text-muted">No answer was supported by the retrieved evidence.</p>}
            {result.llm_error && <p className="mt-3 text-xs text-warn">{result.llm_error}</p>}
          </Card>
          {result.uncertainty.length > 0 && (
            <Notice tone="warn" title="Uncertainty and limits">
              <ul className="list-disc space-y-1 pl-5">{result.uncertainty.map(note => <li key={note}>{note}</li>)}</ul>
            </Notice>
          )}
          {result.related_investigations.length > 0 && (
            <Card title="Related investigations">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {result.related_investigations.map(inv => <li key={inv.accession}>
                  <Link className="link" href={`/investigations/${inv.accession}`}>{inv.acronym || inv.accession}</Link>
                  <span className="ml-2 text-muted">{inv.title}</span>
                </li>)}
              </ul>
            </Card>
          )}
          {result.evidence.length > 0 && (
            <section className="space-y-3" aria-labelledby="evidence-heading">
              <h2 id="evidence-heading" className="text-base font-semibold text-ink">Evidence</h2>
              {result.evidence.map(item => <Card key={item.n} className="scroll-mt-6" title={`[${item.n}] ${item.source_label}`}
                action={item.source_url ? <a className="link text-xs" href={item.source_url} target="_blank" rel="noreferrer">Source</a> : undefined}>
                <span id={`evidence-${item.n}`} className="block scroll-mt-6" />
                <p className="text-xs text-muted">{item.label} · {item.evidence_type}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{item.excerpt}</p>
              </Card>)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
