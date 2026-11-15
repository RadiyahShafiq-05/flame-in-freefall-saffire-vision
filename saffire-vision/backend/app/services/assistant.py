"""Evidence-grounded research assistant.

Retrieval (knowledge.py) finds passages from NASA sources. If a language model is configured through environment
variables, it is asked to answer ONLY from those passages and its output is checked sentence by sentence: every sentence
must cite a retrieved passage and every number must appear in the passage it cites. If no model is configured, or the
model fails the checks, the answer is the matching passages themselves and says so. Nothing is written from memory.
"""
import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable, Optional

from ..schemas.research import (AskResponse, DocumentsResponse, EvidenceItem, RelatedInvestigation, SourceInfo,
                                SummaryResponse, SummarySection)
from . import catalog as C
from . import knowledge as K

log = logging.getLogger("assistant")
DEFAULT_MODEL = "gemini-2.5-flash"
DISCLAIMERS = [
    "Answers use only the indexed NASA sources listed under /api/research/documents. Publication abstracts and full papers are not indexed.",
    "PSI records describe what each investigation set out to do and how; they do not list results. Reported results come only from the 2015 NASA Researcher's Guide entries.",
    "Anything labelled interpretation is a language model's reading of the passages, not a NASA finding.",
]
NOT_INDEXED = ["Abstracts and full text of the publications listed on PSI records (titles only)",
               "Raw measurement files, images and videos from the experiments",
               "Results of SAFFIRE-I/II/III, BASS-II, SAME-R and CFI-G beyond what their PSI records state (the 2015 guide predates them)"]
GUIDE_COVERED = {"PSI-26", "PSI-69", "PSI-68", "PSI-107", "PSI-106", "PSI-102", "PSI-47", "PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23"}


def llm_config() -> tuple[Optional[str], str]:
    key = (os.getenv("GEMINI_API_KEY") or "").strip() or None
    return key, (os.getenv("ASSISTANT_MODEL") or DEFAULT_MODEL).strip()


def _gemini_call(system: str, user: str, api_key: str, model: str, timeout: int = 40) -> str:
    body = json.dumps({
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"maxOutputTokens": 700},
    }).encode()
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(model, safe='')}:generateContent"
    req = urllib.request.Request(f"{endpoint}?key={urllib.parse.quote(api_key, safe='')}", data=body, method="POST",
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read())
    return "".join(
        part.get("text", "")
        for candidate in data.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
        if isinstance(part.get("text"), str)
    )


llm_call: Callable[[str, str, str, str], str] = _gemini_call  # replaced in tests


SYSTEM_PROMPT = """You answer questions about NASA microgravity combustion research for a fire-safety dashboard.
Use ONLY the numbered excerpts you are given. Reply with one JSON object and nothing else, with these keys:
"documented": 1 to 5 sentences stating what the excerpts say. EVERY sentence must end with citation markers such as [1] or [2][3]. Do not use any number, unit, name or claim that is not in the cited excerpt.
"interpretation": optional, at most 2 sentences, your own reading for a fire-safety audience. No new facts or numbers.
"uncertainty": a list of short strings naming what the excerpts do not answer.
Rules: excerpts labelled planned work, objective, hypothesis, method, background or publication titles only are NOT results; describe them with words like "aimed to", "planned" or "expected", never as findings. Never claim anything about the Moon or Mars from microgravity data without saying that no partial-gravity combustion data exists in PSI. If the excerpts do not answer the question, return an empty "documented" and explain in "uncertainty". Keep the whole reply under 180 words."""


def _evidence(hits, question: str) -> list[EvidenceItem]:
    out = []
    for n, (score, c) in enumerate(hits, 1):
        excerpt = c["text"][:320].rsplit(" ", 1)[0] + "..." if c["kind"] == "publication_titles" and len(c["text"]) > 320 else K.best_sentences(c["text"], question)
        out.append(EvidenceItem(n=n, id=c["id"], label=c["label"], kind=c["kind"], evidence_type=c["evidence_type"], accessions=c["accessions"],
                                page=c.get("page"), source_label=c["source_label"], source_url=c.get("source_url"), excerpt=excerpt, score=round(score, 2)))
    return out


def _related(ev: list[EvidenceItem], limit: int = 6) -> list[RelatedInvestigation]:
    seen, out = set(), []
    for e in ev:
        for a in e.accessions:
            if a not in seen and (r := C.get_by_id(a)):
                seen.add(a)
                out.append(RelatedInvestigation(accession=a, acronym=r.get("acronym"), title=r["title"]))
    return out[:limit]


def _uncertainty(question: str, ev: list[EvidenceItem], detected: list[str], top_score: float) -> list[str]:
    notes = []
    types = {e.evidence_type for e in ev}
    if not any("reported result" in t for t in types):
        notes.append("None of the retrieved passages reports an experimental result; they describe aims, methods, expectations or background.")
    if any("planned work" in t for t in types):
        notes.append("Some passages describe work as it was planned in 2015, not what it found.")
    if all(e.kind == "publication_titles" for e in ev):
        notes.append("Only publication titles matched. A title is not a finding.")
    if re.search(r"\b(lunar|moon|mars|martian|partial[- ]gravity|rover|habitat)", question, re.I):
        notes.append("PSI has no partial-gravity combustion data. Microgravity and normal-gravity results can only bound behaviour on the Moon or Mars. For a scored comparison of investigations by scenario use /api/ranking/run.")
    uncovered = [a for a in detected if a not in GUIDE_COVERED]
    if uncovered:
        notes.append("The 2015 guide does not cover " + ", ".join(uncovered) + "; only their PSI record text was available.")
    if top_score < 7:
        notes.append("The match is weak; the passages may only partly address the question.")
    return notes


def _extractive(question: str, ev: list[EvidenceItem], reason: str) -> str:
    lines = [f"{reason} These are the passages from NASA sources that best match the question, most relevant first. Nothing below was written by a model."]
    for e in ev[:4]:
        lines.append(f"[{e.n}] {e.label} ({e.evidence_type}): {e.excerpt}")
    return "\n\n".join(lines)


_NUM = re.compile(r"\d+(?:\.\d+)?")


def _guard(text: str, ev_by_n: dict[int, EvidenceItem], full: dict[int, str], require_cite: bool) -> tuple[str, int]:
    kept, dropped = [], 0
    all_text = " ".join(full.values())
    for s in K.sentences(text or ""):
        cites = [int(x) for x in re.findall(r"\[(\d+)\]", s)]
        if (require_cite and not cites) or any(c not in ev_by_n for c in cites):
            dropped += 1
            continue
        hay = " ".join(full[c] for c in cites) if cites else all_text
        if any(n not in hay for n in _NUM.findall(re.sub(r"\[\d+\]", "", s))):
            dropped += 1
            continue
        kept.append(s)
    return " ".join(kept), dropped


def _parse_json(raw: str) -> Optional[dict]:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    m = re.search(r"\{.*\}", raw, re.S)
    for cand in (raw, m.group(0) if m else None):
        if cand:
            try:
                d = json.loads(cand)
                if isinstance(d, dict):
                    return d
            except ValueError:
                pass
    return None


def ask(question: str, top_k: int = 6, use_llm: bool = True) -> AskResponse:
    question = " ".join(question.split())
    hits, detected = K.retrieve(question, top_k)
    if not hits:
        return AskResponse(question=question, answered=False, mode="none", answer=(
            "I can't find anything about this in the indexed NASA sources, so I won't guess. Try naming an investigation (for example SAFFIRE-I or FLEX) "
            "or a topic such as oxygen concentration, smoke detection or fire suppression."), disclaimers=DISCLAIMERS,
            uncertainty=["No passage matched the question well enough."])
    ev = _evidence(hits, question)
    unc = _uncertainty(question, ev, detected, hits[0][0])
    base = dict(question=question, answered=True, evidence=ev, related_investigations=_related(ev), disclaimers=DISCLAIMERS)
    key, model = llm_config()
    if not use_llm:
        return AskResponse(**base, mode="extractive", uncertainty=unc, answer=_extractive(question, ev, "The language model was not used for this request."))
    if not key:
        return AskResponse(**base, mode="extractive", uncertainty=unc + ["No language model is configured (set GEMINI_API_KEY); showing matching passages only."],
                           answer=_extractive(question, ev, "No language model is configured."))
    # language model path
    full = {e.n: f"{e.label} {c['text']}" for e, (_, c) in zip(ev, hits)}
    prompt = "Question: " + question + "\n\nExcerpts:\n" + "\n\n".join(
        f"[{e.n}] ({e.label}; {e.evidence_type}{'; page ' + e.page if e.page else ''}) {c['text']}" for e, (_, c) in zip(ev, hits))
    err = None
    try:
        raw = llm_call(SYSTEM_PROMPT, prompt, key, model)
        parsed = _parse_json(raw)
        if parsed is None:
            err = "The model's reply was not valid JSON."
        else:
            ev_by_n = {e.n: e for e in ev}
            doc, d1 = _guard(str(parsed.get("documented") or ""), ev_by_n, full, require_cite=True)
            interp, d2 = _guard(str(parsed.get("interpretation") or ""), ev_by_n, full, require_cite=False)
            if not doc:
                err = "The model's answer failed the source checks (uncited or unsupported sentences were removed)."
            else:
                model_unc = [str(x) for x in (parsed.get("uncertainty") or []) if isinstance(x, (str, int, float))][:4]
                extra = [f"{d1 + d2} sentence(s) from the model were removed because they cited no passage or used a number not in the cited passage."] if d1 + d2 else []
                return AskResponse(**base, mode="llm", model=model, documented=doc, interpretation=interp or None,
                                   answer=doc + (f"\n\nInterpretation (model reading, not a NASA finding): {interp}" if interp else ""),
                                   uncertainty=unc + model_unc + extra)
    except urllib.error.HTTPError as e:
        err = f"The language model request failed (HTTP {e.code})."
    except Exception as e:  # network, timeout, bad response: never leak details of the key
        err = f"The language model request failed ({type(e).__name__})."
    log.warning("llm path failed: %s", err)
    return AskResponse(**base, mode="extractive", llm_error=err, uncertainty=unc,
                       answer=_extractive(question, ev, "The language model could not be used for this answer."))


def documents() -> DocumentsResponse:
    key, model = llm_config()
    idx = K.get_index()
    return DocumentsResponse(llm_configured=bool(key), model=model if key else None, investigations_indexed=len(C.get_catalog()["records"]),
                             passages=len(idx["chunks"]), sources=[SourceInfo(**s) for s in K.sources_summary()], not_indexed=NOT_INDEXED)


def _first_sentences(text: Optional[str], n: int = 2) -> Optional[str]:
    ss = K.sentences(text or "")
    return " ".join(ss[:n]) if ss else None


def summarize(accession: str) -> Optional[SummaryResponse]:
    r = C.get_by_id(accession)
    if not r:
        return None
    cond = []
    for c in r["conditions"]:
        tag = " (burner stream)" if c.get("context") == "oxidizer" else ""
        cond.append(f"{c['variable']}{tag}: {c['min']:g} to {c['max']:g} {c['unit']}")
    hw = "; ".join(x for x in [f"Hardware: {r['hardware']}" if r.get("hardware") else None, f"Platform: {r['platform']}" if r.get("platform") else None] if x)
    parts = [("What it studied", _first_sentences(r.get("objective")), "objective"), ("How it was done", _first_sentences(r.get("approach")), "approach"),
             ("Hypothesis", _first_sentences(r.get("hypothesis")), "hypothesis"), ("Why it matters (as stated in PSI)", _first_sentences(r.get("research_impacts")), "research_impacts"),
             ("Tested conditions", "; ".join(cond) or None, "experiment tables"), ("Hardware and platform", hw or None, "hardware, platform")]
    sections = [SummarySection(title=t, text=x, source_field=f, available=bool(x)) for t, x, f in parts]
    guide = [c for c in K.get_index()["chunks"] if c["kind"] == "nasa_guide" and r["accession"] in c["accessions"]]
    guide_ev = _evidence([(0.0, c) for c in guide], "")
    notes = ["PSI records describe aims and methods; they do not list results.",
             "Only the first two sentences of each field are shown. The full text is in /api/investigations/" + r["accession"] + "."]
    if r.get("data_origin") == "ground":
        notes.append("Ground investigation: modelling or analysis of other PSI data, with no flight measurements of its own.")
    if not guide:
        notes.append("The 2015 NASA guide has no entry for this investigation.")
    if any(c.get("context") == "oxidizer" for c in r["conditions"]):
        notes.append("Oxygen marked 'burner stream' is the inverse-flame oxidizer, not oxygen in the surroundings.")
    return SummaryResponse(accession=r["accession"], acronym=r.get("acronym"), title=r["title"], sections=sections, guide_entries=guide_ev,
                           not_available=[s.title for s in sections if not s.available], notes=notes, source_url=r["source_url"],
                           method="Rule-based extract of PSI fields (first sentences). No language model wrote this.")
